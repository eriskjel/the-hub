package dev.thehub.backend.widgets;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;

/**
 * Database row model for a user's widget.
 *
 * @param id
 *            database identifier (UUID)
 * @param instanceId
 *            stable client-facing identifier (UUID)
 * @param kind
 *            widget kind as stored in DB (e.g., "server-pings")
 * @param title
 *            widget title
 * @param grid
 *            grid/layout configuration as JSON
 * @param settings
 *            widget settings JSON specific to its kind
 */
public record WidgetRow(UUID id, UUID instanceId, String kind, String title, JsonNode grid, JsonNode settings) {
}