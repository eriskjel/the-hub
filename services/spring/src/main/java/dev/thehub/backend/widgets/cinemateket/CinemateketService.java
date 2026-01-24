package dev.thehub.backend.widgets.cinemateket;

import dev.thehub.backend.widgets.cinemateket.dto.FilmShowingDto;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * Service that scrapes Cinemateket Trondheim's program page to extract upcoming
 * film showings.
 */
@Service
public class CinemateketService {
    private static final Logger log = LoggerFactory.getLogger(CinemateketService.class);
    private static final String URL = "https://cinemateket-trondheim.no/program/";
    private static final ZoneId ZONE = ZoneId.of("Europe/Oslo");
    private static final Map<String, Month> NO_MONTHS = Map.ofEntries(Map.entry("januar", Month.JANUARY),
            Map.entry("februar", Month.FEBRUARY), Map.entry("mars", Month.MARCH), Map.entry("april", Month.APRIL),
            Map.entry("mai", Month.MAY), Map.entry("juni", Month.JUNE), Map.entry("juli", Month.JULY),
            Map.entry("august", Month.AUGUST), Map.entry("september", Month.SEPTEMBER),
            Map.entry("oktober", Month.OCTOBER), Map.entry("november", Month.NOVEMBER),
            Map.entry("desember", Month.DECEMBER));

    // Pattern to match "DD.MM" or "DD.MM." date format
    private static final Pattern DATE_PATTERN = Pattern.compile("(\\d{1,2})\\.(\\d{2})\\.?");
    // Pattern to match "HH.MM" time format
    private static final Pattern TIME_PATTERN = Pattern.compile("(\\d{1,2})\\.(\\d{2})");
    // Pattern to match director and year: "Director Name YYYY" or "Director Name"
    private static final Pattern DIRECTOR_YEAR_PATTERN = Pattern.compile("^(.+?)\\s+(\\d{4})$");

    private final RestTemplate http;

    // Simple in-memory cache with TTL (30 minutes)
    private static final long CACHE_TTL_MS = 30 * 60 * 1000;
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private static class CacheEntry {
        final List<FilmShowingDto> data;
        final long timestamp;

        CacheEntry(List<FilmShowingDto> data) {
            this.data = data;
            this.timestamp = System.currentTimeMillis();
        }

        boolean isExpired() {
            return System.currentTimeMillis() - timestamp > CACHE_TTL_MS;
        }
    }

    public CinemateketService(RestTemplate http) {
        this.http = http;
    }

