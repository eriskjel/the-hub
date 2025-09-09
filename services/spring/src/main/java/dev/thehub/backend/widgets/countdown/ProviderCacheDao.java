package dev.thehub.backend.widgets.countdown;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * DAO for the countdown_provider_cache table.
 * <p>
 * Stores the last fetched next/previous instants per provider along with
 * metadata and optional admin manual override.
 */
@Repository
@RequiredArgsConstructor
public class ProviderCacheDao {
    private final JdbcTemplate jdbc;

    /**
     * Fetch a cached row by provider id.
     *
     * @param providerId stable provider identifier
     * @return Optional row if present
     */
    public Optional<Row> find(String providerId) {
        var sql = """
                  select provider_id, next_iso, previous_iso, tentative, confidence, source_url,
                         fetched_at, valid_until, updated_by, manual_override_next_iso, manual_override_reason
                  from public.countdown_provider_cache
                  where provider_id = ?
                """;
        return jdbc.query(sql, rs -> rs.next() ? Optional.of(map(rs)) : Optional.empty(), providerId);
    }

    /**
     * Insert or update a cache row for a provider.
     *
     * @param r row to persist (manual override fields are not modified by upsert)
     */
    public void upsert(Row r) {
        var sql = """
                  insert into public.countdown_provider_cache
                    (provider_id, next_iso, previous_iso, tentative, confidence, source_url, fetched_at, valid_until)
                  values (?, ?, ?, ?, ?, ?, ?, ?)
                  on conflict (provider_id) do update set
                    next_iso = excluded.next_iso,
                    previous_iso = excluded.previous_iso,
                    tentative = excluded.tentative,
                    confidence = excluded.confidence,
                    source_url = excluded.source_url,
                    fetched_at = excluded.fetched_at,
                    valid_until = excluded.valid_until
                """;
        jdbc.update(sql, r.providerId(), tsOrNull(r.nextIso()), tsOrNull(r.previousIso()), r.tentative(),
                r.confidence(), r.sourceUrl(), tsOrNull(r.fetchedAt()), tsOrNull(r.validUntil()));
    }

    private static Timestamp tsOrNull(Instant i) {
        return i == null ? null : Timestamp.from(i);
    }

    /** Map a JDBC ResultSet row to a Row record. */
    private static Row map(ResultSet rs) throws java.sql.SQLException {
        return new Row(rs.getString("provider_id"), optInstant(rs, "next_iso"), optInstant(rs, "previous_iso"),
                rs.getBoolean("tentative"), rs.getInt("confidence"), rs.getString("source_url"),
                optInstant(rs, "fetched_at"), optInstant(rs, "valid_until"), optInstant(rs, "manual_override_next_iso"),
                rs.getString("manual_override_reason"));
    }

    private static Instant optInstant(ResultSet rs, String col) throws java.sql.SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }

    /**
     * Represents one cache row for a provider.
     *
     * @param providerId provider identifier
     * @param nextIso next occurrence instant (nullable)
     * @param previousIso previous occurrence instant (nullable)
     * @param tentative true if dates are tentative
     * @param confidence confidence 0..100
     * @param sourceUrl source of data if applicable
     * @param fetchedAt when the provider was last fetched
     * @param validUntil optional validity bound; beyond this a refetch is required
     * @param manualOverrideNextIso optional admin override for nextIso
     * @param manualOverrideReason optional reason for override
     */
    public record Row(String providerId, Instant nextIso, Instant previousIso, boolean tentative, int confidence,
            String sourceUrl, Instant fetchedAt, Instant validUntil, Instant manualOverrideNextIso,
            String manualOverrideReason) {
    }
}