package dev.thehub.backend.widgets.update;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Widgets")
@RestController
@RequestMapping("/api/widgets")
public class UpdateWidgetController {

    private static final Logger log = LoggerFactory.getLogger(UpdateWidgetController.class);

    private final UpdateWidgetService service;

    /**
     * Constructs the controller handling partial update operations for widgets.
     *
     * @param service
     *            business service that performs validation and persistence
     */
    public UpdateWidgetController(UpdateWidgetService service) {
        this.service = service;
    }

    /**
     * Applies a partial update to a widget owned by the authenticated user.
     *
     * <p>
     * Supported fields in the payload are documented in
     * {@link UpdateWidgetRequest}. The endpoint returns:
     * <ul>
     * <li>200 with the updated widget payload on success.</li>
     * <li>404 if the instance does not exist or is not owned by the user.</li>
     * <li>400 for validation errors (e.g., blank title, invalid JSON).</li>
     * <li>409 if the update would result in a duplicate according to business
     * rules.</li>
     * <li>500 on unexpected errors.</li>
     * </ul>
     */
    @Operation(summary = "Partially update a widget", description = "Updates title, grid, and/or settings for a widget owned by the current user. Null fields are ignored. Settings are merged and nulls are stripped.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Updated", content = @Content(schema = @Schema(implementation = dev.thehub.backend.widgets.create.CreateWidgetResponse.class))),
            @ApiResponse(responseCode = "400", description = "Bad request"),
            @ApiResponse(responseCode = "404", description = "Not found or not owned"),
            @ApiResponse(responseCode = "409", description = "Duplicate according to business rules"),
            @ApiResponse(responseCode = "500", description = "Internal error")})
    @PatchMapping("/{instanceId}")
    public ResponseEntity<?> patch(@Parameter(hidden = true) JwtAuthenticationToken auth, @PathVariable UUID instanceId,
            @RequestBody UpdateWidgetRequest body) {
        final UUID userId = UUID.fromString(auth.getToken().getClaimAsString("sub"));
        log.info("UpdateWidget PATCH start userId={} instanceId={} title?={} settings?={} grid?={}", userId, instanceId,
                body.title() != null, body.settings() != null, body.grid() != null);

        try {
            var resp = service.partialUpdate(userId, instanceId, body);
            log.info("UpdateWidget PATCH ok userId={} instanceId={}", userId, instanceId);
            return ResponseEntity.ok(resp);
        } catch (UpdateWidgetService.NotFoundOrNotOwned e) {
            log.warn("UpdateWidget not_found userId={} instanceId={}", userId, instanceId);
            return ResponseEntity.status(404).body(Map.of("error", "not_found"));
        } catch (IllegalArgumentException e) {
            log.warn("UpdateWidget bad_request userId={} instanceId={} msg={}", userId, instanceId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (UpdateWidgetService.DuplicateException e) {
            log.warn("UpdateWidget duplicate userId={} instanceId={} msg={}", userId, instanceId, e.getMessage());
            return ResponseEntity.status(409).body(Map.of("error", "duplicate", "message", e.getMessage()));
        } catch (Exception e) {
            log.error("UpdateWidget internal_error userId={} instanceId={}", userId, instanceId, e);
            return ResponseEntity.internalServerError().body(Map.of("error", "internal_error"));
        }
    }
}
