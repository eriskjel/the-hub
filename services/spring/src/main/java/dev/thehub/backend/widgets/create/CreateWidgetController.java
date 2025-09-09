package dev.thehub.backend.widgets.create;

import dev.thehub.backend.widgets.WidgetKind;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.net.URI;
import java.util.EnumSet;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller that handles creation of widget instances for the
 * authenticated user.
 *
 * <p>
 * Applies business rules such as supported kinds, per-role restrictions, and
 * duplicate/limit checks before persisting the widget using
 * {@link CreateWidgetService}.
 */
@Tag(name = "Widgets")
@RestController
@RequestMapping("/api/widgets")
public class CreateWidgetController {

    private final CreateWidgetService service;
    private static final Logger log = LoggerFactory.getLogger(CreateWidgetController.class);

    /**
     * Constructs the controller.
     *
     * @param service
     *            service responsible for validation and persistence of widgets
     */
    public CreateWidgetController(CreateWidgetService service) {
        this.service = service;
    }

    /**
     * Creates a new widget for the current user.
     *
     * <p>
     * Supported kinds are currently {@link WidgetKind#SERVER_PINGS} and
     * {@link WidgetKind#GROCERY_DEALS}. Non-admin users may only create
     * grocery-deals widgets and are limited to at most 5 such widgets. Duplicate
     * widgets are rejected based on business rules.
     *
     * @param auth
     *            current JWT authentication (used to derive user id)
     * @param body
     *            creation request payload
     * @return 201 Created with {@link CreateWidgetResponse} on success; 400 for
     *         invalid input; 403 when forbidden by role; 409 when duplicates/limits
     *         are violated
     */
    @Operation(summary = "Create a widget instance", description = "Creates a widget for the current user. Non-admins can only create grocery-deals and countdown; grocery-deals limited to 5 per user.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Created", content = @Content(schema = @Schema(implementation = CreateWidgetResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid input"),
            @ApiResponse(responseCode = "403", description = "Forbidden"),
            @ApiResponse(responseCode = "409", description = "Duplicate or limit reached")})
    @PostMapping
    public ResponseEntity<?> create(@Parameter(hidden = true) JwtAuthenticationToken auth,
            @RequestBody CreateWidgetRequest body) {
        final UUID userId = UUID.fromString(auth.getToken().getClaimAsString("sub"));

        log.info("CreateWidget request received userId={} kind={}", userId, body.kind());

        if (body.kind() == null) {
            log.warn("CreateWidget invalid_request userId={}", userId);
            return ResponseEntity.badRequest().body(Map.of("error", "invalid_request"));
        }

        EnumSet<WidgetKind> supported = EnumSet.of(WidgetKind.SERVER_PINGS, WidgetKind.GROCERY_DEALS,
                WidgetKind.COUNTDOWN);

        if (!supported.contains(body.kind())) {
            log.warn("CreateWidget unsupported_kind userId={} kind={}", userId, body.kind());
            return ResponseEntity.badRequest().body(Map.of("error", "unsupported_kind", "message",
                    "Supported kinds: " + supported.stream().map(WidgetKind::getValue).toList()));
        }

        boolean isAdmin = auth.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);

        if (!isAdmin && body.kind() != WidgetKind.GROCERY_DEALS && body.kind() != WidgetKind.COUNTDOWN) {
            log.warn("CreateWidget forbidden_non_admin userId={} kind={}", userId, body.kind());
            return ResponseEntity.status(403)
                    .body(Map.of("error", "forbidden", "message", "Only admins can create this widget type."));
        }

        if (!isAdmin && body.kind() == WidgetKind.GROCERY_DEALS) {
            int current = service.countByUserAndKind(userId, WidgetKind.GROCERY_DEALS);
            if (current >= 5) {
                log.warn("CreateWidget limit_reached userId={} count={}", userId, current);
                return ResponseEntity.status(409).body(
                        Map.of("error", "limit_reached", "message", "You can have at most 5 grocery-deals widgets."));
            }
        }

        try {
            service.ensureNoDuplicate(userId, body.kind(), body.settings());
            var resp = service.create(userId, body.kind(), body.settings(), body.grid());
            log.info("CreateWidget success userId={} instanceId={} kind={}", userId, resp.instanceId(), body.kind());
            return ResponseEntity.created(URI.create("/api/widgets/" + resp.instanceId())).body(resp);
        } catch (CreateWidgetService.DuplicateException | CreateWidgetService.DuplicateTargetException e) {
            log.warn("CreateWidget duplicate userId={} kind={} msg={}", userId, body.kind(), e.getMessage());
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            log.warn("CreateWidget bad_request userId={} msg={}", userId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("CreateWidget unexpected_error userId={} kind={}", userId, body.kind(), e);
            return ResponseEntity.internalServerError().body(Map.of("error", "internal_error"));
        }
    }
}