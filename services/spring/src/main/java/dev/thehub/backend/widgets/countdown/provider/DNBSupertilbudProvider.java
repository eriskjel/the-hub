package dev.thehub.backend.widgets.countdown.provider;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

/**
 * CountdownProvider that scrapes a public overview of DNB "Supertilbud"
 * campaign windows and returns the next start date as an Instant at start of
 * day in Europe/Oslo.
 */
public class DNBSupertilbudProvider implements CountdownProvider {
    private final RestTemplate http;
    private static final ZoneId ZONE = ZoneId.of("Europe/Oslo");
    private static final String URL = "https://www.rabo.no/1292/dnb-supertilbud-2025-oversikt-over-neste-kampanjer/";

    // "27. februar – 1. mars" OR "11-13. september"
    private static final Pattern TWO_MONTH = Pattern
            .compile("(?i)(\\d{1,2})[\\.-]?\\s*([a-zæøå]+)\\s*[–-]\\s*(\\d{1,2})[\\.-]?\\s*([a-zæøå]+)");
    private static final Pattern ONE_MONTH_RANGE = Pattern
            .compile("(?i)(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\.?\\s*([a-zæøå]+)");

    private static final Map<String, Month> NO_MONTHS = Map.ofEntries(Map.entry("januar", Month.JANUARY),
            Map.entry("februar", Month.FEBRUARY), Map.entry("mars", Month.MARCH), Map.entry("april", Month.APRIL),
            Map.entry("mai", Month.MAY), Map.entry("juni", Month.JUNE), Map.entry("juli", Month.JULY),
            Map.entry("august", Month.AUGUST), Map.entry("september", Month.SEPTEMBER),
            Map.entry("oktober", Month.OCTOBER), Map.entry("november", Month.NOVEMBER),
            Map.entry("desember", Month.DECEMBER));

    public DNBSupertilbudProvider(RestTemplate http) {
        this.http = http;
    }

    @Override
    public String id() {
        return "dnb-supertilbud";
    }

    @Override
    public Optional<Instant> next(Instant now) {
        var wins = scrapeWindows();
        if (wins.isEmpty())
            return Optional.empty();
        return wins.stream().map(s -> s.start.atStartOfDay(ZONE).toInstant()).filter(i -> !i.isBefore(now))
                .min(Comparator.naturalOrder());
    }

    @Override
    public Optional<Instant> previous(Instant now) {
        var wins = scrapeWindows();
        if (wins.isEmpty())
            return Optional.empty();
        return wins.stream().map(s -> s.start.atStartOfDay(ZONE).toInstant()).filter(i -> i.isBefore(now))
                .max(Comparator.naturalOrder());
    }

    private static final class Span {
        final LocalDate start, end;
        Span(LocalDate s, LocalDate e) {
            start = s;
            end = e;
        }
    }

    private List<Span> scrapeWindows() {
        try {
            HttpHeaders h = new HttpHeaders();
            h.setAccept(List.of(MediaType.TEXT_HTML));
            h.set(HttpHeaders.ACCEPT_CHARSET, StandardCharsets.UTF_8.name());
            var resp = http.exchange(URL, HttpMethod.GET, new HttpEntity<>(h), String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null)
                return List.of();
            String html = resp.getBody();
            int year = Year.now(ZONE).getValue();

            var out = new ArrayList<Span>();

            Matcher m1 = TWO_MONTH.matcher(html);
            while (m1.find()) {
                int d1 = Integer.parseInt(m1.group(1));
                Month mA = NO_MONTHS.get(m1.group(2).toLowerCase(Locale.ROOT));
                int d2 = Integer.parseInt(m1.group(3));
                Month mB = NO_MONTHS.get(m1.group(4).toLowerCase(Locale.ROOT));
                if (mA == null || mB == null)
                    continue;
                var s = LocalDate.of(year, mA, d1);
                var e = LocalDate.of(year, mB, d2);
                if (!e.isBefore(s))
                    out.add(new Span(s, e));
            }

            Matcher m2 = ONE_MONTH_RANGE.matcher(html);
            while (m2.find()) {
                int d1 = Integer.parseInt(m2.group(1));
                int d2 = Integer.parseInt(m2.group(2));
                Month mm = NO_MONTHS.get(m2.group(3).toLowerCase(Locale.ROOT));
                if (mm == null)
                    continue;
                var s = LocalDate.of(year, mm, d1);
                var e = LocalDate.of(year, mm, d2);
                if (!e.isBefore(s))
                    out.add(new Span(s, e));
            }

            out.sort(Comparator.comparing(a -> a.start));
            return out;
        } catch (Exception ignore) {
            return List.of();
        }
    }
}