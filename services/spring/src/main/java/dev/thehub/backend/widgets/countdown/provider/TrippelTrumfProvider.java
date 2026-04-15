package dev.thehub.backend.widgets.countdown.provider;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

/**
 * CountdownProvider implementation for "Trippel Trumf" campaign days.
 * <p>
 * Source: a public overview table on EuroBonusguiden (see
 * {@link #sourceUrl()}). Update the URL once a year when EuroBonusguiden
 * publishes the new year's page (path/month in URL is not predictable, e.g.
 * 2025 used /10/, 2026 used /01/). For every listed date a time window is
 * created in Europe/Oslo: [07:00, 22:00).
 */
public class TrippelTrumfProvider implements CountdownProvider {
    private static final Logger log = LoggerFactory.getLogger(TrippelTrumfProvider.class);

    private final RestTemplate http;
    private static final ZoneId ZONE = ZoneId.of("Europe/Oslo");
    /**
     * Current year's overview page – update annually when new page is published.
     */
    private static final String URL = "https://eurobonusguiden.no/2026/01/trippel-trumf-torsdag-datoer-2026/";
    private static final String BONUS_URL = "https://bonusjegeren.no/nar-er-det-trippel-trumf/";
    /**
     * Matches "16. april 2026", "16. april", or "16. apr" — year is optional.
     * When absent, we infer the current year (bonusjegeren groups by year with a
     * heading, so entries within a section may omit the inline year).
     */
    private static final Pattern DATE_PATTERN = Pattern
            .compile("(\\d{1,2})\\.\\s*([a-zæøåA-ZÆØÅ]+)(?:\\s+(\\d{4}))?");

    // Trippel window times (tweak if you prefer 00:00..24:00)
    private static final LocalTime START = LocalTime.of(7, 0);
    private static final LocalTime END = LocalTime.of(22, 0); // exclusive

    private static final Map<String, Month> NO_MONTHS = Map.ofEntries(Map.entry("januar", Month.JANUARY),
            Map.entry("februar", Month.FEBRUARY), Map.entry("mars", Month.MARCH), Map.entry("april", Month.APRIL),
            Map.entry("mai", Month.MAY), Map.entry("juni", Month.JUNE), Map.entry("juli", Month.JULY),
            Map.entry("august", Month.AUGUST), Map.entry("september", Month.SEPTEMBER),
            Map.entry("oktober", Month.OCTOBER), Map.entry("november", Month.NOVEMBER),
            Map.entry("desember", Month.DECEMBER));

    /**
     * Norwegian month names used by bonusjegeren — both short ("apr", "aug")
     * and full ("april", "august"). The page is inconsistent: some cells use
     * short forms, others full. The regex captures greedily, so the map must
     * contain the full-word form as well or those entries get dropped.
     */
    private static final Map<String, Month> NO_MONTHS_SHORT;
    static {
        var m = new HashMap<String, Month>();
        m.put("jan", Month.JANUARY);
        m.put("januar", Month.JANUARY);
        m.put("feb", Month.FEBRUARY);
        m.put("februar", Month.FEBRUARY);
        m.put("mar", Month.MARCH);
        m.put("mars", Month.MARCH);
        m.put("apr", Month.APRIL);
        m.put("april", Month.APRIL);
        m.put("mai", Month.MAY);
        m.put("jun", Month.JUNE);
        m.put("juni", Month.JUNE);
        m.put("jul", Month.JULY);
        m.put("juli", Month.JULY);
        m.put("aug", Month.AUGUST);
        m.put("august", Month.AUGUST);
        m.put("sep", Month.SEPTEMBER);
        m.put("sept", Month.SEPTEMBER);
        m.put("september", Month.SEPTEMBER);
        m.put("okt", Month.OCTOBER);
        m.put("oktober", Month.OCTOBER);
        m.put("nov", Month.NOVEMBER);
        m.put("november", Month.NOVEMBER);
        m.put("des", Month.DECEMBER);
        m.put("desember", Month.DECEMBER);
        NO_MONTHS_SHORT = Collections.unmodifiableMap(m);
    }

    /**
     * Short-lived in-process cache so next(), previous(), isTentative(), and
     * validUntil() share one scrape per resolver invocation. Guarded by
     * {@code this} — use {@link #mergedWindows()} to access.
     */
    private List<MergedWindow> mergedWindowCache;
    private Instant mergedCacheExpiry = Instant.EPOCH;

    public TrippelTrumfProvider(RestTemplate http) {
        this.http = http;
    }

    @Override
    public String id() {
        return "trippel-trumf";
    }

