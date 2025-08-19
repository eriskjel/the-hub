package dev.thehub.backend.widgets.create;

import dev.thehub.backend.widgets.WidgetKind;

import java.util.Map;

public record CreateWidgetRequest(
        String title,
        WidgetKind kind,
        Map<String, Object> settings,
        Map<String, Object> grid
) {}
