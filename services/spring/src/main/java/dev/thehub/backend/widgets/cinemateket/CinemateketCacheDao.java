package dev.thehub.backend.widgets.cinemateket;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.thehub.backend.widgets.cinemateket.dto.FilmShowingDto;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * DAO for the cinemateket_cache table.
 * <p>
 * Stores the last fetched film showings as a JSONB array along with metadata.
 */
@Repository
@RequiredArgsConstructor
public class CinemateketCacheDao {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    /**
     * Fetch the cached row (there's only one row with id='cinemateket').
     *
     * @return Optional row if present
     */
    public Optional<Row> find() {
        var sql = """
                  select id, showings, fetched_at, valid_until, updated_by
                  from public.cinemateket_cache
                  where id = 'cinemateket'
                """;
        return jdbc.query(sql, rs -> rs.next() ? Optional.of(this.map(rs)) : Optional.empty());
    }

    /**
     * Insert or update the cache row.
     *
     * @param r
     *            row to persist
     */
    public void upsert(Row r) {
        var sql = """
                  insert into public.cinemateket_cache
                    (id, showings, fetched_at, valid_until)
                  values (?, ?::jsonb, ?, ?)
                  on conflict (id) do update set
                    showings = excluded.showings,
                    fetched_at = excluded.fetched_at,
                    valid_until = excluded.valid_until
                """;
        try {
            String showingsJson = json.writeValueAsString(r.showings());
            jdbc.update(sql, r.id(), showingsJson, tsOrNull(r.fetchedAt()), tsOrNull(r.validUntil()));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize showings to JSON", e);
        }
    }

    private static Timestamp tsOrNull(Instant i) {
        return i == null ? null : Timestamp.from(i);
    }

    /** Map a JDBC ResultSet row to a Row record. */
    private Row map(ResultSet rs) throws java.sql.SQLException {
        String showingsJson = rs.getString("showings");
        List<FilmShowingDto> showings;
        try {
            showings = json.readValue(showingsJson, new TypeReference<>() {
            });
        } catch (Exception e) {
            throw new RuntimeException("Failed to deserialize showings from JSON", e);
        }
        return new Row(rs.getString("id"), showings, optInstant(rs, "fetched_at"), optInstant(rs, "valid_until"),
                optUuid(rs));
    }

    private static Instant optInstant(ResultSet rs, String col) throws java.sql.SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }

    private static java.util.UUID optUuid(ResultSet rs) throws java.sql.SQLException {
        Object obj = rs.getObject("updated_by");
        return obj == null ? null : (java.util.UUID) obj;
    }

    /**
     * Represents one cache row for cinemateket.
     *
     * @param id
     *            cache identifier (always 'cinemateket')
     * @param showings
     *            list of film showings
     * @param fetchedAt
     *            when the data was last fetched
     * @param validUntil
     *            optional validity bound; beyond this a refetch is required
     * @param updatedBy
     *            optional admin user who last updated
     */
    public record Row(String id, List<FilmShowingDto> showings, Instant fetchedAt, Instant validUntil,
            java.util.UUID updatedBy) {
    }
}
