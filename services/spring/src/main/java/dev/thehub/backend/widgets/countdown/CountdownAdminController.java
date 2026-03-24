package dev.thehub.backend.widgets.countdown;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;

/**
 * Admin endpoints for managing countdown provider cache state. Requires
 * ROLE_ADMIN (enforced by SecurityConfig path rule and @Secured).
 */
@RestController
@RequestMapping("/api/admin/widgets/countdown")
@RequiredArgsConstructor
@Secured("ROLE_ADMIN")
public class CountdownAdminController {

    private final ProviderCacheDao cache;

    /** Returns the current cache row for the given provider. */
    @GetMapping("/status")
    public ResponseEntity<?> status(@RequestParam String providerId) {
        return cache.find(providerId).<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Mark the provider's current next date as admin-confirmed (removes tentative
     * badge).
     */
    @PostMapping("/confirm")
    public ResponseEntity<Map<String, Object>> confirm(@RequestParam String providerId) {
        if (cache.confirm(providerId) == 0)
            return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("providerId", providerId, "adminConfirmed", true));
    }

    /** Remove the admin confirmation, reverting to computed tentative state. */
    @DeleteMapping("/confirm")
    public ResponseEntity<Map<String, Object>> unconfirm(@RequestParam String providerId) {
        if (cache.unconfirm(providerId) == 0)
            return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("providerId", providerId, "adminConfirmed", false));
    }
}
