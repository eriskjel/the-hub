package dev.thehub.backend.widgets.countdown;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
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
     * @param providerId
     *            stable provider identifier
     * @return Optional row if present
     */
    public Optional<Row> find(String providerId) {
        var sql = """
                  select provider_id, next_iso, previous_iso, tentative, confidence, source_url,
                         fetched_at, valid_until, updated_by, manual_override_next_iso, manual_override_reason,
                         admin_confirmed
                  from public.countdown_provider_cache
                  where provider_id = ?
                """;
        return jdbc.query(sql, rs -> rs.next() ? Optional.of(map(rs)) : Optional.empty(), providerId);
    }

    /**
     * Insert or update a cache row for a provider.
     *
     * @param r
     *            row to persist (manual override fields are not modified by upsert)
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
                    valid_until = excluded.valid_until,
                    admin_confirmed = case
                      when date(excluded.next_iso at time zone 'Europe/Oslo')
                           is distinct from
                           date(countdown_provider_cache.next_iso at time zone 'Europe/Oslo') then false
                      else countdown_provider_cache.admin_confirmed
                    end
                """;
        jdbc.update(sql, r.providerId(), tsOrNull(r.nextIso()), tsOrNull(r.previousIso()), r.tentative(),
                r.confidence(), r.sourceUrl(), tsOrNull(r.fetchedAt()), tsOrNull(r.validUntil()));
    }

    /**
     * Mark the provider's current next date as admin-confirmed (not tentative).
     * Returns rows updated.
     */
    public int confirm(String providerId) {
        return jdbc.update("update public.countdown_provider_cache set admin_confirmed = true where provider_id = ?",
                providerId);
    }

    /**
     * Remove the admin confirmation, reverting to the computed tentative state.
     * Returns rows updated.
     */
    public int unconfirm(String providerId) {
        return jdbc.update("update public.countdown_provider_cache set admin_confirmed = false where provider_id = ?",
                providerId);
    }

    /**
     * Return the set of Oslo-local dates that an admin has flagged as incorrect
     * for this provider. The resolver skips these when picking the next date.
     */
    public Set<LocalDate> listDeniedDates(String providerId) {
        var rows = jdbc.query("select denied_date from public.countdown_denied_dates where provider_id = ?",
                (rs, i) -> rs.getObject("denied_date", LocalDate.class), providerId);
        return Set.copyOf(rows);
    }

    /** Full denied entries (with reason/audit) for admin display. */
    public List<DeniedRow> listDenied(String providerId) {
        return jdbc.query(
                "select provider_id, denied_date, reason, denied_by, denied_at "
                        + "from public.countdown_denied_dates where provider_id = ? order by denied_date",
                (rs, i) -> new DeniedRow(rs.getString("provider_id"), rs.getObject("denied_date", LocalDate.class),
                        rs.getString("reason"), optString(rs, "denied_by"), optInstant(rs, "denied_at")),
                providerId);
    }

    /** Insert (or overwrite reason on) a denied date for a provider. */
    public int deny(String providerId, LocalDate deniedDate, String reason) {
        return jdbc.update("""
                insert into public.countdown_denied_dates (provider_id, denied_date, reason)
                values (?, ?, ?)
                on conflict (provider_id, denied_date) do update set reason = excluded.reason
                """, providerId, deniedDate, reason);
    }

    /** Remove a previously denied date. */
    public int undeny(String providerId, LocalDate deniedDate) {
        return jdbc.update("delete from public.countdown_denied_dates where provider_id = ? and denied_date = ?",
                providerId, deniedDate);
    }

    /**
     * Force the cache row stale so the next resolver call re-fetches. Used after
     * a deny/undeny change so the filtered "next" is recomputed immediately.
     */
    public int invalidate(String providerId) {
        return jdbc.update(
                "update public.countdown_provider_cache set valid_until = now() - interval '1 second', fetched_at = now() - interval '30 days' where provider_id = ?",
                providerId);
    }

    private static Timestamp tsOrNull(Instant i) {
        return i == null ? null : Timestamp.from(i);
    }

    /** Map a JDBC ResultSet row to a Row record. */
    private static Row map(ResultSet rs) throws java.sql.SQLException {
        return new Row(rs.getString("provider_id"), optInstant(rs, "next_iso"), optInstant(rs, "previous_iso"),
                rs.getBoolean("tentative"), rs.getInt("confidence"), rs.getString("source_url"),
                optInstant(rs, "fetched_at"), optInstant(rs, "valid_until"), optInstant(rs, "manual_override_next_iso"),
                rs.getString("manual_override_reason"), rs.getBoolean("admin_confirmed"));
    }

    private static Instant optInstant(ResultSet rs, String col) throws java.sql.SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }

    private static String optString(ResultSet rs, String col) throws java.sql.SQLException {
        Object v = rs.getObject(col);
        return v == null ? null : v.toString();
    }

    /** One entry in the denied-dates list for a provider. */
    public record DeniedRow(String providerId, LocalDate deniedDate, String reason, String deniedBy, Instant deniedAt) {
    }

    /**
     * Represents one cache row for a provider.
     *
     * @param providerId
     *            provider identifier
     * @param nextIso
     *            next occurrence instant (nullable)
     * @param previousIso
     *            previous occurrence instant (nullable)
     * @param tentative
     *            true if dates are tentative
     * @param confidence
     *            confidence 0..100
     * @param sourceUrl
     *            source of data if applicable
     * @param fetchedAt
     *            when the provider was last fetched
     * @param validUntil
     *            optional validity bound; beyond this a refetch is required
     * @param manualOverrideNextIso
     *            optional admin override for nextIso
     * @param manualOverrideReason
     *            optional reason for override
     */
    public record Row(String providerId, Instant nextIso, Instant previousIso, boolean tentative, int confidence,
            String sourceUrl, Instant fetchedAt, Instant validUntil, Instant manualOverrideNextIso,
            String manualOverrideReason, boolean adminConfirmed) {
    }
}