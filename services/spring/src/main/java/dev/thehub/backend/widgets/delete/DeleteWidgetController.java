package dev.thehub.backend.widgets.delete;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller responsible for deleting widget instances.
 *
 * <p>
 * Exposes an endpoint to delete a widget by its public instance id. Non-admin
 * users can only delete widgets they own; admins may delete any widget.
 */
@Tag(name = "Widgets")
@RestController
@RequestMapping("/api/widgets")
public class DeleteWidgetController {
    private static final Logger log = LoggerFactory.getLogger(DeleteWidgetController.class);
    private final DeleteWidgetService service;

    /**
     * Constructs the controller.
     *
     * @param service
     *            service component handling deletion logic and data access
     */
    public DeleteWidgetController(DeleteWidgetService service) {
        this.service = service;
    }

    /**
     * Deletes a widget instance by its public instance id.
     *
     * <p>
     * On success no content is returned. If the instance id is not a valid UUID a
     * 400 response is returned. If no widget is deleted (not found or not owned by
     * the requester when not an admin) a 404 response is returned.
     *
     * @param instanceId
     *            the widget instance id (path variable)
     * @param _headers
     *            request headers (unused, reserved for diagnostics)
     * @param auth
     *            current JWT authentication (used to derive requester id and roles)
     * @return 204 No Content on success; 400 for invalid id; 404 when not found
     */
    @Operation(summary = "Delete a widget", description = "Deletes a widget by public instanceId. Non-admins can only delete their own.")
    @ApiResponse(responseCode = "204", description = "Deleted")
    @ApiResponse(responseCode = "404", description = "Not found")
    @ApiResponse(responseCode = "400", description = "Invalid id")
    @DeleteMapping("/{instanceId}")
    public ResponseEntity<?> delete(@PathVariable String instanceId, @RequestHeader Map<String, String> _headers,
            @Parameter(hidden = true) JwtAuthenticationToken auth) {
        final UUID requester = UUID.fromString(auth.getToken().getClaimAsString("sub"));
        final boolean isAdmin = auth.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);

        final UUID iid;
        try {
            iid = UUID.fromString(instanceId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid_id"));
        }

        int affected = service.deleteByInstanceId(requester, isAdmin, iid);
        if (affected == 0) {
            return ResponseEntity.status(404).body(Map.of("error", "not_found"));
        }
        return ResponseEntity.noContent().build();
    }
}
