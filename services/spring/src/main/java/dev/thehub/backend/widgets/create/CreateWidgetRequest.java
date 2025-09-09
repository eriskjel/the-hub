package dev.thehub.backend.widgets.create;

import dev.thehub.backend.widgets.WidgetKind;
import java.util.Map;

/**
 * Request payload for creating a new widget.
 *
 * @param kind
 *            the kind of widget to create (currently supports
 *            {@link WidgetKind#SERVER_PINGS} and
 *            {@link WidgetKind#GROCERY_DEALS})
 * @param settings
 *            arbitrary settings specific to the widget kind (e.g., targets for
 *            pings)
 * @param grid
 *            optional grid configuration for client layout (e.g., x, y, w, h)
 */
public record CreateWidgetRequest(WidgetKind kind, Map<String, Object> settings, Map<String, Object> grid) {
}
