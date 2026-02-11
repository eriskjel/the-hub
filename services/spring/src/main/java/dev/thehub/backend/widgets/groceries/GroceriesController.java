package dev.thehub.backend.widgets.groceries;

import dev.thehub.backend.widgets.WidgetSettingsService;
import dev.thehub.backend.widgets.groceries.dto.DealDto;
import dev.thehub.backend.widgets.groceries.dto.GroceryDealsResponse;
import dev.thehub.backend.widgets.groceries.dto.GroceryDealsSettings;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for grocery deals. Provides an endpoint to fetch deals either
 * from a saved widget instance or ad-hoc query parameters.
 */
@Tag(name = "Grocery Deals")
@RestController
@RequestMapping("/api/widgets/grocery-deals")
public class GroceriesController {

    private static final Logger log = LoggerFactory.getLogger(GroceriesController.class);

    private final GroceriesService svc;
    private final WidgetSettingsService settingsSvc;

    /**
     * Constructs the groceries controller.
     *
     * @param svc
     *            service to fetch grocery deals
     * @param settingsSvc
     *            service to resolve stored widget settings
     */
    public GroceriesController(GroceriesService svc, WidgetSettingsService settingsSvc) {
        this.svc = svc;
        this.settingsSvc = settingsSvc;
    }

    /**
     * Fetches grocery deals either using a saved widget instance or ad-hoc query
     * parameters.
     *
     * @param auth
     *            current JWT authentication
     * @param instanceId
     *            optional widget instance id belonging to the user; when provided,
     *            its stored settings are used as defaults
     * @param q
     *            search term used when no instanceId is provided
     * @param limit
     *            optional result limit override
     * @param lat
     *            optional latitude override
     * @param lon
     *            optional longitude override
     * @param city
     *            optional city override
     * @param top
     *            optional cap on number of items returned from service (must be >
     *            0); defaults to the effective limit if null or invalid
     * @return HTTP 200 with a list of deals, or 400 when required inputs are
     *         missing
     */
    @Operation(summary = "Fetch grocery deals", description = "Fetches deals by a saved widget instance (instanceId) or by ad-hoc query parameters. Returns wrapper with deals and isEnriched for fast-first refetch-later.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "OK", content = @Content(schema = @Schema(implementation = GroceryDealsResponse.class))),
            @ApiResponse(responseCode = "400", description = "Missing required inputs")})
    @GetMapping
    public ResponseEntity<GroceryDealsResponse> deals(@Parameter(hidden = true) JwtAuthenticationToken auth,
            @Parameter(description = "Widget instance id owned by the caller") @RequestParam(required = false) UUID instanceId,
            @Parameter(description = "Search query when no instanceId is provided") @RequestParam(name = "q", required = false) String q,
            @Parameter(description = "Result limit override") @RequestParam(required = false) Integer limit,
            @Parameter(description = "Latitude override") @RequestParam(required = false) Double lat,
            @Parameter(description = "Longitude override") @RequestParam(required = false) Double lon,
            @Parameter(description = "City override") @RequestParam(required = false) String city,
            @Parameter(description = "Cap on the number of items returned") @RequestParam(required = false) Integer top,
            @Parameter(description = "Discard results with price > maxPrice (kr). Defaults to config groceries.max-price.") @RequestParam(required = false) Double maxPrice)
            throws IOException {
        if (log.isDebugEnabled() || sample(0.02)) { // 2% sampled breadcrumb
            var uid = UUID.fromString(auth.getToken().getClaimAsString("sub"));
            log.debug("Groceries request uid={} instId={} q={} city={} limit={} top={}", uid, instanceId, safe(q),
                    safe(city), limit, top);
        }
        GroceryDealsSettings settings;

        if (instanceId != null) {
            var userId = UUID.fromString(auth.getToken().getClaimAsString("sub"));
            var row = settingsSvc.requireWidget(userId, instanceId);
            settings = settingsSvc.toGrocery(row);
            // runtime overrides
            settings = new GroceryDealsSettings(settings.query(), (limit != null) ? limit : settings.maxResults(),
                    (city != null && !city.isBlank()) ? city : settings.city(), (lat != null) ? lat : settings.lat(),
                    (lon != null) ? lon : settings.lon());
        } else {
            if (q == null || q.isBlank())
                return ResponseEntity.badRequest().build();
            settings = new GroceryDealsSettings(q, limit, city, lat, lon);
        }

        int fetchLimit = Optional.ofNullable(settings.maxResults()).orElse(svc.getDefaultLimit());
        Integer effectiveTop = (top != null && top > 0) ? Math.min(fetchLimit, top) : fetchLimit;

        var result = svc.fetchDeals(settings, effectiveTop);

        double priceCap = Optional.ofNullable(maxPrice).orElse(svc.getDefaultMaxPrice());

        List<DealDto> filtered = result.deals().stream().filter(d -> d.price() <= priceCap).toList();

        return ResponseEntity.ok(new GroceryDealsResponse(filtered, result.isEnriched()));
    }

    /**
     * Returns true with probability p.
     *
     * @param p
     *            probability in the range [0,1]
     * @return whether the event sampled as true
     */
    private static boolean sample(double p) {
        return java.util.concurrent.ThreadLocalRandom.current().nextDouble() < p;
    }

    /**
     * Returns a safe representation of a possibly blank string for logging.
     *
     * @param s
     *            input string (nullable)
     * @return the input if non-blank, otherwise the literal "<none>"
     */
    private static String safe(String s) {
        return (s == null || s.isBlank()) ? "<none>" : s;
    }
}