    private HttpHeaders createBrowserHeaders() {
        HttpHeaders headers = new HttpHeaders();
        // Browser-like headers to bypass Cloudflare basic protection
        headers.setAccept(List.of(MediaType.TEXT_HTML));
        headers.set(HttpHeaders.ACCEPT_CHARSET, StandardCharsets.UTF_8.name());
        headers.set(HttpHeaders.ACCEPT_LANGUAGE, "no-NO,no;q=0.9,nb;q=0.8,en-US;q=0.7,en;q=0.6");
        headers.set(HttpHeaders.USER_AGENT,
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        // Don't request compression - RestTemplate doesn't auto-decompress
        // headers.set("Accept-Encoding", "gzip, deflate, br");
        headers.set("DNT", "1");
        headers.set("Connection", "keep-alive");
        headers.set("Upgrade-Insecure-Requests", "1");
        headers.set("Sec-Fetch-Dest", "document");
        headers.set("Sec-Fetch-Mode", "navigate");
        headers.set("Sec-Fetch-Site", "same-origin");
        headers.set("Sec-Fetch-User", "?1");
        headers.set("Cache-Control", "max-age=0");
        return headers;
    }

    private String extractCookies(org.springframework.http.ResponseEntity<String> response) {
        List<String> cookieHeaders = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        if (cookieHeaders == null || cookieHeaders.isEmpty()) {
            return "";
        }
        // Extract cookie name=value pairs (before the first semicolon)
        return cookieHeaders.stream().map(cookie -> {
            int semicolonIdx = cookie.indexOf(';');
            return semicolonIdx > 0 ? cookie.substring(0, semicolonIdx) : cookie;
        }).filter(c -> !c.isEmpty()).collect(java.util.stream.Collectors.joining("; "));
    }

    /**
     * Scrapes the program page and returns upcoming film showings. Results are
     * cached for 30 minutes to reduce load on the external website.
     *
     * @param limit
     *            maximum number of showings to return (null = no limit)
     * @return list of film showings, sorted by show time
     */
    public List<FilmShowingDto> fetchShowings(Integer limit) {
        // Check cache first
        String cacheKey = "default";
        CacheEntry cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            log.debug("Cinemateket using cached data (age={}ms)", System.currentTimeMillis() - cached.timestamp);
            List<FilmShowingDto> result = new ArrayList<>(cached.data);
            if (limit != null && limit > 0) {
                result = result.stream().limit(limit).collect(java.util.stream.Collectors.toList());
            }
            return result;
        }

        try {
            // First, visit the homepage to establish a session and get cookies
            // This helps bypass Cloudflare's initial challenge
            String homeUrl = "https://cinemateket-trondheim.no/";
            HttpHeaders homeHeaders = createBrowserHeaders();
            var homeResp = http.exchange(homeUrl, HttpMethod.GET, new HttpEntity<>(homeHeaders), String.class);

            // Check if homepage was blocked
            if (homeResp.getBody() != null) {
                String homeBody = homeResp.getBody().toLowerCase(Locale.ROOT);
                if (homeBody.contains("just a moment") && homeBody.contains("cf-browser-verification")) {
                    log.warn("Cinemateket homepage blocked by Cloudflare");
                    return List.of();
                }
            }

            // Extract cookies from the response
            String cookies = extractCookies(homeResp);

            // Small delay to appear more human-like
            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            // Now request the program page with cookies
            HttpHeaders headers = createBrowserHeaders();
            if (!cookies.isEmpty()) {
                headers.set(HttpHeaders.COOKIE, cookies);
            }
            headers.set(HttpHeaders.REFERER, homeUrl);

            var resp = http.exchange(URL, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                log.warn("Cinemateket scrape failed: status={}", resp.getStatusCode());
                return List.of();
            }

            // Check if we got a Cloudflare challenge page
            String body = resp.getBody();
            String bodyLower = body.toLowerCase(Locale.ROOT);

            // More specific Cloudflare detection - check for multiple indicators
            boolean isCloudflare = (bodyLower.contains("just a moment")
                    && bodyLower.contains("cf-browser-verification"))
                    || (bodyLower.contains("checking your browser") && bodyLower.contains("ddos protection"))
                    || (bodyLower.contains("challenge-platform") && bodyLower.contains("cf-"))
                    || (bodyLower.contains("ray id") && bodyLower.contains("cf-"));

            if (isCloudflare) {
                log.warn("Cinemateket scrape blocked by Cloudflare challenge page");
                log.debug("Response preview: {}", body.length() > 500 ? body.substring(0, 500) : body);
                return List.of();
            }

            // Check if response is not HTML (but allow for compressed responses that
            // weren't decompressed)
            if (!bodyLower.contains("<html") && !bodyLower.contains("<!doctype")
                    && !bodyLower.contains("<!doctype html")) {
                // Check if it might be compressed
                String contentEncoding = resp.getHeaders().getFirst(HttpHeaders.CONTENT_ENCODING);
                if (contentEncoding != null && (contentEncoding.contains("gzip") || contentEncoding.contains("br")
                        || contentEncoding.contains("deflate"))) {
                    log.error(
                            "Cinemateket response is compressed but not decompressed! Content-Encoding: {}. "
                                    + "RestTemplate needs to be configured for automatic decompression.",
                            contentEncoding);
                } else {
                    log.warn("Cinemateket response doesn't appear to be HTML. Content-Type: {}",
                            resp.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE));
                }
            }

            Document doc = Jsoup.parse(body);
            List<FilmShowingDto> showings = parseShowings(doc);

            // Filter to only future showings
            Instant now = Instant.now();
            List<FilmShowingDto> filtered = showings.stream().filter(s -> {
                try {
                    Instant showTime = Instant.parse(s.showTime());
                    return !showTime.isBefore(now);
                } catch (Exception e) {
                    return true; // Keep if parsing fails
                }
            }).collect(java.util.stream.Collectors.toCollection(ArrayList::new));

            // Sort by show time
            filtered.sort(Comparator.comparing(s -> {
                try {
                    return Instant.parse(s.showTime());
                } catch (Exception e) {
                    return Instant.MAX;
                }
            }));

            if (limit != null && limit > 0) {
                filtered = filtered.stream().limit(limit).collect(java.util.stream.Collectors.toList());
            }

            showings = filtered;

            // Cache the result
            cache.put(cacheKey, new CacheEntry(showings));

            log.info("Cinemateket parsed {} showings", showings.size());
            return showings;
        } catch (Exception e) {
            log.error("Cinemateket scrape error", e);
            return List.of();
        }
    }

    private List<FilmShowingDto> parseShowings(Document doc) {
        List<FilmShowingDto> showings = new ArrayList<>();
        int currentYear = Year.now(ZONE).getValue();

        // Find all h2 elements (months) - they're in accordion items
        Elements monthHeaders = doc.select("h2");

        // Filter to only h2s that contain month names
        monthHeaders = monthHeaders.stream().filter(h2 -> {
            String text = h2.text().trim().toLowerCase(Locale.ROOT);
            return NO_MONTHS.containsKey(text);
        }).collect(java.util.stream.Collectors.toCollection(() -> new org.jsoup.select.Elements()));

        for (Element monthHeader : monthHeaders) {
            String monthText = monthHeader.text().trim().toLowerCase(Locale.ROOT);
            Month month = NO_MONTHS.get(monthText);
            if (month == null) {
                continue;
            }

            // The structure is: accordion item > h2 (month) > accordion content >
            // wp-block-group > paragraphs
            // Find the parent accordion item
            Element accordionItem = monthHeader.parent();
            while (accordionItem != null && !accordionItem.hasClass("wp-block-pb-accordion-item")) {
                accordionItem = accordionItem.parent();
            }

            if (accordionItem == null) {
                continue;
            }

            // Find the accordion content div (sibling of the h2, or child of accordion
            // item)
            Element contentDiv = accordionItem.selectFirst(".c-accordion__content");
            if (contentDiv == null) {
                continue;
            }

            // Find all paragraphs in the content div
            Elements paragraphs = contentDiv.select("p");

            for (Element p : paragraphs) {
                parseParagraph(p, month, currentYear, showings);
            }
        }

        return showings;
    }

    private void parseParagraph(Element p, Month month, int year, List<FilmShowingDto> showings) {
        String text = p.text();
        if (text.isBlank())
            return;

        // Look for day patterns like "Torsdag 08.01." or "Onsdag 14.01" in strong tags
        Elements strongTags = p.select("strong");
        String dayText = "";
        for (Element strong : strongTags) {
            String strongText = strong.text().trim();
            Matcher dayMatcher = DATE_PATTERN.matcher(strongText);
            if (dayMatcher.find()) {
                dayText = strongText;
                break;
            }
        }

        if (dayText.isEmpty()) {
            // Fallback: check the whole paragraph text
            Matcher dayMatcher = DATE_PATTERN.matcher(text);
            if (!dayMatcher.find())
                return;
            dayText = dayMatcher.group(0);
        }

        Matcher dayMatcher = DATE_PATTERN.matcher(dayText);
        if (!dayMatcher.find())
            return;

        int day;
        int monthNum;
        try {
            day = Integer.parseInt(dayMatcher.group(1));
            monthNum = Integer.parseInt(dayMatcher.group(2));
        } catch (NumberFormatException e) {
            return;
        }

        // Validate month matches
        if (monthNum != month.getValue()) {
            return;
        }

        // Handle year boundary: if current month is December and parsed month is
        // January, increment year
        int adjustedYear = year;
        Month currentMonth = LocalDate.now(ZONE).getMonth();
        if (currentMonth == Month.DECEMBER && month == Month.JANUARY) {
            adjustedYear = year + 1;
        }

        LocalDate date;
        try {
            date = LocalDate.of(adjustedYear, month, day);
        } catch (DateTimeException e) {
            return;
        }

        // Split by <br> tags to get individual showings
        String html = p.html();
        String[] lines = html.split("<br\\s*/?>", -1);

        for (String lineHtml : lines) {
            // Parse this line as HTML to extract structured data
            Document lineDoc = Jsoup.parse(lineHtml);
            String line = lineDoc.text().trim();
            if (line.isEmpty())
                continue;

            // Check if line contains a time (HH.MM format, where HH is 0-23)
            Matcher timeMatcher = TIME_PATTERN.matcher(line);
            if (!timeMatcher.find())
                continue;

            int hour;
            int minute;
            try {
                hour = Integer.parseInt(timeMatcher.group(1));
                minute = Integer.parseInt(timeMatcher.group(2));
            } catch (NumberFormatException e) {
                // Skip this line if the time components are not valid integers
                continue;
            }

            // Validate hour is in valid range (0-23)
            // Also check it's not a date pattern (e.g., "24.01" should not match as time
            // "24.00")
            if (hour < 0 || hour > 23) {
                continue;
            }

            // Validate minute is in valid range (0-59)
            if (minute < 0 || minute > 59) {
                continue;
            }

            // Additional check: if the line only contains a date pattern and no actual time
            // content,
            // it's likely just a date header, not a showing with a time
            // Times should be followed by title/director info, not just be standalone dates
            String afterTimePattern = line.substring(timeMatcher.end()).trim();
            if (afterTimePattern.isEmpty() || afterTimePattern.matches("^[\\d.\\s]+$")) {
                // Line only has numbers/dots after time - likely a date, not a time
                continue;
            }

            LocalDateTime dateTime;
            try {
                dateTime = date.atTime(hour, minute);
            } catch (DateTimeException e) {
                log.debug("Failed to create LocalDateTime from hour={} minute={} date={}: {}", hour, minute, date,
                        e.getMessage());
                continue;
            }
            Instant showTime = dateTime.atZone(ZONE).toInstant();

            // Extract film title and links from this line
            // We need to extract title and filmUrl together to ensure they match
            String title = null;
            String filmUrl = null;
            String ticketUrl = null;

            // First, try to find title in links (most reliable) and capture its URL
            Elements links = lineDoc.select("a");
            for (Element link : links) {
                String linkText = link.text().trim();
                String linkTextLower = linkText.toLowerCase(Locale.ROOT);
                String href = link.attr("href");

                // Skip ticket links and other non-title links
                if (linkText.isEmpty() || linkTextLower.contains("billetter")
                        || linkTextLower.equals("minimalen kortfilmfestival") || linkTextLower.contains("ticketco")) {
                    // This is a ticket link
                    if (linkTextLower.contains("billetter") || href.contains("ticketco")) {
                        if (ticketUrl == null) {
                            ticketUrl = href.startsWith("http") ? href : "https://cinemateket-trondheim.no" + href;
                        }
                    }
                    continue;
                }

                // This looks like a film title link
                if (title == null) {
                    title = linkText;
                    // Capture the film URL from the title link
                    if (href.contains("/program/") || href.contains("cinemateket")) {
                        filmUrl = href.startsWith("http") ? href : "https://cinemateket-trondheim.no" + href;
                    }
                }
            }

            // If no title from links, try strong tags
            if (title == null) {
                Elements strong = lineDoc.select("strong");
                for (Element s : strong) {
                    String strongText = s.text().trim();
                    if (!strongText.isEmpty() && !DATE_PATTERN.matcher(strongText).find()
                            && !strongText.toLowerCase(Locale.ROOT).contains("uke")
                            && !strongText.toLowerCase(Locale.ROOT).contains("billetter")) {
                        // Check if it's not a day name
                        if (!strongText.matches("(?i)(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag).*")) {
                            title = strongText;
                            break;
                        }
                    }
                }
            }

            // Fallback: extract from line text after time
            if (title == null) {
                String afterTime = line.substring(timeMatcher.end()).trim();
                afterTime = afterTime.replaceAll("(?i)\\s*billetter.*", "").trim();
                Matcher dirYearMatcher = DIRECTOR_YEAR_PATTERN.matcher(afterTime);
                if (dirYearMatcher.find()) {
                    String beforeDir = afterTime.substring(0, dirYearMatcher.start()).trim();
                    if (!beforeDir.isEmpty()) {
                        title = beforeDir;
                    }
                } else {
                    String[] parts = afterTime.split("\\s+", 2);
                    if (parts.length > 0 && !parts[0].isEmpty()) {
                        title = parts[0];
                    }
                }
            }

            if (title == null || title.isBlank())
                continue;

            // Extract director and year - look for pattern after the title
            String director = null;
            Integer filmYear = null;
            int timeEnd = timeMatcher.end();
            String afterTime = line.substring(timeEnd).trim();

            // Find title in the text and get what comes after it
            int titleIdx = afterTime.toLowerCase(Locale.ROOT).indexOf(title.toLowerCase(Locale.ROOT));
            if (titleIdx >= 0) {
                String afterTitle = afterTime.substring(titleIdx + title.length()).trim();
                Matcher dirYearMatcher = DIRECTOR_YEAR_PATTERN.matcher(afterTitle);
                if (dirYearMatcher.find()) {
                    director = dirYearMatcher.group(1).trim();
                    try {
                        filmYear = Integer.parseInt(dirYearMatcher.group(2));
                    } catch (NumberFormatException e) {
                        // Ignore
                    }
                } else if (!afterTitle.isBlank() && !afterTitle.toLowerCase(Locale.ROOT).contains("billetter")) {
                    director = afterTitle;
                }
            }

            // If we still don't have ticketUrl, look for it in the line
            if (ticketUrl == null) {
                for (Element link : links) {
                    String href = link.attr("href");
                    String linkText = link.text().toLowerCase(Locale.ROOT);
                    if (linkText.contains("billetter") || href.contains("ticketco")) {
                        ticketUrl = href.startsWith("http") ? href : "https://cinemateket-trondheim.no" + href;
                        break;
                    }
                }
            }

            // Extract organizer (e.g., "Psykolosjen filmklubb:")
            String organizer = null;
            if (line.contains("filmklubb") || line.contains("Filmklubb") || line.contains("filmklubben")) {
                int colonIdx = line.indexOf(':');
                if (colonIdx > 0) {
                    organizer = line.substring(0, colonIdx).trim();
                }
            }

            showings.add(
                    new FilmShowingDto(title, director, filmYear, showTime.toString(), ticketUrl, filmUrl, organizer));
        }
    }

}
