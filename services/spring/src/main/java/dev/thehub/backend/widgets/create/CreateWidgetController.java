package dev.thehub.backend.widgets.create;

import dev.thehub.backend.widgets.WidgetKind;
import java.net.URI;
import java.util.EnumSet;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for creating widget instances for the authenticated user.
 * Currently supports creating widgets of kind {@link WidgetKind#SERVER_PINGS}
 * only.
 */
@RestController
@RequestMapping("/api/widgets")
public class CreateWidgetController {

    private final CreateWidgetService service;

    /**
     * Creates a new instance of the controller.
     *
     * @param service
     *            business service used to validate and create widgets
     */
    public CreateWidgetController(CreateWidgetService service) {
        this.service = service;
    }

    /**
     * Creates a new widget for the authenticated user. Authorization: requires role
     * ADMIN.
     *
     * @param auth
     *            the JWT authentication containing the user subject (sub)
     * @param body
     *            the request payload with title, kind, settings and grid
     * @return 201 Created with {@link CreateWidgetResponse} body on success; 400
     *         Bad Request for invalid input or unsupported kind; 409 Conflict if a
     *         duplicate target exists for the user and kind.
     */
    @PostMapping
    public ResponseEntity<?> create(JwtAuthenticationToken auth, @RequestBody CreateWidgetRequest body) {
        final UUID userId = UUID.fromString(auth.getToken().getClaimAsString("sub"));

        if (body.kind() == null || body.title() == null || body.title().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid_request"));
        }

        EnumSet<WidgetKind> supported = EnumSet.of(WidgetKind.SERVER_PINGS, WidgetKind.GROCERY_DEALS);
        if (!supported.contains(body.kind())) {
            return ResponseEntity.badRequest().body(Map.of("error", "unsupported_kind", "message",
                    "Supported kinds: " + supported.stream().map(WidgetKind::getValue).toList()));
        }

        boolean isAdmin = auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet())
                .contains("ROLE_ADMIN");

        // Non-admins: only grocery-deals
        if (!isAdmin && body.kind() != WidgetKind.GROCERY_DEALS) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "forbidden", "message", "Only admins can create this widget type."));
        }

        if (!isAdmin) {
            int current = service.countByUserAndKind(userId, WidgetKind.GROCERY_DEALS);
            if (current >= 5) {
                return ResponseEntity.status(409).body(
                        Map.of("error", "limit_reached", "message", "You can have at most 5 grocery-deals widgets."));
            }
        }

        // Cap: non-admins max 5 grocery-deals
        if (!isAdmin) {
            int current = service.countByUserAndKind(userId, WidgetKind.GROCERY_DEALS);
            if (current >= 5) {
                return ResponseEntity.status(409).body(
                        Map.of("error", "limit_reached", "message", "You can have at most 5 grocery-deals widgets."));
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
