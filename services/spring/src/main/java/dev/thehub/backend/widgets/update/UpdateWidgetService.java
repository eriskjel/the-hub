package dev.thehub.backend.widgets.update;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.thehub.backend.widgets.WidgetKind;
import dev.thehub.backend.widgets.WidgetRow;
import dev.thehub.backend.widgets.WidgetSettingsRepository;
import dev.thehub.backend.widgets.create.CreateWidgetResponse;
import dev.thehub.backend.widgets.create.CreateWidgetService;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class UpdateWidgetService {

    private static final Logger log = LoggerFactory.getLogger(UpdateWidgetService.class);

    /**
     * Thrown when a widget cannot be found for the given user/instance pair, or the
     * widget exists but does not belong to the user.
     */
    public static class NotFoundOrNotOwned extends RuntimeException {
    }
    /**
     * Thrown when the current user is not allowed to perform the requested update.
     */
    public static class Forbidden extends RuntimeException {
    }
    /**
     * Thrown when the update would violate uniqueness constraints enforced by
     * business rules (e.g., duplicate targets for SERVER_PINGS or duplicate
     * query/city for GROCERY_DEALS).
     */
    public static class DuplicateException extends RuntimeException {
        public DuplicateException(String msg) {
            super(msg);
        }
    }

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final WidgetSettingsRepository readRepo;
    private final CreateWidgetService createChecks;

    /**
     * Constructs the service responsible for partial updates of widgets.
     *
     * @param jdbc
     *            database access via JdbcTemplate
     * @param json
     *            ObjectMapper for JSON operations
     * @param readRepo
     *            repository used to locate and read existing widget rows
     * @param createChecks
     *            delegate used to reuse duplicate-check logic from creation
     */
    public UpdateWidgetService(JdbcTemplate jdbc, ObjectMapper json, WidgetSettingsRepository readRepo,
            CreateWidgetService createChecks) {
        this.jdbc = jdbc;
        this.json = json;
        this.readRepo = readRepo;
        this.createChecks = createChecks;
    }

    /**
     * Applies a partial update to a widget owned by the given user.
     *
     * <p>
     * Behavior:
     * <ul>
     * <li>grid: If provided, replaces the grid JSON.</li>
     * <li>settings: If provided, merges into existing settings (null values
     * stripped) and enforces duplicate rules.</li>
     * </ul>
     *
     * @param userId
     *            owner id
     * @param instanceId
     *            widget instance id
     * @param body
     *            partial update payload
     * @return a CreateWidgetResponse formatted response of the updated entity
     * @throws NotFoundOrNotOwned
     *             if no such widget for user/instance
     * @throws DuplicateException
     *             if settings would conflict with uniqueness constraints
     * @throws IllegalArgumentException
     *             for invalid inputs (e.g., invalid JSON)
     */
    public CreateWidgetResponse partialUpdate(UUID userId, UUID instanceId, UpdateWidgetRequest body) {
        log.debug("UpdateWidgetService.enter userId={} instanceId={}", userId, instanceId);
        var row = readRepo.findWidget(userId, instanceId).orElseThrow(NotFoundOrNotOwned::new);

        WidgetKind kind = WidgetKind.from(row.kind());

        Map<String, Object> newSettings = body.settings();
        Map<String, Object> newGrid = body.grid();

        log.debug("UpdateWidgetService.validate kind={} settingsChanged={} gridChanged={}", kind, newSettings != null,
                newGrid != null);

        if (newSettings != null && !jsonEquals(newSettings, row.settings())) {
            try {
                createChecks.ensureNoDuplicateExceptInstance(userId, kind, newSettings, instanceId);
            } catch (CreateWidgetService.DuplicateException e) {
                log.warn("UpdateWidget duplicate userId={} instanceId={} kind={} msg={}", userId, instanceId, kind,
                        e.getMessage());
                throw new DuplicateException(mapToConsistentErrorKey(kind));
            } catch (CreateWidgetService.DuplicateTargetException e) {
                // Handle the specific target duplicate case
                throw new DuplicateException("duplicate_target");
            }
        }

        final String sql = """
                    update user_widgets
                           set grid = coalesce(?::jsonb, grid),
                           settings = case
                                        when ?::jsonb is null then settings
                                        else jsonb_strip_nulls(settings || ?::jsonb)
                                      end
                     where user_id = ? and instance_id = ?
                     returning id, instance_id, kind, grid, settings
                """;

        String gridJson = toJsonOrNull(newGrid);
        String settingsJson = toJsonOrNull(newSettings);

        return jdbc.query(con -> {
            var ps = con.prepareStatement(sql);
            ps.setString(1, gridJson);
            ps.setString(2, settingsJson);
            ps.setString(3, settingsJson);
            ps.setObject(4, userId);
            ps.setObject(5, instanceId);

            return ps;
        }, rs -> {
            if (!rs.next())
                throw new NotFoundOrNotOwned();
            var updated = new WidgetRow(rs.getObject("id", UUID.class), rs.getObject("instance_id", UUID.class),
                    rs.getString("kind"), parseJson(rs.getString("grid")), parseJson(rs.getString("settings")));
            return toCreateResponse(updated);
        });
    }

    private String mapToConsistentErrorKey(WidgetKind kind) {
        return switch (kind) {
            case SERVER_PINGS -> "duplicate_target";
            case GROCERY_DEALS -> "duplicate_groceries";
            default -> "duplicate_widget";
        };
    }

    private String toJsonOrNull(Map<String, Object> m) {
        if (m == null)
            return null;
        try {
            return json.writeValueAsString(m);
        } catch (Exception e) {
            throw new IllegalArgumentException("invalid_json");
        }
    }

    private CreateWidgetResponse toCreateResponse(WidgetRow row) {
        // Reuse your existing response format
        return new CreateWidgetResponse(row.id().toString(), row.instanceId().toString(), WidgetKind.from(row.kind()),
                json.convertValue(row.grid(), Map.class), json.convertValue(row.settings(), Map.class));
    }

    private JsonNode parseJson(String s) {
        try {
            return (s != null && !s.isBlank()) ? json.readTree(s) : json.getNodeFactory().objectNode();
        } catch (Exception ignored) {
            return json.getNodeFactory().objectNode();
        }
    }

    private boolean jsonEquals(Object a, Object b) {
        try {
            return json.valueToTree(a).equals(json.valueToTree(b));
        } catch (Exception ignored) {
            return false;
        }
    }
}