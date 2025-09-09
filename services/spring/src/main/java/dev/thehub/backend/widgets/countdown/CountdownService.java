package dev.thehub.backend.widgets.countdown;

import com.fasterxml.jackson.databind.JsonNode;
import dev.thehub.backend.widgets.WidgetRow;
import dev.thehub.backend.widgets.WidgetSettingsService;
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
     * Resolves the widget into a DTO containing the current time and the next
     * target (if any).
     *
     * @param userId
     *            owner of the widget
     * @param instanceId
     *            widget instance id
     * @return DTO with nowIso and nextIso values
     */
    public CountdownDto resolve(UUID userId, UUID instanceId) {
        WidgetRow row = settings.requireWidget(userId, instanceId);
        JsonNode s = row.settings();

        String source = (s.hasNonNull("source") ? s.get("source").asText() : "");
        Instant now = Instant.now();
        String nextIso = null;
        String previousIso = null;

        switch (source) {
            case "fixed-date" -> {
                nextIso = s.hasNonNull("targetIso") ? s.get("targetIso").asText() : null;
            }
            case "monthly-rule" -> {
                nextIso = Monthly.nextOccurrenceIso(now, s);
            }
            case "provider" -> {
                String provider = s.hasNonNull("provider") ? s.get("provider").asText() : null;
                if (provider != null && !provider.isBlank()) {
                    var pair = resolver.resolveProvider(provider, now);
                    nextIso = Optional.ofNullable(pair.getLeft()).map(Instant::toString).orElse(null);
                    previousIso = Optional.ofNullable(pair.getRight()).map(Instant::toString).orElse(null);
                }
            }
            default -> {
                /* keep nulls */ }
        }

        return new CountdownDto(now.toString(), nextIso, previousIso);
    }
}