    @Override
    public Optional<Instant> next(Instant now) {
        var wins = mergedWindows();
        if (wins.isEmpty())
            return Optional.empty();
        // If inside a window today -> return end (minus 1 ms) so 'ongoing' works
        for (var w : wins) {
            if (!now.isBefore(w.start) && now.isBefore(w.endExclusive))
                return Optional.of(w.endExclusive.minusMillis(1));
        }
        // Otherwise earliest future start
        return wins.stream().filter(w -> !w.start.isBefore(now)).findFirst().map(w -> w.start);
    }

    @Override
    public Optional<Instant> previous(Instant now) {
        var wins = mergedWindows();
        if (wins.isEmpty())
            return Optional.empty();
        return wins.stream().map(w -> w.start).filter(s -> s.isBefore(now)).max(Comparator.naturalOrder());
    }

    @Override
    public boolean isTentative(Instant now) {
        var wins = mergedWindows();
        for (var w : wins) {
            if (!now.isBefore(w.start) && now.isBefore(w.endExclusive))
                return w.tentative;
        }
        return wins.stream().filter(w -> !w.start.isBefore(now)).findFirst().map(w -> w.tentative).orElse(false);
    }

    @Override
    public Optional<String> sourceUrl() {
        return Optional.of(URL);
    }

    @Override
    public Optional<Instant> validUntil(Instant now) {
        var wins = mergedWindows();
        if (wins.isEmpty())
            return Optional.empty();
        for (var w : wins) {
            if (now.isBefore(w.start))
                return Optional.of(w.start);
            if (now.isBefore(w.endExclusive))
                return Optional.of(w.endExclusive);
        }
        return Optional.empty();
    }

    @Override
    public long plausibleWindowMaxHours() {
        // 07–22 same day (+ small buffer)
        return 36;
    }

    /**
     * A window from either or both sources, with a tentative flag when only one
     * source has it.
     */
    private record MergedWindow(Instant start, Instant endExclusive, boolean tentative) {
    }

    /**
     * Internal value object representing a single-day window with an exclusive end.
     */
    private record Window(Instant start, Instant endExclusive) {
    }

    /**
     * Returns merged windows from both sources with a short in-process cache so
     * next() and previous() share a single scrape per resolver invocation.
     */
    private synchronized List<MergedWindow> mergedWindows() {
        if (mergedWindowCache != null && Instant.now().isBefore(mergedCacheExpiry)) {
            return mergedWindowCache;
        }

        var primary = scrapeWindows();
        var secondary = scrapeBonusjegeren();

        var primaryDates = primary.stream().map(w -> w.start.atZone(ZONE).toLocalDate()).collect(Collectors.toSet());

        List<MergedWindow> merged = new ArrayList<>();

        // Primary windows: tentative if bonusjegeren doesn't also have the date
        for (var w : primary) {
            var d = w.start.atZone(ZONE).toLocalDate();
            merged.add(new MergedWindow(w.start, w.endExclusive, !secondary.contains(d)));
        }

        // Secondary-only windows: tentative (single source)
        for (var d : secondary) {
            if (!primaryDates.contains(d)) {
                merged.add(new MergedWindow(d.atTime(START).atZone(ZONE).toInstant(),
                        d.atTime(END).atZone(ZONE).toInstant(), true));
            }
        }

        merged.sort(Comparator.comparing(w -> w.start));
        log.info("Trippel merged {} windows (primary={} secondary={}): {}", merged.size(), primary.size(),
                secondary.size(),
                merged.stream().map(w -> w.start.atZone(ZONE).toLocalDate() + (w.tentative ? "?" : "")).toList());

        mergedWindowCache = merged;
        mergedCacheExpiry = Instant.now().plusSeconds(300);
        return merged;
    }

