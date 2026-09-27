package dev.thehub.backend.widgets.countdown.provider;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

/**
 * CountdownProvider implementation for "Trippel Trumf" campaign days.
 * <p>
 * Dates are collected from three independent sources and merged by vote:
 * <ul>
 * <li>EuroBonusguiden overview table (see {@link #sourceUrl()}). Update the URL
 * once a year when EuroBonusguiden publishes the new year's page (path/month in
 * URL is not predictable, e.g. 2025 used /10/, 2026 used /01/; old paths
 * redirect).</li>
 * <li>Bonusjegeren's iCalendar feed.</li>
 * <li>Kredittkortlisten's date table (one row per date, year always
 * included).</li>
 * </ul>
 * A date listed by at least two sources is confirmed; a date from a single
 * source is tentative. A single-source date within {@link #CONFLICT_DAYS} of a
 * confirmed date is dropped as a probable typo for that date. There is
 * deliberately no weekday check — Trumf could run one on a non-Thursday. For
 * every date a time window is created in Europe/Oslo: [07:00, 22:00).
 */
public class TrippelTrumfProvider implements CountdownProvider {
    private static final Logger log = LoggerFactory.getLogger(TrippelTrumfProvider.class);

    private final RestTemplate http;
    private final Clock clock;
    private static final ZoneId ZONE = ZoneId.of("Europe/Oslo");
    /**
     * Current year's overview page – update annually when new page is published.
     */
    private static final String URL = "https://eurobonusguiden.no/2026/01/trippel-trumf-torsdag-datoer-2026/";
    private static final String BONUS_ICS_URL = "https://bonusjegeren.no/trippel-trumf-kalender.ics";
    private static final String KREDITTKORT_URL = "https://www.kredittkortlisten.no/guider/trippel-trumf-torsdag/";

    /** Matches all-day and timed starts: "DTSTART;VALUE=DATE:20261015". */
    private static final Pattern ICS_DTSTART = Pattern.compile("(?m)^DTSTART[^:\\r\\n]*:(\\d{4})(\\d{2})(\\d{2})");
    /**
     * Matches a whole table cell like "tor. 15. okt. 2026" or "tor. 18. juni 2026".
     * Anchored so prose that merely mentions a date never matches.
     */
    private static final Pattern KREDITTKORT_CELL = Pattern
            .compile("^\\p{L}+\\.?\\h+(\\d{1,2})\\.\\h*(\\p{L}+)\\.?\\h+(\\d{4})$");

