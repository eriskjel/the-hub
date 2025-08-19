package dev.thehub.backend.widgets.create;

import java.util.Map;

public record CreateWidgetRequest(
        String title,
        String kind,
        Map<String, Object> settings,
        Map<String, Object> grid
) {}
