package dev.thehub.backend.widgets.create;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.thehub.backend.widgets.WidgetKind;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Service responsible for creating user widgets and enforcing business
 * constraints around widget targets. Responsibilities:
 *
 * <ul>
 * <li>Persisting newly created widgets into the database.
 * <li>Preventing duplicate target URLs for the same user and widget kind.
 * <li>Serializing settings and grid configuration to JSON for storage.
 * </ul>
 *
 * The service uses Spring's JdbcTemplate for persistence and Jackson's
 * ObjectMapper for JSON handling.
 */
@Service
public class CreateWidgetService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    /**
     * Constructs the CreateWidgetService.
     *
     * @param jdbc
     *            JdbcTemplate used to execute SQL statements. Must not be null.
     * @param objectMapper
     *            Optional ObjectMapper used for JSON serialization of settings and
     *            grid. If null is provided, a new default ObjectMapper will be
     *            created.
     */
    public CreateWidgetService(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.json = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    public void ensureNoDuplicate(UUID userId, WidgetKind kind, Map<String, Object> settings) {
        switch (kind) {
            case SERVER_PINGS -> ensureNoDuplicateTargets(userId, kind, settings);
            case GROCERY_DEALS -> ensureNoDuplicateGroceries(userId, kind, settings);
            default -> throw new IllegalArgumentException("unsupported_kind");
        }
    }

    private void ensureNoDuplicateGroceries(UUID userId, WidgetKind kind, Map<String, Object> settings) {
        if (settings == null)
            throw new IllegalArgumentException("settings_required");

        String query = optString(settings.get("query"));
        String city = optString(settings.get("city")); // optional but useful for scoping

        if (query == null || query.isBlank())
            throw new IllegalArgumentException("query_required");

        // Normalize key parts
        String qNorm = query.trim().toLowerCase(Locale.ROOT);
        String cNorm = city == null ? null : city.trim().toLowerCase(Locale.ROOT);

        // Consider two groceries widgets duplicates if same (query, city) for the same
        // user.
        // Tune as you like (you can also include lat/lon rounding).
        final String dupeSql = """
                    select exists (
                      select 1
                      from user_widgets uw
                      where uw.user_id = ?
                        and uw.kind = ?
                        and lower(uw.settings->>'query') = ?
                        and (
                             (? is null and jsonb_exists(uw.settings, 'city') = false)
                          or (? is not null and lower(uw.settings->>'city') = ?)
                        )
                    )
                """;

        boolean exists = Boolean.TRUE.equals(jdbc.query(con -> {
            var ps = con.prepareStatement(dupeSql);
            ps.setObject(1, userId);
            ps.setString(2, kind.getValue());
            ps.setString(3, qNorm);
            ps.setString(4, cNorm);
            ps.setString(5, cNorm);
            ps.setString(6, cNorm);
            return ps;
        }, rs -> rs.next() && rs.getBoolean(1)));

        if (exists)
            throw new DuplicateException("A groceries widget with the same query/city already exists.");
    }

    /**
     * Ensures that no duplicate target URLs exist for the given user and widget
     * kind.
     *
     * <p>
     * This method extracts target values from the provided settings map (supporting
     * either a single "target" or multiple "targets") and applies lightweight URL
     * normalization (e.g., trimming and removing a trailing slash). It then checks
     * the database to determine whether any of those targets already exist for the
     * specified user and widget kind. If a duplicate is found, a
     * {@link DuplicateTargetException} is thrown.
     *
     * @param userId
     *            the ID of the widget owner; used to scope the duplicate check
     * @param kind
     *            the widget kind; mapped to its DB representation via
     *            {@link WidgetKind#getValue()}
     * @param settings
     *            input settings which may contain either "target" (String) or
     *            "targets" (array/iterable)
     * @throws IllegalArgumentException
     *             if no target could be extracted from settings
     * @throws DuplicateTargetException
     *             if any of the normalized targets already exist for the user and
     *             kind
     */
    public void ensureNoDuplicateTargets(UUID userId, WidgetKind kind, Map<String, Object> settings) {
        var targets = extractTargets(settings);
        if (targets.isEmpty())
            throw new IllegalArgumentException("target_required");

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
        var anyExists = Boolean.TRUE.equals(jdbc.query(con -> {
            var ps = con.prepareStatement(dupeSql);
            ps.setObject(1, userId);
            ps.setString(2, kind.getValue()); // ← enum → DB string
            var arr = con.createArrayOf("text", finalTargets.toArray(new String[0]));
            ps.setArray(3, arr);
            ps.setArray(4, arr);
            return ps;
        }, rs -> rs.next() ? rs.getBoolean(1) : Boolean.FALSE));

        if (anyExists)
            throw new DuplicateTargetException("duplicate_target");
    }

    /**
     * Creates a widget row in the database and returns a
     * {@link CreateWidgetResponse} with generated IDs.
     *
     * <p>
     * Notes:
     *
     * <ul>
     * <li>If settings is null, an empty map will be persisted.
     * <li>If grid is null, a default grid {x:0, y:0, w:1, h:1} will be used.
     * <li>Settings and grid are serialized as JSON and stored as jsonb.
     * </ul>
     *
     * @param userId
     *            the owner of the widget
     * @param kind
     *            the widget kind; persisted via {@link WidgetKind#getValue()}
     * @param title
     *            the widget title
     * @param settings
     *            arbitrary settings map; will be serialized to JSON (jsonb)
     * @param grid
     *            widget grid configuration; will be serialized to JSON (jsonb)
     * @return a populated {@link CreateWidgetResponse} including generated id and
     *         instanceId
     * @throws RuntimeException
     *             if JSON serialization fails
     */
    public CreateWidgetResponse create(UUID userId, WidgetKind kind, String title, Map<String, Object> settings,
            Map<String, Object> grid) {
        final UUID id = UUID.randomUUID();
        final UUID instanceId = UUID.randomUUID();

        Map<String, Object> safeSettings = (settings != null) ? settings : Map.of();
        Map<String, Object> safeGrid = (grid != null) ? grid : Map.of("x", 0, "y", 0, "w", 1, "h", 1);

        final String insertSql = """
                insert into user_widgets
                  (id, instance_id, user_id, kind, title, settings, grid)
                values
                  (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)
                """;

        final String settingsJson;
        final String gridJson;
        try {
            settingsJson = json.writeValueAsString(safeSettings);
            gridJson = json.writeValueAsString(safeGrid);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize JSON", e);
        }

        // 👇 this form gives you per-index TRACE logs and avoids “param 7 not set”
        jdbc.update(insertSql, ps -> {
            ps.setObject(1, id);
            ps.setObject(2, instanceId);
            ps.setObject(3, userId);
            ps.setString(4, kind.getValue());
            ps.setString(5, title);
            ps.setString(6, settingsJson);
            ps.setString(7, gridJson);
        });

        return new CreateWidgetResponse(id.toString(), instanceId.toString(), kind, title, safeGrid, safeSettings);
    }

    /**
     * Extracts targets from settings into a flat list.
     *
     * <p>
     * Supported inputs:
     *
     * <ul>
     * <li>Single target under key "target" as a non-blank String.
     * <li>Multiple targets under key "targets" as an Iterable or an Object[] of
     * Strings.
     * </ul>
     *
     * Blank strings are ignored. If settings is null or no values are found, an
     * empty list is returned.
     *
     * @param settings
     *            the settings map that may contain "target" or "targets"
     * @return a list of non-blank target strings in the order discovered (single
     *         target first, then many)
     */
    static List<String> extractTargets(Map<String, Object> settings) {
        if (settings == null)
            return List.of();
        var out = new ArrayList<String>(2);

        Object single = settings.get("target");
        if (single instanceof String s && !s.isBlank())
            out.add(s);

        Object many = settings.get("targets");
        if (many instanceof Iterable<?> it) {
            for (Object o : it)
                if (o instanceof String s && !s.isBlank())
                    out.add(s);
        } else if (many != null && many.getClass().isArray()) {
            for (Object o : (Object[]) many)
                if (o instanceof String s && !s.isBlank())
                    out.add(s);
        }
        return out;
    }

    /**
     * Exception thrown when attempting to create a widget with a target that
     * already exists for the same user and widget kind.
     */
    public static class DuplicateTargetException extends RuntimeException {
        public DuplicateTargetException(String msg) {
            super(msg);
        }
    }

    public static class DuplicateException extends RuntimeException {
        public DuplicateException(String msg) {
            super(msg);
        }
    }

    private static String optString(Object o) {
        return (o instanceof String s && !s.isBlank()) ? s : null;
    }

    /**
     * Performs a lightweight normalization on a URL-like string.
     *
     * <ul>
     * <li>Trims leading/trailing whitespace.
     * <li>Removes a trailing slash, if present.
     * </ul>
     *
     * This method does not validate or parse the URL; it is intentionally minimal.
     *
     * @param s
     *            the input string (may be null)
     * @return the normalized string, or null if the input was null
     */
    private static String normalizeUrl(String s) {
        if (s == null)
            return null;
        s = s.trim();
        // very light normalization; keep it simple for now
        if (s.endsWith("/"))
            s = s.substring(0, s.length() - 1);
        return s;
    }
}
