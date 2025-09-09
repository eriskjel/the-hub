package dev.thehub.backend.widgets.create;

import dev.thehub.backend.widgets.WidgetKind;
import java.util.Map;

/**
 * Response payload returned after creating a widget.
 *
 * @param id
 *            database identifier of the widget (UUID string)
 * @param instanceId
 *            client-facing instance identifier (UUID string)
 * @param kind
 *            the widget kind
 * @param grid
 *            the stored grid configuration
 * @param settings
 *            the stored settings
 */
public record CreateWidgetResponse(String id, String instanceId, WidgetKind kind, Map<String, Object> grid,
        Map<String, Object> settings) {
}
