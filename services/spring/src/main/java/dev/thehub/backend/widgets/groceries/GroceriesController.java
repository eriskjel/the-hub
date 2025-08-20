package dev.thehub.backend.widgets.groceries;

import dev.thehub.backend.widgets.WidgetSettingsService;
import dev.thehub.backend.widgets.groceries.dto.DealDto;
import dev.thehub.backend.widgets.groceries.dto.GroceryDealsSettings;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/widgets/grocery-deals")
public class GroceriesController {

    private final GroceriesService svc;
    private final WidgetSettingsService settingsSvc;

    @Value("${groceries.default-top:2}")
    int defaultTop; // fallback when client doesn't pass ?top

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
     * @return HTTP 200 with a list of deals, or 400 when required inputs are
     *         missing
     */
    @GetMapping
    public ResponseEntity<List<DealDto>> deals(JwtAuthenticationToken auth,
            @RequestParam(required = false) UUID instanceId, @RequestParam(name = "q", required = false) String q,
            @RequestParam(required = false) Integer limit, @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lon, @RequestParam(required = false) String city,
            @RequestParam(required = false) Integer top) throws IOException {
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

        int fetchLimit = Optional.ofNullable(settings.maxResults()).orElse(svc.defaultLimit());
        int effectiveTop = Math.max(1, Math.min(fetchLimit, (top != null ? top : defaultTop)));

        var deals = svc.fetchDeals(settings, effectiveTop);
        return ResponseEntity.ok(deals);
    }
}