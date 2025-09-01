package dev.thehub.backend;

import dev.thehub.backend.widgets.WidgetSettingsService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(WidgetSettingsService.NotFoundOrNotOwned.class)
    ResponseEntity<?> widgetMissing() {
        return ResponseEntity.status(404).body(Map.of("error", "not_found"));
    }
}