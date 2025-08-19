package dev.thehub.backend.widgets.pings;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.thehub.backend.widgets.WidgetKind;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller that returns server ping results for a specific widget
 * instance.
 */
@RestController
@RequestMapping("/api/widgets")
public class PingsController {

    private final PingsService pings;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json = new ObjectMapper();

    /**
     * Constructs the controller.
     *
     * @param pings
     *            service used to perform ping probes
     * @param jdbc
     *            JDBC template used to load widget configuration
     */
    public PingsController(PingsService pings, JdbcTemplate jdbc) {
        this.pings = pings;
        this.jdbc = jdbc;
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

        // read ONE instance belonging to this user
        var row = jdbc.query("""
                select settings
                from user_widgets
                where user_id = ? and kind = ? and instance_id = ?
                limit 1
                """, ps -> {
            ps.setObject(1, userId);
            ps.setString(2, WidgetKind.SERVER_PINGS.getValue());
            ps.setObject(3, instanceId);
        }, rs -> rs.next() ? rs.getString("settings") : null);

        // default if missing
        List<String> targets = List.of("http://localhost:8080/actuator/health");

        if (row != null) {
            try {
                var node = json.readTree(row);
                // support both "target" and "targets"
                if (node.hasNonNull("target")) {
                    targets = List.of(node.get("target").asText());
                } else if (node.hasNonNull("targets")) {
                    List<String> parsed = json.convertValue(node.get("targets"), new TypeReference<List<String>>() {
                    });
                    var safe = parsed.stream().filter(u -> u.startsWith("http://") || u.startsWith("https://"))
                            .toList();
                    if (!safe.isEmpty())
                        targets = safe;
                }
            } catch (Exception ignored) {
            }
        }

        var data = pings.getResults(targets);
        return Map.of("status", "ok", "data", data, "updatedAt", OffsetDateTime.now().toString());
    }
}
