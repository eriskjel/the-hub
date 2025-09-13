package dev.thehub.backend.widgets.countdown.provider;

import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

/**
 * Registry that wires and exposes all available {@link CountdownProvider}s.
 */
@Component
public class ProviderRegistry {
    private final Map<String, CountdownProvider> providers;

    /**
     * Construct the registry and wire known providers.
     *
     * @param http
     *            RestTemplate used by providers for HTTP requests
     */
    public ProviderRegistry(RestTemplate http) {
        var trumf = new TrippelTrumfProvider(http);
        var dnb = new DNBSupertilbudProvider(http);
        this.providers = Map.of(trumf.id(), trumf, dnb.id(), dnb);
    }

    /**
     * Retrieve a registered provider by id.
     *
     * @param id
     *            stable provider identifier
     * @return the provider instance
     * @throws IllegalArgumentException
     *             if the id is unknown
     */
    public CountdownProvider get(String id) {
        var p = providers.get(id);
        if (p == null)
            throw new IllegalArgumentException("unknown_provider: " + id);
        return p;
    }
}
