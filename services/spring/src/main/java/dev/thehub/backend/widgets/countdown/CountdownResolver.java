package dev.thehub.backend.widgets.countdown;

import dev.thehub.backend.widgets.countdown.provider.ProviderRegistry;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Resolves countdown instants from external providers with a small caching
 * layer.
 * <p>
 * Applies the following resolution order per provider id:
 * <ol>
 * <li>Admin manual override (if present in cache).</li>
 * <li>Fresh cache entry (according to
 * {@link #isFresh(ProviderCacheDao.Row, Instant)}).</li>
 * <li>Fetch from the concrete
 * {@link dev.thehub.backend.widgets.countdown.provider.CountdownProvider} and
 * upsert cache.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class CountdownResolver {
    private static final Logger log = LoggerFactory.getLogger(CountdownResolver.class);

    private final ProviderCacheDao cache;
    private final ProviderRegistry providers;

    /** Default freshness window when provider doesn't supply valid-until. */
    private static final Duration STALE_AFTER = Duration.ofDays(14);

    /**
     * Result of resolving a provider. tentative = single-source date; verified =
     * admin confirmed.
     */
    public record ProviderResult(Instant next, Instant previous, boolean tentative, boolean verified) {
    }

    /**
     * Resolve next and previous instants for a provider at a given reference time.
     *
     * @param providerId
     *            stable provider identifier (see {@code CountdownProvider#id()})
     * @param now
     *            reference instant used for freshness and provider logic
     * @return ProviderResult with next/previous instants and tentative flag
     * @throws IllegalArgumentException
     *             if the provider id is unknown
     */
    public ProviderResult resolveProvider(String providerId, Instant now) {
        var cached = cache.find(providerId).orElse(null);

        // 1) Admin override wins (explicit date set by admin — always verified, never
        // tentative)
        if (cached != null && cached.manualOverrideNextIso() != null) {
            log.info("CountdownResolver: using ADMIN OVERRIDE for provider={} nextIso={} prevIso={}", providerId,
                    cached.manualOverrideNextIso(), cached.previousIso());
            return new ProviderResult(cached.manualOverrideNextIso(), cached.previousIso(), false, true);
        }

        // 2) Fresh cache
        if (cached != null && isFresh(cached, now)) {
            log.info("CountdownResolver: using FRESH CACHE for provider={} nextIso={} prevIso={} fetchedAt={}",
                    providerId, cached.nextIso(), cached.previousIso(), cached.fetchedAt());
            return new ProviderResult(cached.nextIso(), cached.previousIso(), cached.tentative(),
                    cached.adminConfirmed());
        }

        // 3) Fetch once, upsert, return
        var p = providers.get(providerId);
        var next = p.next(now).orElse(null);
        var prev = p.previous(now).orElse(null);
        var tentative = p.isTentative();

        // admin_confirmed carries over from the old cache row only when next_iso is
        // unchanged
        boolean adminConfirmed = cached != null && java.util.Objects.equals(next, cached.nextIso())
                && cached.adminConfirmed();

        log.info("CountdownResolver: FETCHING from provider={} nextIso={} prevIso={} tentative={} adminConfirmed={}",
                providerId, next, prev, tentative, adminConfirmed);

        cache.upsert(new ProviderCacheDao.Row(providerId, next, prev, tentative, p.confidence(),
                p.sourceUrl().orElse(null), now, p.validUntil(now).orElse(null), null, null, false));

        return new ProviderResult(next, prev, tentative, adminConfirmed);
    }

    /**
     * Expose provider-specific maximum plausible window span (in hours). Used by
     * callers to validate whether a [previous..next] interval should count as
     * ongoing.
     *
     * @param providerId
     *            stable provider identifier
     * @return maximum plausible window span in hours
     * @throws IllegalArgumentException
     *             if the provider id is unknown
     */
    public long plausibleSpanCapHours(String providerId) {
        return providers.get(providerId).plausibleWindowMaxHours();
    }

    private boolean isFresh(ProviderCacheDao.Row c, Instant now) {
        if (c.validUntil() != null) {
            if (c.nextIso() == null)
                return false;
            return now.isBefore(c.validUntil());
        }
        if (c.nextIso() == null)
            return false;
        if (!c.nextIso().isAfter(now))
            return false;
        return Duration.between(c.fetchedAt(), now).compareTo(STALE_AFTER) < 0;
    }
}
