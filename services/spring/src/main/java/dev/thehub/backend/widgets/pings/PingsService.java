package dev.thehub.backend.widgets.pings;

import java.net.HttpURLConnection;
import java.net.URL;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.stereotype.Service;

/**
 * Service providing simple HTTP ping functionality for a list of target URLs.
 */
@Service
@EnableScheduling
public class PingsService {

    /**
     * Result of a single ping probe.
     *
     * @param url
     *            the target URL
     * @param status
     *            HTTP response code; -1 indicates a connection error
     * @param ms
     *            latency in milliseconds for the probe
     * @param checkedAt
     *            timestamp when the probe was performed (ISO-8601)
     */
    public record PingResult(String url, int status, long ms, String checkedAt) {
    }

    /**
     * Executes ping probes in parallel for the provided targets.
     *
     * @param targets
     *            list of URLs to probe
     * @return list of {@link PingResult} objects
     */
    public List<PingResult> getResults(List<String> targets) {
        return targets.parallelStream().map(this::probe).toList();
    }

    /**
     * Performs a HEAD request to the supplied URL and captures status and timing.
     */
    private PingResult probe(String url) {
        var t0 = System.nanoTime();
        try {
            var conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("HEAD");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "the-hub-pinger/1.0");
            int code = conn.getResponseCode();
            long ms = (System.nanoTime() - t0) / 1_000_000;
            return new PingResult(url, code, ms, OffsetDateTime.now().toString());
        } catch (Exception e) {
            long ms = (System.nanoTime() - t0) / 1_000_000;
            // Use -1 to indicate a network/connection error (non-HTTP condition)
            return new PingResult(url, -1, ms, OffsetDateTime.now().toString());
        }
    }
}
