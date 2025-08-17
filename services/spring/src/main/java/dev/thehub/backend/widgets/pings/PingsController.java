package dev.thehub.backend.widgets.pings;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import com.fasterxml.jackson.core.type.TypeReference;


import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/widgets")
public class PingsController {

    private final PingsService pings;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json = new ObjectMapper();

    public PingsController(PingsService pings, JdbcTemplate jdbc) {
        this.pings = pings;
        this.jdbc = jdbc;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/server-pings")
    public Map<String, Object> serverPings(
            JwtAuthenticationToken auth,
            @RequestParam UUID instanceId
    ) {
        var userId = UUID.fromString(auth.getToken().getClaimAsString("sub"));



        // read ONE instance belonging to this user
        var row = jdbc.query("""
        select settings
        from user_widgets
        where user_id = ? and kind = 'server-pings' and instance_id = ?
        limit 1
        """,
                ps -> { ps.setObject(1, userId); ps.setObject(2, instanceId); },
                rs -> rs.next() ? rs.getString("settings") : null
        );

        // default if missing
        List<String> targets = List.of("http://localhost:8080/actuator/health");

        if (row != null) {
            try {
                var node = json.readTree(row);
                // support both "target" and "targets"
                if (node.hasNonNull("target")) {
                    targets = List.of(node.get("target").asText());
                } else if (node.hasNonNull("targets")) {
                    List<String> parsed = json.convertValue(node.get("targets"),
                            new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
                    var safe = parsed.stream()
                            .filter(u -> u.startsWith("http://") || u.startsWith("https://"))
                            .toList();
                    if (!safe.isEmpty()) targets = safe;
                }
            } catch (Exception ignored) {}
        }

        var data = pings.getResults(targets);
        return Map.of("status","ok","data",data,"updatedAt", OffsetDateTime.now().toString());
    }

}
