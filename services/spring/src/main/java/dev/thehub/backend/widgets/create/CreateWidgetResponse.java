package dev.thehub.backend.widgets.create;

import dev.thehub.backend.widgets.WidgetKind;

import java.util.Map;

public record CreateWidgetResponse(
        String id,
        String instanceId,
        WidgetKind kind,
        String title,
        Map<String, Object> grid,
        Map<String, Object> settings
) {}