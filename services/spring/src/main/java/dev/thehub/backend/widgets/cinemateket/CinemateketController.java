package dev.thehub.backend.widgets.cinemateket;

import dev.thehub.backend.widgets.cinemateket.dto.FilmShowingDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for Cinemateket film showings.
 */
@Tag(name = "Cinemateket")
@RestController
@RequestMapping("/api/widgets/cinemateket")
public class CinemateketController {

    private static final Logger log = LoggerFactory.getLogger(CinemateketController.class);

    private final CinemateketService svc;

    public CinemateketController(CinemateketService svc) {
        this.svc = svc;
    }

    /**
     * Fetches upcoming film showings from Cinemateket Trondheim.
     *
     * @param auth
     *            current JWT authentication
     * @param limit
     *            optional limit on number of showings to return
     * @return HTTP 200 with a list of film showings
     */
    @Operation(summary = "Fetch Cinemateket showings", description = "Fetches upcoming film showings from Cinemateket Trondheim's program page.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "OK", content = @Content(array = @ArraySchema(schema = @Schema(implementation = FilmShowingDto.class))))})
    @GetMapping
    public ResponseEntity<List<FilmShowingDto>> showings(
            @Parameter(hidden = true) JwtAuthenticationToken auth,
            @Parameter(description = "Maximum number of showings to return") @RequestParam(required = false) Integer limit) {
        if (log.isDebugEnabled()) {
            var uid = java.util.UUID.fromString(auth.getToken().getClaimAsString("sub"));
            log.debug("Cinemateket request uid={} limit={}", uid, limit);
        }

        List<FilmShowingDto> showings = svc.fetchShowings(limit);
        return ResponseEntity.ok(showings);
    }
}
