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
 * Service that resolves the next countdown target based on the widget's
 * settings. It supports fixed ISO target dates, a monthly rule, or external
 * providers.
 */
@Service
@RequiredArgsConstructor
public class CountdownService {
    private static final Logger log = LoggerFactory.getLogger(CountdownService.class);

    private final WidgetSettingsService settings;
    private final CountdownResolver resolver;

    /**
     * Resolves the widget into a DTO containing the current server time and the
     * next/previous targets when configured.
     *
     * <p>
     * Supported sources in settings:
     * <ul>
     * <li>fixed-date: uses the provided ISO timestamp as next target</li>
     * <li>monthly-rule: uses a computed next occurrence based on rule</li>
     * <li>provider: delegates to a registered CountdownProvider</li>
     * </ul>
     *
     * @param userId
     *            owner of the widget
     * @param instanceId
     *            widget instance id
     * @return DTO with nowIso, nextIso, previousIso and derived ongoing flag
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

            // Provider-aware maximum plausible window span
            long capHours;
            if ("provider".equals(source)) {
                capHours = switch (providerName) {
                    case "trippel-trumf" -> 36; // 07–22 same day (+ buffer)
                    case "dnb-supertilbud" -> 240; // up to ~10 days campaigns
                    default -> 72; // sane default
                };
            } else {
                capHours = 72;
            }

            boolean plausible = Duration.between(prevI, nextI).toHours() <= capHours;
            ongoing = inBounds && plausible;
        }

        return new CountdownDto(now.toString(), nextIso, previousIso, ongoing);
    }
}
