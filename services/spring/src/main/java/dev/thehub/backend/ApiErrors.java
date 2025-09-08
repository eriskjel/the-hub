package dev.thehub.backend;

import dev.thehub.backend.widgets.WidgetSettingsService;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);

    @ExceptionHandler(WidgetSettingsService.NotFoundOrNotOwned.class)
    ResponseEntity<?> widgetMissing() {
        return ResponseEntity.status(404).body(Map.of("error", "not_found"));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> badJson(HttpMessageNotReadableException e) {
        Throwable cause = e.getMostSpecificCause();
        String code = (cause instanceof IllegalArgumentException iae) ? iae.getMessage() : "bad_request";
        log.warn("Bad JSON payload: {}", code);
        return ResponseEntity.badRequest().body(Map.of("error", code, "message", "Invalid request payload"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> illegalArg(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
}
