package dev.thehub.backend.widgets.countdown.provider;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

/**
 * CountdownProvider implementation for "Trippel Trumf" campaign days.
 * <p>
 * Source: a public 2025 overview table on EuroBonusguiden (see
 * {@link #sourceUrl()}). For every listed date a time window is created in
 * Europe/Oslo: [07:00, 22:00). The provider mirrors the semantics used by
 * DNBSupertilbudProvider:
 * <ul>
 * <li>If the reference time falls inside a window, {@link #next(Instant)}
 * returns the end of the window minus 1 millisecond so the caller can treat the
 * event as ongoing up to and including that moment.</li>
 * <li>{@link #previous(Instant)} returns the start of the most recent window
 * strictly before the reference time.</li>
 * </ul>
 * The provider also supplies a {@link #validUntil(Instant)} to help cache
 * refreshes happen either at the start or the end of the next relevant window.
 */
public class TrippelTrumfProvider implements CountdownProvider {
    private static final Logger log = LoggerFactory.getLogger(TrippelTrumfProvider.class);

    private final RestTemplate http;
    private static final ZoneId ZONE = ZoneId.of("Europe/Oslo");
    private static final String URL = "https://eurobonusguiden.no/2025/09/trippel-trumf-torsdag-2025/";

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
     * Creates a Trippel Trumf provider using the given HTTP client.
     *
     * @param http
     *            RestTemplate used to fetch the source page
     */
    public TrippelTrumfProvider(RestTemplate http) {
        this.http = http;
    }

    /** {@inheritDoc} */
    @Override
    public String id() {
        return "trippel-trumf";
    }

    /** {@inheritDoc} */
    @Override
    public Optional<Instant> next(Instant now) {
        var wins = scrapeWindows(); // each window is a (start,endExclusive) on a single date
        if (wins.isEmpty())
            return Optional.empty();

        // If we are inside a window today -> return end (minus 1 ms) so 'ongoing' works
        for (var w : wins) {
            if (!now.isBefore(w.start) && now.isBefore(w.endExclusive)) {
                return Optional.of(w.endExclusive.minusMillis(1));
            }
        }

        // Otherwise, return the earliest future start
        return wins.stream().map(w -> w.start).filter(s -> !s.isBefore(now)).min(Comparator.naturalOrder());
    }

    /** {@inheritDoc} */
    @Override
    public Optional<Instant> previous(Instant now) {
        var wins = scrapeWindows();
        if (wins.isEmpty())
            return Optional.empty();
        return wins.stream().map(w -> w.start).filter(s -> s.isBefore(now)).max(Comparator.naturalOrder());
    }

    /** {@inheritDoc} */
    @Override
    public Optional<String> sourceUrl() {
        return Optional.of(URL);
    }

    /**
     * {@inheritDoc} Help resolver cache refresh at meaningful boundaries (window
     * start/end).
     */
    @Override
    public Optional<Instant> validUntil(Instant now) {
        var wins = scrapeWindows();
        if (wins.isEmpty())
            return Optional.empty();
        // If before first upcoming, refresh at that start
        for (var w : wins) {
            if (now.isBefore(w.start))
                return Optional.of(w.start);
            if (now.isBefore(w.endExclusive))
                return Optional.of(w.endExclusive);
        }
        return Optional.empty(); // after last known window
    }

    /**
     * Internal value object representing a single-day window with an exclusive end.
     */
    private record Window(Instant start, Instant endExclusive) {
    }

    /**
     * Scrapes the source page for a table with headers År / Måned / Dato and
     * converts each 2025 row to a [07:00, 22:00) window in Europe/Oslo.
     *
     * @return sorted list of windows or an empty list on error
     */
    private List<Window> scrapeWindows() {
        try {
            // Fetch
            HttpHeaders h = new HttpHeaders();
            h.setAccept(List.of(MediaType.TEXT_HTML));
            h.set(HttpHeaders.ACCEPT_CHARSET, StandardCharsets.UTF_8.name());
            h.set(HttpHeaders.USER_AGENT, "Mozilla/5.0 (CountdownBot)");
            var resp = http.exchange(URL, HttpMethod.GET, new HttpEntity<>(h), String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null)
                return List.of();

            // Parse HTML with Jsoup
            org.jsoup.nodes.Document doc = org.jsoup.Jsoup.parse(resp.getBody());

            // Find the table that has headers År / Måned / Dato
            org.jsoup.select.Elements tables = doc.select("table");
            org.jsoup.nodes.Element target = null;
            for (var t : tables) {
                var headers = t.select("tr").first();
                if (headers == null)
                    continue;
                var ths = headers.select("th,td").eachText().stream().map(String::trim).toList();
                // accept both <th> or <td> headers
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
            int yearWanted = 2025;

            // Iterate rows after header
            var rows = target.select("tr");
            for (int i = 1; i < rows.size(); i++) {
                var cells = rows.get(i).select("td");
                if (cells.isEmpty())
                    continue;

                // Some rows have colspan; handle safely
                String yearTxt = cells.get(0).text().trim();
                String monthTxt = cells.size() > 1 ? cells.get(1).text().trim() : "";
                String dateTxt = cells.size() > 2 ? cells.get(2).text().trim() : "";

                // Skip “Juli 2024 …” or malformed rows
                if (!yearTxt.matches("\\d{4}"))
                    continue;
                int year = Integer.parseInt(yearTxt);
                if (year != yearWanted)
                    continue;

                // Skip “Kommer”, empty, or non-numeric dates
                if (!dateTxt.matches("\\d{1,2}"))
                    continue;
                int day = Integer.parseInt(dateTxt);

                // Normalize month: take first word before any parenthesis
                String monthKey = monthTxt.split("\\(")[0].trim().toLowerCase(Locale.ROOT);
                Month month = NO_MONTHS.get(monthKey);
                if (month == null)
                    continue;

                // Build window [07:00, 22:00)
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
