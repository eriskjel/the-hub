package dev.thehub.backend.widgets.groceries;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.thehub.backend.widgets.groceries.dto.DealDto;
import dev.thehub.backend.widgets.groceries.dto.GroceryDealsSettings;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
@Service
public class GroceriesService {

    private final RestTemplate http;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${etilbudsavis.base-url}")
    String baseUrl;
    @Value("${etilbudsavis.default-city}")
    String defaultCity;
    @Value("${etilbudsavis.default-lat}")
    double defaultLat;
    @Value("${etilbudsavis.default-lon}")
    double defaultLon;
    @Value("${etilbudsavis.country}")
    String countryCode;
    @Value("${etilbudsavis.default-limit}")
    int defaultLimit;

    /**
     * Constructs the groceries service with an HTTP client.
     *
     * @param http
     *            RestTemplate used to call the external Etilbudsavis API
     */
    public GroceriesService(RestTemplate http) {
        this.http = http;
    }

    /**
     * Queries the external Etilbudsavis API for grocery deals using the provided
     * settings and maps the response into a list of {@link DealDto}.
     *
     * @param s
     *            search and location settings
     * @return a price-ascending list of deals; empty if term is blank or no data
     */
    public List<DealDto> fetchDeals(GroceryDealsSettings s) {
        final String term = Optional.ofNullable(s.query()).map(String::trim).orElse("");
        if (term.isEmpty())
            return List.of();

        final int limit = Optional.ofNullable(s.maxResults()).orElse(defaultLimit);

        Function<Object[], String> enc = parts -> {
            try {
                return Base64.getEncoder().encodeToString(mapper.writeValueAsBytes(parts));
            } catch (Exception e) {
                throw new RuntimeException("Encoding payload failed", e);
            }
        };

        final String qAds = enc.apply(new Object[]{"ads", Map.of("searchTerm", term, "type", "search_ad")});
        final String qOffers = enc.apply(new Object[]{"offers", Map.of("hideUpcoming", false, "pagination",
                Map.of("limit", limit, "offset", 0), "searchTerm", term, "sort", List.of("score_desc"))});
        final String qSearchBusiness = enc.apply(new Object[]{"searchBusiness", Map.of("searchTerm", term)});

        final Map<String, Object> body = Map.of("data", List.of(qAds, qOffers, qSearchBusiness));

        String etaCookie = buildEtaLocationCookie(s.lat() != null ? s.lat() : defaultLat,
                s.lon() != null ? s.lon() : defaultLon,
                (s.city() != null && !s.city().isBlank()) ? s.city() : defaultCity);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.add(HttpHeaders.COOKIE, "eta-location=" + etaCookie);
        headers.add(HttpHeaders.ACCEPT, "*/*");
        headers.add(HttpHeaders.USER_AGENT, "TheHub/1.0 (+https://thehub)");

        HttpEntity<Map<String, Object>> req = new HttpEntity<>(body, headers);

        ResponseEntity<List<Map<String, Object>>> resp = http.exchange(baseUrl + "/", HttpMethod.POST, req,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {
                });

        List<Map<String, Object>> blocks = resp.getBody();
        if (blocks == null || blocks.isEmpty())
            return List.of();

        Map<String, Object> offersBlock = blocks.stream().filter(b -> Objects.equals(b.get("key"), qOffers)).findFirst()
                .orElse(null);

        if (offersBlock == null)
            return List.of();

        @SuppressWarnings("unchecked")
        Map<String, Object> value = (Map<String, Object>) offersBlock.get("value");
        if (value == null)
            return List.of();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> data = (List<Map<String, Object>>) value.get("data");
        if (data == null)
            return List.of();

        return data.stream().map(this::toDeal).sorted(Comparator.comparingDouble(DealDto::price)).toList();
    }

    private DealDto toDeal(Map<String, Object> m) {
        String name = Objects.toString(m.get("name"), "");
        double price = ((Number) m.getOrDefault("price", 0)).doubleValue();
        Double unitPrice = (m.get("unitPrice") instanceof Number n) ? n.doubleValue() : null;
        String image = (String) m.get("image");
        String validFrom = (String) m.get("validFrom");
        String validUntil = (String) m.get("validUntil");

        String store = "";
        String logo = null;
        Object b = m.get("business");
        if (b instanceof Map<?, ?> bm) {
            store = Objects.toString(bm.get("name"), "");
            logo = (String) bm.get("positiveLogoImage");
        }

        return new DealDto(name, store, price, unitPrice, validFrom, validUntil, image, logo);
    }

    /**
     * Builds an encoded value for the "eta-location" cookie consumed by the API.
     */
    private String buildEtaLocationCookie(double lat, double lon, String city) {
        String json = String.format(Locale.ROOT,
                "{\"latitude\":%.6f,\"longitude\":%.6f,\"city\":\"%s\",\"country\":\"%s\",\"mode\":\"fallback\"}", lat,
                lon, city.replace("\"", "\\\""), countryCode);
        return URLEncoder.encode(json, StandardCharsets.UTF_8);
    }
}