    /**
     * A single-source date this close to a date two or more sources agree on is
     * treated as a typo for it. Real extra days have been at least a week apart.
     */
    private static final int CONFLICT_DAYS = 3;
    private static final int CONFIRM_VOTES = 2;

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
     * Norwegian month names used by kredittkortlisten — short ("okt", "des") and
     * full ("juni", "mars") forms are mixed on the same page.
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
        this(http, Clock.systemUTC());
    }

    TrippelTrumfProvider(RestTemplate http, Clock clock) {
        this.http = http;
        this.clock = clock;
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
     * A window with a tentative flag when fewer than {@link #CONFIRM_VOTES} sources
     * list the date.
     */
    private record MergedWindow(Instant start, Instant endExclusive, boolean tentative) {
    }

    /**
     * Returns merged windows from all sources with a short in-process cache so
     * next() and previous() share a single scrape per resolver invocation.
     */
    private synchronized List<MergedWindow> mergedWindows() {
        if (mergedWindowCache != null && clock.instant().isBefore(mergedCacheExpiry)) {
            return mergedWindowCache;
        }

        final int yearWanted = LocalDate.ofInstant(clock.instant(), ZONE).getYear();
        var eurobonus = scrapeEurobonusguiden(yearWanted);
        var bonusjegeren = fetchBonusjegerenIcs(yearWanted);
        var kredittkort = scrapeKredittkortlisten(yearWanted);

        // Each source is a Set, so a source can vote at most once per date.
        Map<LocalDate, Integer> votes = new TreeMap<>();
        for (var source : List.of(eurobonus, bonusjegeren, kredittkort)) {
            for (var d : source)
                votes.merge(d, 1, Integer::sum);
        }

        var confirmed = votes.entrySet().stream().filter(e -> e.getValue() >= CONFIRM_VOTES).map(Map.Entry::getKey)
                .toList();

        List<MergedWindow> merged = new ArrayList<>();
        List<LocalDate> dropped = new ArrayList<>();
        for (var e : votes.entrySet()) {
            var d = e.getKey();
            boolean tentative = e.getValue() < CONFIRM_VOTES;
            if (tentative
                    && confirmed.stream().anyMatch(c -> Math.abs(ChronoUnit.DAYS.between(c, d)) <= CONFLICT_DAYS)) {
                dropped.add(d);
                continue;
            }
            merged.add(new MergedWindow(d.atTime(START).atZone(ZONE).toInstant(),
                    d.atTime(END).atZone(ZONE).toInstant(), tentative));
        }

        log.info("Trippel merged {} windows (eurobonusguiden={} bonusjegeren={} kredittkortlisten={}): {} dropped={}",
                merged.size(), eurobonus.size(), bonusjegeren.size(), kredittkort.size(),
                merged.stream().map(w -> w.start.atZone(ZONE).toLocalDate() + (w.tentative ? "?" : "")).toList(),
                dropped);

        mergedWindowCache = merged;
        mergedCacheExpiry = clock.instant().plusSeconds(300);
        return merged;
    }

    /** GETs a URL as text; empty on a non-2xx or empty body, errors propagate. */
    private Optional<String> fetch(String url, MediaType accept) {
        HttpHeaders h = new HttpHeaders();
        h.setAccept(List.of(accept));
        h.set(HttpHeaders.ACCEPT_CHARSET, StandardCharsets.UTF_8.name());
        h.set(HttpHeaders.USER_AGENT, "Mozilla/5.0 (CountdownBot)");
        var resp = http.exchange(url, HttpMethod.GET, new HttpEntity<>(h), String.class);
        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null)
            return Optional.empty();
        return Optional.of(resp.getBody());
    }

    /**
     * Reads DTSTART dates from bonusjegeren's iCalendar feed. The feed also carries
     * next year's guesses, which the year filter drops.
     */
    private Set<LocalDate> fetchBonusjegerenIcs(int yearWanted) {
        try {
            var body = fetch(BONUS_ICS_URL, MediaType.ALL).orElse(null);
            if (body == null)
                return Set.of();

            Set<LocalDate> dates = new TreeSet<>();
            var matcher = ICS_DTSTART.matcher(body);
            while (matcher.find()) {
                int year = Integer.parseInt(matcher.group(1));
                if (year != yearWanted)
                    continue;
                try {
                    dates.add(
                            LocalDate.of(year, Integer.parseInt(matcher.group(2)), Integer.parseInt(matcher.group(3))));
                } catch (DateTimeException ignored) {
                }
            }
            log.info("Bonusjegeren ICS gave {} dates for {}: {}", dates.size(), yearWanted, dates);
            return dates;
        } catch (Exception e) {
            log.info("Bonusjegeren ICS error (non-fatal): {}", e.toString());
            return Set.of();
        }
    }

    /**
     * Scrapes kredittkortlisten's date table. Only cells consisting entirely of a
     * weekday + date + year are used, so other tables and prose are ignored.
     */
    private Set<LocalDate> scrapeKredittkortlisten(int yearWanted) {
        try {
            var body = fetch(KREDITTKORT_URL, MediaType.TEXT_HTML).orElse(null);
            if (body == null)
                return Set.of();

            Set<LocalDate> dates = new TreeSet<>();
            for (var td : org.jsoup.Jsoup.parse(body).select("table td")) {
                var matcher = KREDITTKORT_CELL.matcher(td.text().trim());
                if (!matcher.matches())
                    continue;
                int year = Integer.parseInt(matcher.group(3));
                if (year != yearWanted)
                    continue;
                Month month = NO_MONTHS_SHORT.get(matcher.group(2).toLowerCase(Locale.ROOT));
                if (month == null)
                    continue;
                try {
                    dates.add(LocalDate.of(year, month, Integer.parseInt(matcher.group(1))));
                } catch (DateTimeException ignored) {
                }
            }
            log.info("Kredittkortlisten scraped {} dates for {}: {}", dates.size(), yearWanted, dates);
            return dates;
        } catch (Exception e) {
            log.info("Kredittkortlisten scrape error (non-fatal): {}", e.toString());
            return Set.of();
        }
    }

    /**
     * Scrapes the EuroBonusguiden page for a table with headers År / Måned / Dato
     * and returns each target-year date.
     */
    private Set<LocalDate> scrapeEurobonusguiden(int yearWanted) {
        try {
            var body = fetch(URL, MediaType.TEXT_HTML).orElse(null);
            if (body == null)
                return Set.of();

            org.jsoup.nodes.Document doc = org.jsoup.Jsoup.parse(body);

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
                return Set.of();
            }

            Set<LocalDate> out = new TreeSet<>();

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

                try {
                    out.add(LocalDate.of(year, month, day));
                } catch (DateTimeException e) {
                    continue;
                }
            }

            log.info("EuroBonusguiden parsed {} dates for {}: {}", out.size(), yearWanted, out);
            return out;
        } catch (Exception e) {
            log.info("EuroBonusguiden scrape error (non-fatal): {}", e.toString());
            return Set.of();
        }
    }
}
