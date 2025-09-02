package dev.thehub.backend.widgets.update;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

/**
 * Request payload for partially updating a widget.
 *
 * <p>
 * All fields are optional. Any non-null value will be applied:
 * <ul>
 * <li>title — new title; if provided, it must not be blank after trimming.</li>
 * <li>settings — partial settings to merge into existing settings (null values
 * are stripped).</li>
 * <li>grid — full grid object to replace the existing one.</li>
 * </ul>
 */
public record UpdateWidgetRequest(
        @Schema(description = "New title; if provided, must not be blank after trimming") String title,
        @Schema(description = "Partial settings to merge into existing settings; nulls are stripped") Map<String, Object> settings,
        @Schema(description = "Full grid object to replace the existing one") Map<String, Object> grid) {
}