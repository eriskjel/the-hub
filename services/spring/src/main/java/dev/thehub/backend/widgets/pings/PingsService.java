package dev.thehub.backend.widgets.pings;

import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.stereotype.Service;

import java.net.HttpURLConnection;
import java.net.URL;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@EnableScheduling
public class PingsService {

    public record PingResult(String url, int status, long ms, String checkedAt) {}

    public List<PingResult> getResults(List<String> targets) {
        return targets.parallelStream().map(this::probe).toList();
    }

    private PingResult probe(String url) {
        var t0 = System.nanoTime();
        try {
            var conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("HEAD"); // try HEAD first; most servers support it
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "the-hub-pinger/1.0");
            int code = conn.getResponseCode();
            long ms = (System.nanoTime() - t0) / 1_000_000;
            return new PingResult(url, code, ms, OffsetDateTime.now().toString());
        } catch (Exception e) {
            long ms = (System.nanoTime() - t0) / 1_000_000;
            return new PingResult(url, 0, ms, OffsetDateTime.now().toString());
        }
    }

}
