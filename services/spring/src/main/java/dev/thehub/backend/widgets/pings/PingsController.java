package dev.thehub.backend.widgets.pings;

import dev.thehub.backend.widgets.WidgetSettingsService;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller that returns server ping results for a specific widget
 * instance.
 */
@RestController
@RequestMapping("/api/widgets")
public class PingsController {

    private final PingsService pings;
    private final WidgetSettingsService settings;

    /**
     * Constructs the controller.
     *
     * @param pings
     *            service used to perform ping probes
     * @param settings
     *            service used to load and parse widget configuration
     */
    public PingsController(PingsService pings, WidgetSettingsService settings) {
        this.pings = pings;
        this.settings = settings;
    }

    /**
     * Gets ping results for the provided widget instance owned by the authenticated
     * user.
     *
     * <p>
     * Authorization: requires role ADMIN.
     *
     * @param auth
     *            current JWT authentication
     * @param instanceId
     *            the widget instance identifier to read configuration from
     * @return a JSON map containing status, data (list of ping results), and
     *         updatedAt timestamp
     */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/server-pings")
    public Map<String, Object> serverPings(JwtAuthenticationToken auth, @RequestParam UUID instanceId) {
        var userId = UUID.fromString(auth.getToken().getClaimAsString("sub"));
        var row = settings.requireWidget(userId, instanceId);
        var cfg = settings.toPings(row);
        var data = pings.getResults(cfg.targets());
        return Map.of("status", "ok", "data", data, "updatedAt", OffsetDateTime.now().toString());
    }
}