package dev.thehub.backend.widgets.cinemateket;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job that refreshes the Cinemateket cache daily at 2 AM.
 * <p>
 * This proactively refreshes the cache to ensure fresh data is available during
 * peak usage hours, even if the cache hasn't expired yet.
 */
@Component
@RequiredArgsConstructor
public class CinemateketCacheRefreshJob {
    private static final Logger log = LoggerFactory.getLogger(CinemateketCacheRefreshJob.class);

    private final CinemateketCacheService cacheService;

    /**
     * Refreshes the Cinemateket cache daily at 2 AM (Europe/Oslo time).
     * <p>
     * Cron expression: "0 0 2 * * ?" means: - 0 seconds - 0 minutes - 2 hours (2
     * AM) - Every day of month - Every month - Any day of week
     */
    @Scheduled(cron = "0 0 2 * * ?", zone = "Europe/Oslo")
    public void refreshCache() {
        log.info("CinemateketCacheRefreshJob: Starting scheduled cache refresh");
        try {
            // Fetch all showings (no limit) to refresh the cache
            var showings = cacheService.getShowings(null);
            log.info("CinemateketCacheRefreshJob: Successfully refreshed cache with {} showings", showings.size());
        } catch (Exception e) {
            log.error("CinemateketCacheRefreshJob: Failed to refresh cache", e);
        }
    }
}
