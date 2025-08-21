package dev.thehub.backend.widgets;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import dev.thehub.backend.widgets.groceries.dto.GroceryDealsSettings;
import dev.thehub.backend.widgets.pings.PingsSettings;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Service that loads widget rows and converts their JSON settings into typed
 * settings objects used by individual widgets.
 */
@Service
public class WidgetSettingsService {

    private final WidgetSettingsRepository repo;

    /**
     * Creates a new settings service backed by the provided repository.
     *
     * @param repo
     *            repository used to fetch widget rows
     */
    public WidgetSettingsService(WidgetSettingsRepository repo) {
        this.repo = repo;
    }

    /**
     * Loads a widget owned by the given user or throws if not found.
     *
     * @param userId
     *            owner id
     * @param instanceId
     *            widget instance id
     * @return the widget row
     * @throws IllegalArgumentException
     *             if not found or not owned by the user
     */
    public WidgetRow requireWidget(UUID userId, UUID instanceId) {
        return repo.findWidget(userId, instanceId)
                .orElseThrow(() -> new IllegalArgumentException("Widget not found or not owned by user"));
    }

    /**
     * Converts a generic widget row into {@link GroceryDealsSettings}.
     *
     * <p>
     * Extracts known grocery parameters from the settings JSON. Values may be null
     * if not present. Blank query defaults to an empty string.
     *
     * @param row
     *            source widget row
     * @return grocery settings derived from the row
     */
    public GroceryDealsSettings toGrocery(WidgetRow row) {
        // you may check kind if you want strictness:
        // if (!"grocery-deals".equals(row.kind())) throw new
        // IllegalArgumentException("Wrong kind");
        JsonNode s = row.settings();
        String query = optText(s, "query", "");
        Integer maxResults = optInt(s, "maxResults");
        String city = optText(s, "city", null);
        Double lat = optDouble(s, "lat");
        Double lon = optDouble(s, "lon");
        return new GroceryDealsSettings(query, maxResults, city, lat, lon);
    }

    /**
     * Converts a generic widget row into {@link PingsSettings}.
     *
     * <p>
     * Supports both a single "target" and an array of "targets". Invalid entries
     * are filtered out and duplicates removed. If no valid targets are present, a
     * sensible localhost default is provided.
     *
     * @param row
     *            source widget row
     * @return pings settings derived from the row
     */
    public PingsSettings toPings(WidgetRow row) {
        JsonNode s = row.settings();
        List<String> targets = new ArrayList<>();

        // support both "target" and "targets"
        String single = optText(s, "target", null);
        if (single != null)
            targets.add(single);

        JsonNode arr = s.get("targets");
        if (arr instanceof ArrayNode an) {
            List<String> finalTargets = targets;
            an.forEach(n -> {
                if (n.isTextual())
                    finalTargets.add(n.asText());
            });
        }

        // sanitize
        targets = targets.stream().filter(u -> u.startsWith("http://") || u.startsWith("https://")).distinct().toList();

        if (targets.isEmpty()) {
            targets = List.of("http://localhost:8080/actuator/health");
        }

        return new PingsSettings(targets);
    }

    // helpers
    private static String optText(JsonNode n, String field, String def) {
        return (n != null && n.hasNonNull(field)) ? n.get(field).asText() : def;
    }
    private static Integer optInt(JsonNode n, String field) {
        return (n != null && n.hasNonNull(field)) ? n.get(field).asInt() : null;
    }
    private static Double optDouble(JsonNode n, String field) {
        return (n != null && n.hasNonNull(field)) ? n.get(field).asDouble() : null;
    }
}
