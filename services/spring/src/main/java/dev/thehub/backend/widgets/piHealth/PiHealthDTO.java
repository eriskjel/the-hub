package dev.thehub.backend.widgets.piHealth;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Snapshot of a Raspberry Pi device health metrics.
 *
 * @param deviceId
 *            unique device id
 * @param name
 *            human-friendly device name
 * @param lastSeen
 *            last heartbeat timestamp
 * @param cpuTempC
 *            CPU temperature in Celsius (nullable)
 * @param cpuPct
 *            CPU utilization percent (nullable)
 * @param memUsedMb
 *            used memory in MB (nullable)
 * @param diskUsedPct
 *            disk usage percent (nullable)
 * @param netUpKbps
 *            upstream bandwidth in Kbps (nullable)
 * @param netDownKbps
 *            downstream bandwidth in Kbps (nullable)
 * @param ts
 *            sample timestamp
 */
public record PiHealthDTO(UUID deviceId, String name, OffsetDateTime lastSeen, Double cpuTempC, Double cpuPct,
        Integer memUsedMb, Double diskUsedPct, Double netUpKbps, Double netDownKbps, OffsetDateTime ts) {
}
