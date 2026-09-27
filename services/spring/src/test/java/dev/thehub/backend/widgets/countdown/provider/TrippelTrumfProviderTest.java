package dev.thehub.backend.widgets.countdown.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.client.ResponseCreator;
import org.springframework.web.client.RestTemplate;

class TrippelTrumfProviderTest {

    private static final ZoneId OSLO = ZoneId.of("Europe/Oslo");

    private static final String EUROBONUS_HTML = """
            <p>Publisert 27. september 2026</p>
            <table>
              <tr><td>År</td><td>Måned</td><td>Dato</td><td>Hvilken torsdag i mnd?</td><td>Kommentar</td></tr>
              <tr><td>2026</td><td>Januar</td><td>15</td><td>3</td><td></td></tr>
              <tr><td>2026</td><td>Mai (Ekstra)</td><td>?</td><td></td><td>Det var en ekstra 3xT i mai 2025</td></tr>
              <tr><td>2026</td><td>Juni</td><td>18</td><td></td><td></td></tr>
              <tr><td>2026</td><td>Juli</td><td>–</td><td></td><td></td></tr>
              <tr><td>2026</td><td>September</td><td>17</td><td></td><td></td></tr>
              <tr><td>2026</td><td>Oktober</td><td>15</td><td></td><td></td></tr>
              <tr><td>2026</td><td>November</td><td>?</td><td></td><td></td></tr>
              <tr><td>2026</td><td>Desember</td><td>2</td><td></td><td></td></tr>
            </table>
            <table>
              <tr><td>År</td><td>Måned</td><td>Dato</td><td>Hvilken torsdag i mnd?</td><td>Linker</td></tr>
              <tr><td>2025</td><td>Oktober</td><td>16</td><td></td><td></td></tr>
            </table>
            """;

    private static final String BONUSJEGEREN_ICS = """
            BEGIN:VCALENDAR
            VERSION:2.0
            X-WR-TIMEZONE:Europe/Oslo

            BEGIN:VEVENT
            UID:20260625-trippeltrumf@bonusjegeren.no
            DTSTART;VALUE=DATE:20260625
            DTEND;VALUE=DATE:20260626
            SUMMARY:Trippel Trumf Torsdag (Forventet)
            END:VEVENT

            BEGIN:VEVENT
            UID:20260917-trippeltrumf@bonusjegeren.no
            DTSTART;VALUE=DATE:20260917
            DTEND;VALUE=DATE:20260918
            SUMMARY:Trippel Trumf Torsdag (Forventet)
            END:VEVENT

            BEGIN:VEVENT
            UID:20261015-trippeltrumf@bonusjegeren.no
            DTSTART;VALUE=DATE:20261015
            DTEND;VALUE=DATE:20261016
            SUMMARY:Trippel Trumf Torsdag (Forventet)
            END:VEVENT

            BEGIN:VEVENT
            UID:20261112-trippeltrumf@bonusjegeren.no
            DTSTART;VALUE=DATE:20261112
            DTEND;VALUE=DATE:20261113
            SUMMARY:Trippel Trumf Torsdag (Forventet)
            END:VEVENT

            BEGIN:VEVENT
            UID:20261203-trippeltrumf@bonusjegeren.no
            DTSTART;VALUE=DATE:20261203
            DTEND;VALUE=DATE:20261204
            SUMMARY:Trippel Trumf Torsdag (Forventet)
            END:VEVENT

            BEGIN:VEVENT
            UID:20270115-trippeltrumf@bonusjegeren.no
            DTSTART;VALUE=DATE:20270115
            DTEND;VALUE=DATE:20270116
            SUMMARY:Trippel Trumf Torsdag (Forventet)
            END:VEVENT
            END:VCALENDAR
            """.replace("\n", "\r\n");

    private static final String KREDITTKORT_HTML = """
            <p>Sist oppdatert 27. september 2026. Neste er tor. 15. okt. 2026.</p>
            <table>
              <tr><td>tor. 15. okt. 2026</td><td>Om 18 dager</td><td>Kommende</td></tr>
              <tr><td>tor. 12. nov. 2026</td><td>Om 46 dager</td><td>Kommende</td></tr>
              <tr><td>tor. 3. des. 2026</td><td>Om 67 dager</td><td>Kommende</td></tr>
              <tr><td>tor. 17. sep. 2026</td><td>Ferdig</td><td>Ferdig</td></tr>
              <tr><td>tor. 18.&nbsp;juni 2026</td><td>Ferdig</td><td>Ferdig</td></tr>
              <tr><td>tor. 15. jan. 2026</td><td>Ferdig</td><td>Ferdig</td></tr>
              <tr><td>tor. 16. okt. 2025</td><td>Ferdig</td><td>Ferdig</td></tr>
            </table>
            <table>
              <tr><td>Årsavgift</td><td>0 kr</td></tr>
              <tr><td>Rente</td><td>1,90 %</td></tr>
            </table>
            """;

    @Test
    void pageDatesOutsideTheListingsAreIgnored() {
        // Regression: a "last updated" stamp in page text became an ongoing window.
        var now = Instant.parse("2026-09-27T09:48:00Z");
        var p = provider(now, html(EUROBONUS_HTML), ics(BONUSJEGEREN_ICS), html(KREDITTKORT_HTML));

        assertThat(p.next(now)).contains(oslo(2026, 10, 15, 7));
        assertThat(p.isTentative(now)).isFalse();
        assertThat(p.previous(now)).contains(oslo(2026, 9, 17, 7));
        assertThat(p.validUntil(now)).contains(oslo(2026, 10, 15, 7));
    }

