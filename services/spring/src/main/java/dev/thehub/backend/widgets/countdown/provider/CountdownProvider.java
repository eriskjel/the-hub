package dev.thehub.backend.widgets.countdown.provider;

import java.time.Instant;
import java.util.Optional;

/**
 * A source of upcoming countdown targets. Implementations scrape or compute the
 * next interesting Instant for a given topic (e.g. a campaign window) and
 * expose a stable identifier used in settings.
 */
public interface CountdownProvider {
    /**
     * Returns the stable identifier of this provider, used in widget settings to
     * select it.
     *
     * @return provider id, e.g. "trippel-trumf"
     */
    String id();

    /**
     * Computes or retrieves the next upcoming Instant at or after the given
     * reference time.
     *
     * @param now
     *            reference timestamp used when determining the next occurrence
     * @return an Optional containing the next Instant if one could be determined,
     *         otherwise empty
     */
    Optional<Instant> next(Instant now);

    /**
     * Computes or retrieves the previous Instant before the given reference time.
     * 
     * @param now
     *            reference timestamp used when determining the previous occurrence
     * @return an Optional containing the previous Instant if one could be
     *         determined, otherwise empty
     */
    default Optional<Instant> previous(Instant now) {
        return Optional.empty();
    }
    /**
     * Whether the provided dates are tentative (subject to change).
     */
    default boolean isTentative() {
        return false;
    }
    /**
     * Confidence 0..100 indicating how reliable the dates are.
     */
    default int confidence() {
        return 100;
    }
    /**
     * Optional source URL used to derive the dates.
     */
    default Optional<String> sourceUrl() {
        return Optional.empty();
    }
    /**
     * Optional validity bound; after this time, the cache should be considered stale
     * and a refetch performed.
     */
    default Optional<Instant> validUntil(Instant now) {
        return Optional.empty();
    }
}