    /**
     * Scrapes date entries from bonusjegeren.no as a cross-check source. Returns
     * only the current year's dates. On any error, returns an empty set so the
     * primary source continues to work normally.
     */
    private Set<LocalDate> scrapeBonusjegeren() {
        try {
            HttpHeaders h = new HttpHeaders();
            h.setAccept(List.of(MediaType.TEXT_HTML));
            h.set(HttpHeaders.ACCEPT_CHARSET, StandardCharsets.UTF_8.name());
            h.set(HttpHeaders.USER_AGENT, "Mozilla/5.0 (CountdownBot)");
            var resp = http.exchange(BONUS_URL, HttpMethod.GET, new HttpEntity<>(h), String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null)
                return Set.of();

            // Parse with Jsoup so HTML entities (&nbsp;) and tag boundaries are
            // normalized to plain whitespace before the date regex runs —
            // otherwise "16.&nbsp;april&nbsp;2026" won't match DATE_PATTERN.
            String text = org.jsoup.Jsoup.parse(resp.getBody()).text();

            final int yearWanted = Year.now(ZONE).getValue();
            Set<LocalDate> dates = new HashSet<>();
            var matcher = DATE_PATTERN.matcher(text);
            while (matcher.find()) {
                int day = Integer.parseInt(matcher.group(1));
                String monthKey = matcher.group(2).toLowerCase(Locale.ROOT);
                String yearStr = matcher.group(3);
                int year = yearStr != null ? Integer.parseInt(yearStr) : yearWanted;
                if (year != yearWanted)
                    continue;
                Month month = NO_MONTHS_SHORT.get(monthKey);
                if (month == null)
                    continue;
                try {
                    dates.add(LocalDate.of(year, month, day));
                } catch (DateTimeException ignored) {
                }
            }
            log.info("BonusJegeren scraped {} dates for {}: {}", dates.size(), yearWanted, dates);
            return dates;
        } catch (Exception e) {
            log.info("BonusJegeren scrape error (non-fatal): {}", e.toString());
            return Set.of();
        }
    }

    /**
     * Scrapes the source page for a table with headers År / Måned / Dato and
     * converts each target-year row to a [07:00, 22:00) window in Europe/Oslo.
     */
    private List<Window> scrapeWindows() {
        try {
            HttpHeaders h = new HttpHeaders();
            h.setAccept(List.of(MediaType.TEXT_HTML));
            h.set(HttpHeaders.ACCEPT_CHARSET, StandardCharsets.UTF_8.name());
            h.set(HttpHeaders.USER_AGENT, "Mozilla/5.0 (CountdownBot)");
            var resp = http.exchange(URL, HttpMethod.GET, new HttpEntity<>(h), String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null)
                return List.of();

            org.jsoup.nodes.Document doc = org.jsoup.Jsoup.parse(resp.getBody());

            // Find the table that has headers År / Måned / Dato
            org.jsoup.select.Elements tables = doc.select("table");
            org.jsoup.nodes.Element target = null;
            for (var t : tables) {
                var headers = t.select("tr").first();
                if (headers == null)
                    continue;
                var ths = headers.select("th,td").eachText().stream().map(String::trim).toList();
                boolean ok = ths.stream().anyMatch(s -> s.equalsIgnoreCase("År"))
                        && ths.stream().anyMatch(s -> s.toLowerCase(Locale.ROOT).startsWith("måned"))
                        && ths.stream().anyMatch(s -> s.equalsIgnoreCase("Dato"));
                if (ok) {
                    target = t;
                    break;
                }
            }
            if (target == null) {
                log.info("Trippel provider: no table with headers År/Måned/Dato found");
                return List.of();
            }

            List<Window> out = new ArrayList<>();
            final int yearWanted = Year.now(ZONE).getValue();

            var rows = target.select("tr");
            for (int i = 1; i < rows.size(); i++) {
                var cells = rows.get(i).select("td");
                if (cells.isEmpty())
                    continue;

                String yearTxt = cells.get(0).text().trim();
                String monthTxt = cells.size() > 1 ? cells.get(1).text().trim() : "";
                String dateTxt = cells.size() > 2 ? cells.get(2).text().trim() : "";

                if (!yearTxt.matches("\\d{4}"))
                    continue;
                int year = Integer.parseInt(yearTxt);
                if (year != yearWanted)
                    continue;

                if (!dateTxt.matches("\\d{1,2}"))
                    continue;
                int day = Integer.parseInt(dateTxt);

                String monthKey = monthTxt.split("\\(")[0].trim().toLowerCase(Locale.ROOT);
                Month month = NO_MONTHS.get(monthKey);
                if (month == null)
                    continue;

                LocalDate date;
                try {
                    date = LocalDate.of(year, month, day);
                } catch (DateTimeException e) {
                    continue;
                }
                Instant start = date.atTime(START).atZone(ZONE).toInstant();
                Instant endEx = date.atTime(END).atZone(ZONE).toInstant();

                out.add(new Window(start, endEx));
            }

            out.sort(Comparator.comparing(w -> w.start));
            log.info("Trippel provider parsed {} windows: {}", out.size(),
                    out.stream().map(w -> w.start.atZone(ZONE).toLocalDate().toString()).toList());

            return out;
        } catch (Exception e) {
            log.info("Trippel provider scrape error: {}", e.toString());
            return List.of();
        }
    }
}
