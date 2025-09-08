package dev.thehub.backend.widgets.countdown.provider;

import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

/**
 * Registry that wires and exposes all available {@link CountdownProvider}s.
 * <p>
 * Providers are constructed with shared infrastructure (e.g. RestTemplate) and
 * looked up by their {@link CountdownProvider#id()}.
 */
@Component
public class ProviderRegistry {
    private final Map<String, CountdownProvider> providers;

    /**
     * Creates the registry and instantiates known providers.
     *
     * @param http
     *            RestTemplate used by providers when scraping/external calls
     */
    public ProviderRegistry(RestTemplate http) {
        var trumf = new TrippelTrumfProvider(http);
        var dnb = new DNBSupertilbudProvider(http);
        this.providers = Map.of(trumf.id(), trumf, dnb.id(), dnb);
    }

    /**
     * Returns a provider by id or throws if unknown.
     *
     * @param id
     *            provider id, see {@link CountdownProvider#id()}
     * @return the matching provider
     * @throws IllegalArgumentException
     *             if the id is not registered
     */
    public CountdownProvider get(String id) {
        var p = providers.get(id);
        if (p == null)
            throw new IllegalArgumentException("unknown_provider: " + id);
        return p;
    }
}
