package dev.thehub.backend.widgets.countdown.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

class TrippelTrumfProviderTest {
    private static final ZoneId ZONE = ZoneId.of("Europe/Oslo");
    private static final MediaType HTML = MediaType.parseMediaType("text/html;charset=UTF-8");
    private static final String SECONDARY = "https://bonusjegeren.no/nar-er-det-trippel-trumf/";
    private final int year = Year.now(ZONE).getValue();
    private final RestTemplate http = new RestTemplate();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(http).build();
    private final TrippelTrumfProvider provider = new TrippelTrumfProvider(http);

    @Test
    void parsesEntitiesAndMergesSourcesWithCorrectWindowBoundaries() throws Exception {
        server.expect(requestTo(provider.sourceUrl().orElseThrow()))
                .andRespond(withSuccess(fixture("trippel-primary.html"), HTML));
        server.expect(requestTo(SECONDARY)).andRespond(withSuccess(fixture("trippel-secondary.html"), HTML));
        var before = at(1, 1, 0);
        assertThat(provider.next(before)).contains(at(4, 16, 7));
        assertThat(provider.isTentative(before)).isFalse();
        assertThat(provider.next(at(4, 16, 7))).contains(at(4, 16, 22).minusMillis(1));
        assertThat(provider.validUntil(at(4, 16, 12))).contains(at(4, 16, 22));
        assertThat(provider.next(at(4, 16, 22))).contains(at(9, 24, 7));
        assertThat(provider.isTentative(at(4, 16, 22))).isTrue();
        assertThat(provider.previous(at(4, 16, 22))).contains(at(4, 16, 7));
        server.verify();
    }

    @Test
    void keepsPrimaryDatesAsTentativeWhenSecondaryFails() throws Exception {
        server.expect(requestTo(provider.sourceUrl().orElseThrow()))
                .andRespond(withSuccess(fixture("trippel-primary.html"), HTML));
        server.expect(requestTo(SECONDARY)).andRespond(withServerError());
        assertThat(provider.next(at(1, 1, 0))).contains(at(4, 16, 7));
        assertThat(provider.isTentative(at(1, 1, 0))).isTrue();
        server.verify();
    }

    @Test
    void returnsEmptyWhenBothSourcesFail() {
        server.expect(requestTo(provider.sourceUrl().orElseThrow())).andRespond(withServerError());
        server.expect(requestTo(SECONDARY)).andRespond(withServerError());
        assertThat(provider.next(at(1, 1, 0))).isEmpty();
        assertThat(provider.validUntil(at(1, 1, 0))).isEmpty();
        server.verify();
    }

    private Instant at(int month, int day, int hour) {
        return LocalDate.of(year, month, day).atTime(hour, 0).atZone(ZONE).toInstant();
    }

    private String fixture(String name) throws Exception {
        return new ClassPathResource("fixtures/" + name).getContentAsString(StandardCharsets.UTF_8)
                .replace("{{year}}", Integer.toString(year)).replace("{{previousYear}}", Integer.toString(year - 1));
    }
}
