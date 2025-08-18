package dev.thehub.backend.widgets.piHealth;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PiHealthDTO(
        UUID deviceId,
        String name,
        OffsetDateTime lastSeen,
        Double cpuTempC,
        Double cpuPct,
        Integer memUsedMb,
        Double diskUsedPct,
        Double netUpKbps,
        Double netDownKbps,
        OffsetDateTime ts
) {}