package dev.thehub.backend.widgets.create;

import dev.thehub.backend.widgets.WidgetKind;

import java.util.Map;

/**
 * Request payload for creating a new widget.
 *
 * @param title    the widget title (required, non-blank)
 * @param kind     the kind of widget to create (currently only {@link WidgetKind#SERVER_PINGS} is supported)
 * @param settings arbitrary settings specific to the widget kind (e.g., targets for pings)
 * @param grid     optional grid configuration for client layout (e.g., x, y, w, h)
 */
public record CreateWidgetRequest(
        String title,
        WidgetKind kind,
        Map<String, Object> settings,
        Map<String, Object> grid
) {}
