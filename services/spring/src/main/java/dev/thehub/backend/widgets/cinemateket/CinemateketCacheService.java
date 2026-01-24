package dev.thehub.backend.widgets.cinemateket;

import dev.thehub.backend.widgets.cinemateket.dto.FilmShowingDto;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Service that resolves Cinemateket film showings with database-backed caching.
 * <p>
 * Applies the following resolution order:
 * <ol>
 * <li>Fresh cache entry (according to
 * {@link #isFresh(CinemateketCacheDao.Row, Instant)}).</li>
 * <li>Fetch from {@link CinemateketService} (scraping) and upsert cache.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class CinemateketCacheService {
    private static final Logger log = LoggerFactory.getLogger(CinemateketCacheService.class);

    private final CinemateketCacheDao cache;
    private final CinemateketService scraper;

    /** Default freshness window when validUntil is not set. */
    private static final Duration STALE_AFTER = Duration.ofHours(24);

    /**
     * Gets film showings, using cache if fresh, otherwise fetching from the
     * scraper.
     *
     * @param limit
     *            maximum number of showings to return (null = no limit)
     * @return list of film showings, sorted by show time
     */
    public List<FilmShowingDto> getShowings(Integer limit) {
        Instant now = Instant.now();
        var cached = cache.find().orElse(null);

        // 1) Fresh cache
        if (cached != null && isFresh(cached, now)) {
            log.info("CinemateketCacheService: using FRESH CACHE fetchedAt={} showingsCount={}", cached.fetchedAt(),
                    cached.showings().size());
            List<FilmShowingDto> result = new ArrayList<>(cached.showings());
            if (limit != null && limit > 0) {
                result = result.stream().limit(limit).collect(java.util.stream.Collectors.toList());
            }
            return result;
        }

        // 2) Fetch from scraper, upsert cache, return
        log.info("CinemateketCacheService: FETCHING from scraper (cache stale or missing)");
        List<FilmShowingDto> showings = scraper.fetchShowings(null); // Fetch all, we'll apply limit after caching

        // Cache the result (even if empty, to avoid repeated failed scrapes)
        cache.upsert(new CinemateketCacheDao.Row("cinemateket", showings, now, null, null));

        log.info("CinemateketCacheService: cached {} showings", showings.size());

        // Apply limit if specified
        if (limit != null && limit > 0) {
            return showings.stream().limit(limit).collect(java.util.stream.Collectors.toList());
        }

        return showings;
    }

    private boolean isFresh(CinemateketCacheDao.Row c, Instant now) {
        if (c.validUntil() != null) {
            return now.isBefore(c.validUntil());
        }
        // If no validUntil, check if fetched within STALE_AFTER window
        if (c.fetchedAt() == null) {
            return false;
        }
        return Duration.between(c.fetchedAt(), now).compareTo(STALE_AFTER) < 0;
    }
}