    @Test
    void ongoingWindowCountsDownToItsEnd() {
        var now = oslo(2026, 10, 15, 12);
        var p = provider(now, html(EUROBONUS_HTML), ics(BONUSJEGEREN_ICS), html(KREDITTKORT_HTML));

        assertThat(p.next(now)).contains(oslo(2026, 10, 15, 22).minusMillis(1));
        assertThat(p.previous(now)).contains(oslo(2026, 10, 15, 7));
        assertThat(p.validUntil(now)).contains(oslo(2026, 10, 15, 22));
    }

    @Test
    void singleSourceTypoNextToAgreedDateIsDropped() {
        // eurobonusguiden lists Wed 2 Dec; the other two agree on Thu 3 Dec.
        var now = oslo(2026, 11, 20, 12);
        var p = provider(now, html(EUROBONUS_HTML), ics(BONUSJEGEREN_ICS), html(KREDITTKORT_HTML));

        assertThat(p.next(now)).contains(oslo(2026, 12, 3, 7));
        assertThat(p.isTentative(now)).isFalse();
    }

    @Test
    void singleSourceDateIsKeptAsTentative() {
        // Only bonusjegeren has 25 Jun, a week after the agreed 18 Jun.
        var now = oslo(2026, 6, 19, 12);
        var p = provider(now, html(EUROBONUS_HTML), ics(BONUSJEGEREN_ICS), html(KREDITTKORT_HTML));

        assertThat(p.next(now)).contains(oslo(2026, 6, 25, 7));
        assertThat(p.isTentative(now)).isTrue();
    }

    @Test
    void nonThursdayDateIsNotFilteredOut() {
        // Sat 24 Oct from a single source, not near any agreed date.
        var customIcs = BONUSJEGEREN_ICS.replace("20261112", "20261024");
        var now = oslo(2026, 10, 16, 12);
        var p = provider(now, html(EUROBONUS_HTML), ics(customIcs), html(KREDITTKORT_HTML));

        assertThat(p.next(now)).contains(oslo(2026, 10, 24, 7));
        assertThat(p.isTentative(now)).isTrue();
    }

    @Test
    void failingSourceFallsBackToTheOthers() {
        var now = Instant.parse("2026-09-27T09:48:00Z");
        var p = provider(now, withServerError(), ics(BONUSJEGEREN_ICS), html(KREDITTKORT_HTML));

        assertThat(p.next(now)).contains(oslo(2026, 10, 15, 7));
        assertThat(p.isTentative(now)).isFalse();
    }

    @Test
    void yearFilterDropsOtherYears() {
        // After the last 2026 date there is nothing; 2027 guesses and 2025 rows are
        // ignored.
        var now = oslo(2026, 12, 10, 12);
        var p = provider(now, html(EUROBONUS_HTML), ics(BONUSJEGEREN_ICS), html(KREDITTKORT_HTML));

        assertThat(p.next(now)).isEmpty();
        assertThat(p.previous(now)).contains(oslo(2026, 12, 3, 7));
    }

    @Test
    void eurobonusguidenSkipsOtherTablesInvalidDatesAndOtherYears() throws Exception {
        // Only 16 Apr is valid; it is tentative because the other sources fail.
        var now = oslo(2026, 1, 1, 0);
        var p = provider(now, html(fixture("trippel-primary.html", 2026)), withServerError(), withServerError());

        assertThat(p.next(now)).contains(oslo(2026, 4, 16, 7));
        assertThat(p.isTentative(now)).isTrue();
        assertThat(p.next(oslo(2026, 4, 16, 22))).isEmpty();
        assertThat(p.previous(oslo(2026, 4, 16, 22))).contains(oslo(2026, 4, 16, 7));
    }

    @Test
    void returnsEmptyWhenAllSourcesFail() {
        var now = oslo(2026, 1, 1, 0);
        var p = provider(now, withServerError(), withServerError(), withServerError());

        assertThat(p.next(now)).isEmpty();
        assertThat(p.validUntil(now)).isEmpty();
    }

    private static String fixture(String name, int year) throws Exception {
        return new ClassPathResource("fixtures/" + name).getContentAsString(StandardCharsets.UTF_8)
                .replace("{{year}}", Integer.toString(year)).replace("{{previousYear}}", Integer.toString(year - 1));
    }

    private static TrippelTrumfProvider provider(Instant now, ResponseCreator eurobonus, ResponseCreator bonusjegeren,
            ResponseCreator kredittkort) {
        var http = new RestTemplate();
        var server = MockRestServiceServer.bindTo(http).ignoreExpectOrder(true).build();
        server.expect(requestTo(startsWith("https://eurobonusguiden.no/"))).andRespond(eurobonus);
        server.expect(requestTo(startsWith("https://bonusjegeren.no/"))).andRespond(bonusjegeren);
        server.expect(requestTo(startsWith("https://www.kredittkortlisten.no/"))).andRespond(kredittkort);
        return new TrippelTrumfProvider(http, Clock.fixed(now, ZoneOffset.UTC));
    }

    private static ResponseCreator html(String body) {
        return withSuccess(body, new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8));
    }

    private static ResponseCreator ics(String body) {
        return withSuccess(body, MediaType.TEXT_PLAIN);
    }

    private static Instant oslo(int year, int month, int day, int hour) {
        return LocalDate.of(year, month, day).atTime(hour, 0).atZone(OSLO).toInstant();
    }
}
