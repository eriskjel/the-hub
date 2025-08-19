package dev.thehub.backend.widgets.create;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.thehub.backend.widgets.WidgetKind;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class CreateWidgetService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public CreateWidgetService(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.json = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    /**
     * Throws DuplicateTargetException if any target already exists for this user (server-pings only).
     *
     * @return
     */
    public void ensureNoDuplicateTargets(UUID userId, WidgetKind kind, Map<String, Object> settings) {
        var targets = extractTargets(settings);
        if (targets.isEmpty()) throw new IllegalArgumentException("target_required");

        targets = targets.stream().map(CreateWidgetService::normalizeUrl).filter(Objects::nonNull).toList();

        final String dupeSql = """
      select exists (
        select 1
        from user_widgets uw
        where uw.user_id = ?
          and uw.kind = ?
          and (
            (jsonb_exists(uw.settings, 'target') and uw.settings->>'target' = any (?))
            or (jsonb_exists(uw.settings, 'targets') and exists (
                select 1
                from jsonb_array_elements_text(uw.settings->'targets') t(v)
                where t.v = any (?)
            ))
          )
      )
    """;

        List<String> finalTargets = targets;
        var anyExists = Boolean.TRUE.equals(
                jdbc.query(con -> {
                    var ps = con.prepareStatement(dupeSql);
                    ps.setObject(1, userId);
                    ps.setString(2, kind.getValue()); // ← enum → DB string
                    var arr = con.createArrayOf("text", finalTargets.toArray(new String[0]));
                    ps.setArray(3, arr);
                    ps.setArray(4, arr);
                    return ps;
                }, rs -> rs.next() ? rs.getBoolean(1) : Boolean.FALSE)
        );

        if (anyExists) throw new DuplicateTargetException("duplicate_target");
    }

    /** Creates a widget row and returns response. */
    public CreateWidgetResponse create(UUID userId, WidgetKind kind, String title, Map<String, Object> settings, Map<String, Object> grid) {
        final UUID id = UUID.randomUUID();
        final UUID instanceId = UUID.randomUUID();

        Map<String, Object> safeSettings = settings != null ? settings : Map.of();
        Map<String, Object> safeGrid = grid != null ? grid : Map.of("x", 0, "y", 0, "w", 1, "h", 1);

        final String insertSql = """
            insert into user_widgets (id, instance_id, user_id, kind, title, settings, grid)
            values (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)
            """;

        jdbc.update(con -> {
            var ps = con.prepareStatement(insertSql);
            ps.setObject(1, id);
            ps.setObject(2, instanceId);
            ps.setObject(3, userId);
            ps.setString(4, kind.getValue());
            ps.setString(5, title);
            try {
                ps.setString(6, json.writeValueAsString(safeSettings));
                ps.setString(7, json.writeValueAsString(safeGrid));
            } catch (JsonProcessingException e) {
                throw new RuntimeException("Failed to serialize JSON", e);
            }
            return ps;
        });

        return new CreateWidgetResponse(
                id.toString(),
                instanceId.toString(),
                kind,
                title,
                safeGrid,
                safeSettings
        );
    }

    /** Extracts {target} or {targets: []} into a flat list. */
    static List<String> extractTargets(Map<String, Object> settings) {
        if (settings == null) return List.of();
        var out = new ArrayList<String>(2);

        Object single = settings.get("target");
        if (single instanceof String s && !s.isBlank()) out.add(s);

        Object many = settings.get("targets");
        if (many instanceof Iterable<?> it) {
            for (Object o : it) if (o instanceof String s && !s.isBlank()) out.add(s);
        } else if (many != null && many.getClass().isArray()) {
            for (Object o : (Object[]) many) if (o instanceof String s && !s.isBlank()) out.add(s);
        }
        return out;
    }

    /** Domain exception to signal duplicate target(s). */
    public static class DuplicateTargetException extends RuntimeException {
        public DuplicateTargetException(String msg) { super(msg); }
    }

    private static String normalizeUrl(String s) {
        if (s == null) return null;
        s = s.trim();
        // very light normalization; keep it simple for now
        if (s.endsWith("/")) s = s.substring(0, s.length()-1);
        return s;
    }

}


