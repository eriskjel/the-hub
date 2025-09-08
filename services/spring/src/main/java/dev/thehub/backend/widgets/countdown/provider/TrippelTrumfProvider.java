package dev.thehub.backend.widgets.countdown.provider;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.regex.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

/**
 * CountdownProvider that scrapes Trumf's "Trippel Trumf" page to find the next
 * campaign day and returns it as an Instant at start of day in Europe/Oslo.
 */
public class TrippelTrumfProvider implements CountdownProvider {
    private final RestTemplate http;
    private static final ZoneId ZONE = ZoneId.of("Europe/Oslo");
    private static final String URL = "https://www.trumf.no/trippel-trumf";

    // Example: "Torsdag 21. august ..."
    private static final Pattern DATE_PAT = Pattern.compile("(?i)torsdag\\s+(\\d{1,2})\\.\\s*([a-zæøå]+)");

    private static final Map<String, Month> NO_MONTHS = Map.ofEntries(Map.entry("januar", Month.JANUARY),
            Map.entry("februar", Month.FEBRUARY), Map.entry("mars", Month.MARCH), Map.entry("april", Month.APRIL),
            Map.entry("mai", Month.MAY), Map.entry("juni", Month.JUNE), Map.entry("juli", Month.JULY),
            Map.entry("august", Month.AUGUST), Map.entry("september", Month.SEPTEMBER),
            Map.entry("oktober", Month.OCTOBER), Map.entry("november", Month.NOVEMBER),
            Map.entry("desember", Month.DECEMBER));

    /**
     * Creates a provider using the given RestTemplate.
     *
     * @param http
     *            HTTP client used to fetch the page
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
        try {
            HttpHeaders h = new HttpHeaders();
            h.setAccept(List.of(MediaType.TEXT_HTML));
            h.set(HttpHeaders.ACCEPT_CHARSET, StandardCharsets.UTF_8.name());
            var resp = http.exchange(URL, HttpMethod.GET, new HttpEntity<>(h), String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null)
                return Optional.empty();
            Matcher m = DATE_PAT.matcher(resp.getBody());
            if (!m.find())
                return Optional.empty();

            int day = Integer.parseInt(m.group(1));
            Month month = NO_MONTHS.get(m.group(2).toLowerCase(Locale.ROOT));
            if (month == null)
                return Optional.empty();

            int year = ZonedDateTime.now(ZONE).getYear();
            var zdt = LocalDate.of(year, month, day).atTime(0, 0).atZone(ZONE);
            var i = zdt.toInstant();
            return i.isAfter(now) ? Optional.of(i) : Optional.empty();
        } catch (Exception ignore) {
            return Optional.empty();
        }
    }

    @Override
    public Optional<Instant> previous(Instant now) {
        try {
            HttpHeaders h = new HttpHeaders();
            h.setAccept(List.of(MediaType.TEXT_HTML));
            h.set(HttpHeaders.ACCEPT_CHARSET, StandardCharsets.UTF_8.name());
            var resp = http.exchange(URL, HttpMethod.GET, new HttpEntity<>(h), String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null)
                return Optional.empty();

            Matcher m = DATE_PAT.matcher(resp.getBody());
            if (!m.find())
                return Optional.empty();

            int day = Integer.parseInt(m.group(1));
            Month month = NO_MONTHS.get(m.group(2).toLowerCase(Locale.ROOT));
            if (month == null)
                return Optional.empty();

            int year = ZonedDateTime.now(ZONE).getYear();
            Instant when = LocalDate.of(year, month, day).atStartOfDay(ZONE).toInstant();

            // For "previous", only return if that date is before now.
            return when.isBefore(now) ? Optional.of(when) : Optional.empty();
        } catch (Exception ignore) {
            return Optional.empty();
        }
    }
}
