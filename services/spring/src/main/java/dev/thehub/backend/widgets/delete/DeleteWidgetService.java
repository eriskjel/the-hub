package dev.thehub.backend.widgets.delete;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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

    // Prefer configuration, falls back to 3 if not set
    private final int gridCols;

    public DeleteWidgetService(JdbcTemplate jdbc, @Value("${widgets.grid.cols:3}") int gridCols) {
        this.jdbc = jdbc;
        this.gridCols = gridCols;
    }

    @Transactional
    public int deleteByInstanceId(UUID requester, boolean isAdmin, UUID instanceId) {
        final String sqlAdminDelete = "delete from user_widgets where instance_id = ?";
        final String sqlUserDelete = "delete from user_widgets where user_id = ? and instance_id = ?";

        // Owner-aware prefetch so we don’t reflow someone else’s grid by mistake
        final UUID ownerUserId = jdbc.query(con -> {
            final var sql = isAdmin
                    ? "select user_id from user_widgets where instance_id = ?"
                    : "select user_id from user_widgets where user_id = ? and instance_id = ?";
            var ps = con.prepareStatement(sql);
            if (isAdmin) {
                ps.setObject(1, instanceId);
            } else {
                ps.setObject(1, requester);
                ps.setObject(2, instanceId);
            }
            return ps;
        }, rs -> rs.next() ? (UUID) rs.getObject(1) : null);

        int affected = isAdmin
                ? jdbc.update(sqlAdminDelete, ps -> ps.setObject(1, instanceId))
                : jdbc.update(sqlUserDelete, ps -> {
                    ps.setObject(1, requester);
                    ps.setObject(2, instanceId);
                });

        if (affected > 0) {
            log.info("Widget deleted requester={} instanceId={} admin={}", requester, instanceId, isAdmin);
            if (ownerUserId != null) {
                reflowGrid(ownerUserId, gridCols);
            }
        } else {
            log.warn("Delete no-op (not found/not owned) requester={} instanceId={} admin={}", requester, instanceId,
                    isAdmin);
        }
        return affected;
    }

    private void reflowGrid(UUID userId, int cols) {
        if (cols <= 0)
            cols = 1;

        // Preserve reading order by current (y,x,id), then compact left->right,
        // top->bottom
        final String sql = """
                    with ordered as (
                      select id,
                             row_number() over (
                               order by (grid->>'y')::int nulls first,
                                        (grid->>'x')::int nulls first,
                                        id
                             ) - 1 as idx
                      from user_widgets
                      where user_id = ?
                    )
                    update user_widgets uw
                    set grid = jsonb_build_object(
                      'x', (o.idx % ?),
                      'y', (o.idx / ?),
                      'w', 1,
                      'h', 1
                    )
                    from ordered o
                    where uw.id = o.id
                """;
        int finalCols = cols;
        jdbc.update(sql, ps -> {
            ps.setObject(1, userId);
            ps.setInt(2, finalCols);
            ps.setInt(3, finalCols);
        });
        log.info("Reflowed grid for userId={} cols={}", userId, cols);
    }
}