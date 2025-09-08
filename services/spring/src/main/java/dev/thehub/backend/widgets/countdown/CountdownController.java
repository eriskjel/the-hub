package dev.thehub.backend.widgets.countdown;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for the Countdown widget. Provides the resolved target for
 * the authenticated user and widget instance.
 */
@Tag(name = "Widgets")
@RestController
@RequestMapping("/api/widgets/countdown")
@RequiredArgsConstructor
public class CountdownController {
    private static final Logger log = LoggerFactory.getLogger(CountdownController.class);

    private final CountdownService service;

    /**
     * Resolves countdown data for the given widget instance.
     *
     * Returns current server time (`nowIso`), and if available the next target
     * instant (`nextIso`) and the most recent previous target (`previousIso`).
     */
    @Operation(summary = "Get countdown data", description = "Resolves current server time, and (if available) the next and previous target instants for the given widget instance.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Resolved countdown", content = @Content(schema = @Schema(implementation = CountdownDto.class))),
            @ApiResponse(responseCode = "400", description = "Bad request"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "404", description = "Widget not found"),
            @ApiResponse(responseCode = "500", description = "Internal server error")})
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public CountdownDto get(@Parameter(hidden = true) JwtAuthenticationToken auth,
            @Parameter(description = "Widget instance ID (UUID). Must belong to the authenticated user.", required = true, example = "114c228a-a378-44e2-bc67-1c6b16581187") @RequestParam String instanceId) {
        UUID userId = UUID.fromString(auth.getToken().getClaimAsString("sub"));
        UUID inst = UUID.fromString(instanceId);

        log.debug("CountdownController GET called userId={} instanceId={}", userId, inst);
        CountdownDto dto = service.resolve(userId, inst);
        log.info("CountdownController GET result userId={} instanceId={} nextIso={}", userId, inst, dto.nextIso());

        return dto;
    }
}
