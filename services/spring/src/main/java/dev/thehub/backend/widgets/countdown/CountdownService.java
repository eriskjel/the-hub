package dev.thehub.backend.widgets.countdown;

import com.fasterxml.jackson.databind.JsonNode;
import dev.thehub.backend.widgets.WidgetRow;
import dev.thehub.backend.widgets.WidgetSettingsService;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Service that resolves countdown data for a widget instance based on its
 * settings.
 * <p>
 * Supported sources in settings JSON (field "source"):
 * <ul>
 * <li>"fixed-date": expects "targetIso" (ISO-8601) and returns it as
 * nextIso.</li>
 * <li>"monthly-rule": uses {@link Monthly} with fields like time, dayOfMonth or
 * byWeekday/bySetPos.</li>
 * <li>"provider": uses a {@code provider} id routed through
 * {@link CountdownResolver}.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class CountdownService {
    private static final Logger log = LoggerFactory.getLogger(CountdownService.class);

    private final WidgetSettingsService settings;
    private final CountdownResolver resolver;

    /**
     * Resolve countdown data for a specific user's widget instance.
     *
     * Reads the widget settings and computes the next and previous instants based
     * on the configured source. Also derives an "ongoing" flag if now is within a
     * plausible window [previous..next].
     *
     * Settings shape highlights:
     * <ul>
     * <li>source = "fixed-date": uses string field "targetIso".</li>
     * <li>source = "monthly-rule": see
     * {@link Monthly#nextOccurrenceIso(java.time.Instant, com.fasterxml.jackson.databind.JsonNode)}.</li>
     * <li>source = "provider": uses string field "provider" matching
     * {@link dev.thehub.backend.widgets.countdown.provider.CountdownProvider#id()}.</li>
     * </ul>
     *
     * @param userId
     *            owner of the widget instance
     * @param instanceId
     *            widget instance identifier
     * @return DTO with server time (nowIso), and optionally nextIso, previousIso
     *         and ongoing flag
     * @throws java.util.NoSuchElementException
     *             if the widget instance does not exist for the user
     */
    public CountdownDto resolve(UUID userId, UUID instanceId) {
        WidgetRow row = settings.requireWidget(userId, instanceId);
        JsonNode s = row.settings();

        String source = s.hasNonNull("source") ? s.get("source").asText() : "";
        Instant now = Instant.now();
        String nextIso = null;
        String previousIso = null;

        String providerName = null;

        switch (source) {
            case "fixed-date" -> {
                nextIso = s.hasNonNull("targetIso") ? s.get("targetIso").asText() : null;
            }
            case "monthly-rule" -> {
                nextIso = Monthly.nextOccurrenceIso(now, s);
            }
            case "provider" -> {
                providerName = s.hasNonNull("provider") ? s.get("provider").asText() : null;
                if (providerName != null && !providerName.isBlank()) {
                    var pair = resolver.resolveProvider(providerName, now);
                    nextIso = Optional.ofNullable(pair.getLeft()).map(Instant::toString).orElse(null);
                    previousIso = Optional.ofNullable(pair.getRight()).map(Instant::toString).orElse(null);
                }
            }
            default -> {
                /* keep nulls */ }
        }

        boolean ongoing = false;
        if (previousIso != null && nextIso != null) {
            Instant prevI = Instant.parse(previousIso);
            Instant nextI = Instant.parse(nextIso);

            boolean inBounds = !now.isBefore(prevI) && !now.isAfter(nextI);

            // Provider-aware maximum plausible window span (moved out of hard-coded switch)
            long capHours = 72; // default for non-provider sources
            if ("provider".equals(source) && providerName != null && !providerName.isBlank()) {
                try {
                    capHours = resolver.plausibleSpanCapHours(providerName);
                } catch (IllegalArgumentException ignored) {
                    // unknown provider id; keep default
                }
            }

            boolean plausible = Duration.between(prevI, nextI).toHours() <= capHours;
            ongoing = inBounds && plausible;
        }

        return new CountdownDto(now.toString(), nextIso, previousIso, ongoing);
    }
}
