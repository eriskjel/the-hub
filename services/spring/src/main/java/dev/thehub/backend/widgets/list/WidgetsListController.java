package dev.thehub.backend.widgets.list;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/widgets")
public class WidgetsListController {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public WidgetsListController(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.json = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    /**
     * GET /api/widgets/list
     * Query params:
     *  - kind (optional): filter a single kind, e.g. 'server-pings'
     *  - includeSettings (optional, default true): include full settings JSON
     */
    @GetMapping("/list")
    public List<Map<String, Object>> list(
            JwtAuthenticationToken auth,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false, defaultValue = "true") boolean includeSettings
    ) {
        var userId = UUID.fromString(auth.getToken().getClaimAsString("sub"));

        String sql = """
            select id, instance_id, kind, title, grid, settings
            from user_widgets
            where user_id = ?
            %s
            order by id asc
            """.formatted(kind != null ? "and kind = ?" : "");

        var rows = jdbc.query(sql,
                ps -> {
                    ps.setObject(1, userId);
                    if (kind != null) ps.setString(2, kind);
                },
                (rs, i) -> {
                    Map<String, Object> grid = Map.of();
                    Map<String, Object> settings = Map.of();

                    try {
                        var gridStr = rs.getString("grid");
                        if (gridStr != null && !gridStr.isBlank()) {
                            grid = json.readValue(gridStr, new TypeReference<Map<String, Object>>() {});
                        }
                    } catch (Exception ignored) {}

                    if (includeSettings) {
                        try {
                            var settingsStr = rs.getString("settings");
                            if (settingsStr != null && !settingsStr.isBlank()) {
                                settings = json.readValue(settingsStr, new TypeReference<Map<String, Object>>() {});
                            }
                        } catch (Exception ignored) {}
                    }

                    return Map.of(
                            "id", rs.getString("id"),
                            "instanceId", rs.getObject("instance_id", UUID.class).toString(),
                            "kind", rs.getString("kind"),
                            "title", rs.getString("title"),
                            "grid", grid,
                            "settings", includeSettings ? settings : Map.of()
                    );
                });

        return rows;
    }
}