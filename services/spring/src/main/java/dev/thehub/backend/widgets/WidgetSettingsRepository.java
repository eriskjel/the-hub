package dev.thehub.backend.widgets;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class WidgetSettingsRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    /**
     * Creates a repository that reads widgets and their settings.
     *
     * @param jdbc
     *            Spring JdbcTemplate for DB access
     * @param json
     *            ObjectMapper used to parse jsonb fields
     */
    public WidgetSettingsRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /**
     * Looks up a widget row by user and instance identifier.
     *
     * @param userId
     *            owner id
     * @param instanceId
     *            widget instance id
     * @return an Optional containing the row if found
     */
    public Optional<WidgetRow> findWidget(UUID userId, UUID instanceId) {
        final String sql = """
                select id, instance_id, kind, title, grid, settings
                from user_widgets
                where user_id = ? and instance_id = ?
                limit 1
                """;
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, (ResultSet rs, int i) -> {
                JsonNode grid = parseJson(rs.getString("grid"));
                JsonNode settings = parseJson(rs.getString("settings"));
                return new WidgetRow(rs.getObject("id", UUID.class), rs.getObject("instance_id", UUID.class),
                        rs.getString("kind"), rs.getString("title"), grid, settings);
            }, userId, instanceId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    /**
     * Safely parses a JSON string returning an empty object node on error.
     */
    private JsonNode parseJson(String s) {
        try {
            return (s != null && !s.isBlank()) ? json.readTree(s) : json.getNodeFactory().objectNode();
        } catch (Exception ignored) {
            return json.getNodeFactory().objectNode();
        }
    }
}