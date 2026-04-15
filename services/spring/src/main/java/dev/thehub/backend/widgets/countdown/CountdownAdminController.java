package dev.thehub.backend.widgets.countdown;

import dev.thehub.backend.widgets.countdown.provider.ProviderRegistry;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
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
    private final CountdownResolver resolver;
    private final ProviderRegistry registry;

    /**
     * Returns the resolver's current view for the given provider (respects
     * denied-date filtering and cache staleness, so the admin UI sees what end
     * users will see after a deny/undeny).
     */
    @GetMapping("/status")
    public ResponseEntity<?> status(@RequestParam String providerId) {
        try {
            var r = resolver.resolveProvider(providerId, Instant.now());
            // HashMap allows null values — nextIso/previousIso may be absent.
            // r.verified() is the resolver's truth (covers manual overrides,
            // which bypass the adminConfirmed cache column).
            Map<String, Object> body = new HashMap<>();
            body.put("providerId", providerId);
            body.put("nextIso", r.next() == null ? null : r.next().toString());
            body.put("previousIso", r.previous() == null ? null : r.previous().toString());
            body.put("tentative", r.tentative());
            body.put("adminConfirmed", r.verified());
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
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

    /** List dates an admin has flagged as incorrect for this provider. */
    @GetMapping("/denied")
    public ResponseEntity<List<ProviderCacheDao.DeniedRow>> listDenied(@RequestParam String providerId) {
        return ResponseEntity.ok(cache.listDenied(providerId));
    }

    /**
     * Flag an upcoming date as incorrect so the resolver picks the next candidate.
     * The date is the Oslo-local date of the rejected occurrence.
     */
    @PostMapping("/denied")
    public ResponseEntity<Map<String, Object>> deny(@RequestParam String providerId,
            @RequestParam("date") String isoDate, @RequestParam(value = "reason", required = false) String reason) {
        if (!isKnownProvider(providerId))
            return ResponseEntity.notFound().build();
        LocalDate date;
        try {
            date = LocalDate.parse(isoDate);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid_date"));
        }
        cache.deny(providerId, date, reason);
        cache.invalidate(providerId);
        return ResponseEntity.ok(Map.of("providerId", providerId, "deniedDate", date.toString()));
    }

    /** Remove a previously denied date. */
    @DeleteMapping("/denied")
    public ResponseEntity<Map<String, Object>> undeny(@RequestParam String providerId,
            @RequestParam("date") String isoDate) {
        if (!isKnownProvider(providerId))
            return ResponseEntity.notFound().build();
        LocalDate date;
        try {
            date = LocalDate.parse(isoDate);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid_date"));
        }
        int removed = cache.undeny(providerId, date);
        if (removed == 0)
            return ResponseEntity.notFound().build();
        cache.invalidate(providerId);
        return ResponseEntity.ok(Map.of("providerId", providerId, "deniedDate", date.toString()));
    }

    private boolean isKnownProvider(String providerId) {
        try {
            registry.get(providerId);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
