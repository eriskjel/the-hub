package dev.thehub.backend.widgets.delete;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service responsible for widget deletion operations.
 *
 * <p>
 * Provides methods to delete a widget instance by its public instance id with
 * authorization-aware semantics: admins may delete any widget while non-admin
 * users can only delete widgets they own.
 */
@Service
public class DeleteWidgetService {
    private static final Logger log = LoggerFactory.getLogger(DeleteWidgetService.class);
    private final JdbcTemplate jdbc;

    /**
     * Constructs the service.
     *
     * @param jdbc
     *            JDBC template used for database access
     */
    public DeleteWidgetService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Deletes a widget by its instance id.
     *
     * @param requester
     *            the id of the requesting user (JWT subject)
     * @param isAdmin
     *            whether the requester has administrator role
     * @param instanceId
     *            the public instance id of the widget to delete
     * @return the number of affected rows (0 when not found or not owned by the
     *         requester)
     */
    @Transactional
    public int deleteByInstanceId(UUID requester, boolean isAdmin, UUID instanceId) {
        final String sqlAdmin = """
                delete from user_widgets
                where instance_id = ?
                """;
        final String sqlUser = """
                delete from user_widgets
                where user_id = ? and instance_id = ?
                """;

        int affected = isAdmin ? jdbc.update(sqlAdmin, ps -> ps.setObject(1, instanceId)) : jdbc.update(sqlUser, ps -> {
            ps.setObject(1, requester);
            ps.setObject(2, instanceId);
        });

        if (affected > 0) {
            log.info("Widget deleted requester={} instanceId={} admin={}", requester, instanceId, isAdmin);
        } else {
            log.warn("Delete no-op (not found/not owned) requester={} instanceId={} admin={}", requester, instanceId,
                    isAdmin);
        }
        return affected;
    }
}
