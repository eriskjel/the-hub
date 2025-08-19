package dev.thehub.backend.widgets.create;

import java.util.Map;

public record CreateWidgetResponse(
        String id,
        String instanceId,
        String kind,
        String title,
        Map<String, Object> grid,
        Map<String, Object> settings
) {}