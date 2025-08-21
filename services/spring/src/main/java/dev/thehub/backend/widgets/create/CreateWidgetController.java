package dev.thehub.backend.widgets.create;

import dev.thehub.backend.widgets.WidgetKind;
import java.net.URI;
import java.util.EnumSet;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/widgets")
public class CreateWidgetController {

    private final CreateWidgetService service;

    public CreateWidgetController(CreateWidgetService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<?> create(JwtAuthenticationToken auth, @RequestBody CreateWidgetRequest body) {
        final UUID userId = UUID.fromString(auth.getToken().getClaimAsString("sub"));

        if (body.kind() == null || body.title() == null || body.title().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid_request"));
        }

        // Only allow kinds you actually support right now
        EnumSet<WidgetKind> supported = EnumSet.of(WidgetKind.SERVER_PINGS, WidgetKind.GROCERY_DEALS);
        if (!supported.contains(body.kind())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "unsupported_kind",
                    "message", "Supported kinds: " + supported.stream().map(WidgetKind::getValue).toList()
            ));
        }

        boolean isAdmin = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);

        // Non-admins: only grocery-deals
        if (!isAdmin && body.kind() != WidgetKind.GROCERY_DEALS) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "forbidden",
                    "message", "Only admins can create this widget type."
            ));
        }

        // Non-admins: cap grocery-deals at 5
        if (!isAdmin && body.kind() == WidgetKind.GROCERY_DEALS) {
            int current = service.countByUserAndKind(userId, WidgetKind.GROCERY_DEALS);
            if (current >= 5) {
                return ResponseEntity.status(409).body(Map.of(
                        "error", "limit_reached",
                        "message", "You can have at most 5 grocery-deals widgets."
                ));
            }
        }

        try {
            service.ensureNoDuplicate(userId, body.kind(), body.settings());
            var resp = service.create(userId, body.kind(), body.title(), body.settings(), body.grid());
            return ResponseEntity.created(URI.create("/api/widgets/" + resp.instanceId())).body(resp);
        } catch (CreateWidgetService.DuplicateException | CreateWidgetService.DuplicateTargetException e) {
            return ResponseEntity.status(409).body(Map.of("error", "duplicate", "message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}