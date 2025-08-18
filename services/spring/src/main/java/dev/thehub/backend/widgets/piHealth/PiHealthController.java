package dev.thehub.backend.widgets.piHealth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/widgets")
public class PiHealthController {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json = new ObjectMapper();

    public PiHealthController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/pi-health")
    public Map<String, Object> piHealth(JwtAuthenticationToken auth, @RequestParam UUID instanceId) {
        var userId = UUID.fromString(auth.getToken().getClaimAsString("sub"));

        // 1) read deviceId from this widget instance
        UUID deviceId = jdbc.query("""
            select (settings->>'deviceId')::uuid as device_id
            from user_widgets
            where user_id = ? and kind = 'pi-health' and instance_id = ?
            limit 1
            """,
                ps -> { ps.setObject(1, userId); ps.setObject(2, instanceId); },
                rs -> rs.next() ? rs.getObject("device_id", UUID.class) : null
        );

        if (deviceId == null) {
            return Map.of("status","ok","data", List.of(), "updatedAt", OffsetDateTime.now().toString());
        }

        // 2) fetch latest metrics for that device (enforce ownership)
        var list = jdbc.query("""
            select d.id as device_id,
                   d.name,
                   coalesce(m.updated_at, d.created_at) as last_seen,
                   m.snapshot,
                   m.updated_at
            from pi_devices d
            left join pi_metrics_latest m on m.device_id = d.id
            where d.user_id = ? and d.id = ?
            """,
                ps -> { ps.setObject(1, userId); ps.setObject(2, deviceId); },
                (rs, i) -> {
                    UUID devId = rs.getObject("device_id", UUID.class);
                    String name = rs.getString("name");
                    OffsetDateTime lastSeen = rs.getObject("last_seen", OffsetDateTime.class);
                    String snapshotJson = rs.getString("snapshot"); // JSON text or null
                    OffsetDateTime updatedAt = rs.getObject("updated_at", OffsetDateTime.class);

                    Map<String, Object> snapshot = null;
                    try {
                        if (snapshotJson != null) snapshot = json.readValue(snapshotJson, Map.class);
                    } catch (Exception ignored) {}

                    return Map.of(
                            "deviceId", devId,
                            "name", name,
                            "lastSeen", lastSeen,
                            "snapshot", snapshot,      // pass through whatever your agent sends
                            "ts", updatedAt
                    );
                }
        );

        return Map.of("status","ok","data", list, "updatedAt", OffsetDateTime.now().toString());
    }
}
