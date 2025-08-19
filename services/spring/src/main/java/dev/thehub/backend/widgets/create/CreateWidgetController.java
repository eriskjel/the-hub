package dev.thehub.backend.widgets.create;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/widgets")
public class CreateWidgetController {

    private final CreateWidgetService service;

    public CreateWidgetController(CreateWidgetService service) {
        this.service = service;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<?> create(JwtAuthenticationToken auth,
                                    @RequestBody CreateWidgetRequest body) {
        final UUID userId = UUID.fromString(auth.getToken().getClaimAsString("sub"));

        if (body.kind() == null || body.title() == null || body.title().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid_request"));
        }

        if (!"server-pings".equals(body.kind())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "unsupported_kind",
                    "message", "Only 'server-pings' widgets are supported right now."
            ));
        }

        try {
            // enforce per-kind rules
            service.ensureNoDuplicateTargets(userId, body.settings());

            // create
            var resp = service.create(userId, body.kind(), body.title(), body.settings(), body.grid());
            return ResponseEntity.created(URI.create("/api/widgets/" + resp.instanceId())).body(resp);

        } catch (CreateWidgetService.DuplicateTargetException e) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "duplicate_target",
                    "message", "One or more target URLs already exist in your widgets."
            ));
        } catch (IllegalArgumentException e) {
            // e.g. target_required
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
