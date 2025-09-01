package dev.thehub.backend.widgets.groceries;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.thehub.backend.widgets.groceries.dto.DealDto;
import dev.thehub.backend.widgets.groceries.dto.GroceryDealsSettings;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Function;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

/**
 * Service responsible for querying the external Etilbudsavis API and mapping
 * responses into domain DTOs for the grocery-deals widget.
 */
@Service
@Getter
@Slf4j
public class GroceriesService {

    private final RestTemplate http;
    private final ObjectMapper mapper = new ObjectMapper();
    private final MeterRegistry metrics;

    @Value("${etilbudsavis.base-url}")
    private String baseUrl;
    @Value("${etilbudsavis.default-city}")
    private String defaultCity;
    @Value("${etilbudsavis.default-lat}")
    private double defaultLat;
    @Value("${etilbudsavis.default-lon}")
    private double defaultLon;
    @Value("${etilbudsavis.country}")
    private String countryCode;
    @Value("${etilbudsavis.default-limit}")
    private int defaultLimit;
    @Value("${app.http.user-agent:TheHub/1.0 (+https://skjellevik.online)}")
    private String userAgent;

    @Value("${groceries.prefer-favorites:true}")
    private boolean preferFavoritesEnabled;

    @Value("${groceries.preferred-vendors:}")
    private String preferredVendorsCsv;

    @Value("#{${groceries.vendor-aliases:{}}}")
    private Map<String, String> vendorAliases = Map.of();

    @Value("${groceries.excluded-vendors:}")
    private String excludedVendorsCsv;

    private static final int SAFETY_CAP = 50;

    private final ConcurrentMap<String, String> groceriesVendorAliases = new ConcurrentHashMap<>();

    /**
     * Constructs the groceries service with an HTTP client.
     *
     * @param http
     *            RestTemplate used to call the external Etilbudsavis API
     */
    public GroceriesService(RestTemplate http, MeterRegistry metrics) {
        this.http = http;
        this.metrics = metrics;
    }

    /**
     * Convenience overload that delegates to
     * {@link #fetchDeals(GroceryDealsSettings, Integer)} without applying a top-N
     * limit.
     *
     * @param s
     *            search and location settings
     * @return a price-ascending list of deals; empty if term is blank or no data
     * @throws IOException
     *             if network or parsing fails
     */
    public List<DealDto> fetchDeals(GroceryDealsSettings s) throws IOException {
        return fetchDeals(s, null);
    }

    /**
     * Queries the external Etilbudsavis API for grocery deals using the provided
     * settings and maps the response into a list of {@link DealDto}.
     *
     * @param s
     *            search and location settings
     * @param top
     *            optional cap on the number of deals to return (must be > 0 to
     *            apply); when null or invalid, {@code maxResults} from settings or
     *            the configured default limit is used
     * @return a price-ascending list of deals; empty if term is blank or no data
     * @throws IOException
     *             if the response payload cannot be parsed
     */
    public List<DealDto> fetchDeals(GroceryDealsSettings s, Integer top) throws IOException {
        final long t0 = System.nanoTime();
        String term = Optional.ofNullable(s.query()).map(String::trim).orElse("");
        if (term.isEmpty())
            return List.of();

        final int desired = (top != null && top > 0)
                ? top
                : Optional.ofNullable(s.maxResults()).orElse(getDefaultLimit());
        final int fetchLimit = Math.min(Math.max(desired, 1), SAFETY_CAP);
        if (desired > SAFETY_CAP) {
            log.warn("Groceries desired_limit_exceeds_safety desired={} cap={}", desired, SAFETY_CAP);
        }
        Function<Object[], String> enc = parts -> {
            try {
                return Base64.getEncoder().encodeToString(mapper.writeValueAsBytes(parts));
            } catch (Exception e) {
                throw new RuntimeException("Encoding payload failed", e);
            }
        };

        final String qOffers = enc.apply(new Object[]{"offers", Map.of("hideUpcoming", false, "pagination",
                Map.of("limit", fetchLimit, "offset", 0), "searchTerm", term, "sort", List.of("score_desc"))});

        final Map<String, Object> payload = Map.of("data", List.of(qOffers));

        String etaCookie = buildEtaLocationCookie(s.lat() != null ? s.lat() : defaultLat,
                s.lon() != null ? s.lon() : defaultLon,
                (s.city() != null && !s.city().isBlank()) ? s.city() : defaultCity);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.parseMediaType("application/x-ndjson"), MediaType.APPLICATION_JSON));
        headers.add(HttpHeaders.COOKIE, "eta-location=" + etaCookie);
        headers.add(HttpHeaders.USER_AGENT, userAgent);
        headers.add(HttpHeaders.REFERER, baseUrl + "/");
        headers.add("X-Requested-With", "XMLHttpRequest");

        HttpEntity<Map<String, Object>> req = new HttpEntity<>(payload, headers);

        String raw;
        try {
            ResponseEntity<String> resp = http.exchange(baseUrl + "/", HttpMethod.POST, req, String.class);
            if (!resp.getStatusCode().is2xxSuccessful()) {
                log.warn("Etilbudsavis non2xx status={} reason={}", resp.getStatusCode().value(), resp.getStatusCode());
                recordMetrics(term, s.city(), fetchLimit, 0, t0, false);
                return List.of();
            }
            raw = Optional.ofNullable(resp.getBody()).orElse("");
        } catch (HttpStatusCodeException e) {
            final String errBody = Optional.ofNullable(e.getResponseBodyAsString()).orElse("");
            final int max = 256;
            final String truncated = errBody.length() > max ? errBody.substring(0, max) + "...[truncated]" : errBody;
            log.warn("Etilbudsavis error status={} reason={} body={}", e.getStatusCode().value(), e.getStatusText(),
                    truncated);
            recordMetrics(term, s.city(), fetchLimit, 0, t0, false);
            return List.of();
        } catch (Exception e) {
            log.error("Etilbudsavis call failed", e);
            recordMetrics(term, s.city(), fetchLimit, 0, t0, false);
            throw e;
        }
        if (raw.isBlank()) {
            recordMetrics(term, s.city(), fetchLimit, 0, t0, true);
            return List.of();
        }

        List<Map<String, Object>> lines = parseNdjson(raw);
        if (lines.isEmpty())
            return List.of();

        Map<String, Object> offersBlock = lines.stream().filter(b -> Objects.equals(b.get("key"), qOffers)).findFirst()
                .orElseGet(() -> lines.stream().filter(b -> {
                    Object v = ((Map<?, ?>) b.get("value"));
                    if (!(v instanceof Map<?, ?> vm))
                        return false;
                    Object d = vm.get("data");
                    return (d instanceof List<?>) && !((List<?>) d).isEmpty();
                }).findFirst().orElse(null));

        if (offersBlock == null)
            return List.of();

        @SuppressWarnings("unchecked")
        Map<String, Object> value = (Map<String, Object>) offersBlock.get("value");
        if (value == null)
            return List.of();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> data = (List<Map<String, Object>>) value.get("data");
        if (data == null || data.isEmpty())
            return List.of();

        final Set<String> excluded = excludedVendorsNormalized();
        final Set<String> preferred = preferredVendorsNormalized();

        List<DealDto> sorted = data.stream().map(this::toDeal).filter(Objects::nonNull)
                .filter(d -> !excluded.contains(canonicalizeVendor(d.store())))
                .sorted(Comparator.comparingDouble(GroceriesService::metricForSort)).toList();

        List<DealDto> capped = (top != null && top > 0) ? sorted.subList(0, Math.min(top, sorted.size())) : sorted;

        if (log.isDebugEnabled() || sample(0.02)) {
            long ms = (System.nanoTime() - t0) / 1_000_000;
            log.info("Groceries fetched term={} city={} fetchLimit={} returned={} ms={}", norm(term),
                    norm(cityOrDefault(s)), fetchLimit, capped.size(), ms);
        }

        recordMetrics(term, s.city(), fetchLimit, capped.size(), t0, true);

        if (!preferFavoritesEnabled) {
            return capped;
        }
        return applyPreferenceFilter(capped, preferred);
    }

    /**
     * Reorders deals so that favorite vendors are preferred unless a non-favorite
     * item is strictly cheaper according to the sorting metric.
     *
     * @param deals
     *            the input list already sorted by {@link #metricForSort(DealDto)}
     * @param favorites
     *            set of canonicalized favorite vendor names
     * @return a new list where favorites are surfaced without hiding better priced
     *         non-favorites
     */
    private List<DealDto> applyPreferenceFilter(List<DealDto> deals, Set<String> favorites) {
        if (deals.isEmpty() || favorites.isEmpty())
            return deals;

        List<DealDto> fav = new ArrayList<>();
        List<DealDto> non = new ArrayList<>();
        for (DealDto d : deals) {
            String storeNorm = canonicalizeVendor(d.store());
            if (favorites.contains(storeNorm))
                fav.add(d);
            else
                non.add(d);
        }
        if (fav.isEmpty())
            return deals;

        // compare using the same metric you sort with
        double cheapestFavMetric = metricForSort(fav.get(0));

        List<DealDto> allowedNon = new ArrayList<>();
        for (DealDto d : non) {
            if (metricForSort(d) < cheapestFavMetric) {
                allowedNon.add(d);
            }
        }

        // keep order: non-favs that truly beat favorites, then all favorites
        List<DealDto> out = new ArrayList<>(allowedNon.size() + fav.size());
        out.addAll(allowedNon);
        out.addAll(fav);
        return out;
    }

    /**
     * Maps a raw offer map from the API into a typed {@link DealDto}. Filters out
     * entries with missing/invalid price.
     *
     * @param m
     *            raw map representing a single offer document
     * @return a populated DealDto or null when essential fields are missing
     */
    private DealDto toDeal(Map<String, Object> m) {
        String name = Objects.toString(m.get("name"), "");

        Double priceD = toDouble(m.get("price"));
        if (priceD == null)
            return null;
        double price = priceD;

        Double unitPrice = toDouble(m.get("unitPrice")); // vendor’s per base unit
        String baseUnit = (String) m.getOrDefault("baseUnit", null); // e.g., "kilogram"
        String unitSymbol = (String) m.getOrDefault("unitSymbol", null); // e.g., "g"

        // legacy unit fallback (you had several sources)
        String unit = firstNonBlank(m.get("unit"), m.get("unitPriceUnit"), m.get("unitOfMeasure"));

        Double unitSizeFrom = toDouble(m.get("unitSizeFrom")); // e.g., grams
        Double unitSizeTo = toDouble(m.get("unitSizeTo"));
        Integer pieceCountFrom = toInt(m.get("pieceCountFrom"));
        Integer pieceCountTo = toInt(m.get("pieceCountTo"));

        String image = firstNonBlank(m.get("image"), m.get("imageLarge"));
        String validFrom = (String) m.get("validFrom");
        String validUntil = (String) m.get("validUntil");

        String store = "";
        String logo = null;
        Object b = m.get("business");
        if (b instanceof Map<?, ?> bm) {
            final String storeName = Objects.toString(bm.get("name"), ""); // <- final
            store = storeName;
            logo = (String) bm.get("positiveLogoImage");

            Object slugs = bm.get("slugs");
            if (slugs instanceof List<?> list) {
                for (Object s : list) {
                    if (s instanceof String slug && !slug.isBlank()) {
                        String key = slug.trim().toLowerCase(Locale.ROOT).replaceAll("[\\s\\-_/]+", "");
                        groceriesVendorAliases.computeIfAbsent(key, k -> storeName); // use final var
                    }
                }
            }
        }

        // Derived fields
        boolean multipack = pieceCountFrom != null && pieceCountFrom > 1;
        Double perPiecePrice = (multipack && price > 0) ? (price / pieceCountFrom) : null;

        // Compute per-kg min/max if we have sizes + unitSymbol in grams
        Double unitPriceMin = null, unitPriceMax = null;

        if (unitSymbol != null && unitSizeFrom != null && unitSizeFrom > 0) {
            String sym = unitSymbol.toLowerCase(Locale.ROOT);
            double factor; // to kg
            if (sym.equals("g"))
                factor = 1_000.0;
            else if (sym.equals("kg"))
                factor = 1.0;
            else
                factor = -1.0;

            if (factor > 0) {
                double pcsMin = (pieceCountFrom != null && pieceCountFrom > 0) ? pieceCountFrom : 1.0;
                double pcsMax = (pieceCountTo != null && pieceCountTo > 0) ? pieceCountTo : pcsMin;

                double wMinKg = (unitSizeFrom * pcsMin) / factor;
                Double wMaxKg = (unitSizeTo != null && unitSizeTo > 0) ? (unitSizeTo * pcsMax) / factor : null;

                if (wMinKg > 0)
                    unitPriceMax = price / wMinKg; // worst case (smallest weight)
                if (wMaxKg != null && wMaxKg > 0)
                    unitPriceMin = price / wMaxKg; // best case (largest weight)

                // if vendor provided unitPrice, backfill any missing bound(s)
                if (unitPriceMin == null && unitPrice != null)
                    unitPriceMin = unitPrice;
                if (unitPriceMax == null && unitPrice != null)
                    unitPriceMax = unitPrice;
            } else if (unitPrice != null) {
                unitPriceMin = unitPriceMax = unitPrice;
            }
        } else if (unitPrice != null) {
            unitPriceMin = unitPriceMax = unitPrice;
        }

        return new DealDto(name, store, price, unitPrice, validFrom, validUntil, image, logo, unit, pieceCountFrom,
                pieceCountTo, unitSizeFrom, unitSizeTo, unitSymbol, baseUnit, perPiecePrice, unitPriceMin, unitPriceMax,
                multipack);
    }

    /**
     * Attempts to parse an integer from a Number or String.
     *
     * @param o
     *            number or numeric string
     * @return Integer value or null if parsing fails
     */
    private static Integer toInt(Object o) {
        if (o instanceof Number n)
            return n.intValue();
        if (o instanceof String s && !s.isBlank()) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException ignore) {
            }
        }
        return null;
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

    /**
     * Parses an ndjson response body into a list of JSON objects. Blank lines and
     * closing bracket tokens are ignored.
     *
     * @param raw
     *            raw response body in NDJSON format
     * @return list of parsed maps
     * @throws IOException
     *             if any line fails to parse as JSON
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseNdjson(String raw) throws IOException {
        List<Map<String, Object>> out = new ArrayList<>();
        for (String line : raw.split("\\r?\\n")) {
            String t = line.trim();
            if (t.isEmpty() || "]".equals(t))
                continue;
            out.add(mapper.readValue(t, Map.class));
        }
        return out;
    }

    /**
     * Attempts to parse a double from a Number or String, tolerating formats like
     * "19,90" or "19.90" and ignoring currency symbols.
     *
     * @param o
     *            number or numeric string
     * @return Double value or null if parsing fails
     */
    private static Double toDouble(Object o) {
        if (o instanceof Number n)
            return n.doubleValue();
        if (o instanceof String s) {
            try {
                // tolerate "19,90" or "19.90" (strip currency symbols/spaces)
                var clean = s.replaceAll("[^0-9,\\.]", "").replace(',', '.');
                if (clean.isEmpty())
                    return null;
                return Double.parseDouble(clean);
            } catch (NumberFormatException ignore) {
            }
        }
        return null;
    }

    /**
     * Returns the first argument that is a non-blank String, or null if none.
     */
    private static String firstNonBlank(Object... candidates) {
        for (Object c : candidates) {
            if (c instanceof String s && !s.isBlank())
                return s;
        }
        return null;
    }

    /**
     * Parses the preferred vendors CSV from configuration and returns a normalized
     * set for comparisons.
     */
    private Set<String> preferredVendorsNormalized() {
        if (preferredVendorsCsv == null || preferredVendorsCsv.isBlank())
            return Set.of();
        String[] parts = preferredVendorsCsv.split("\\s*,\\s*");
        Set<String> out = new HashSet<>();
        for (String p : parts) {
            String c = canonicalizeVendor(p);
            if (!c.isBlank())
                out.add(c);
        }
        return out;
    }

    /**
     * Normalizes a vendor/store name to a canonical lowercase form, applying
     * configured aliases and collapsing whitespace and separators.
     */
    private String canonicalizeVendor(String raw) {
        if (raw == null)
            return "";
        String s = raw.trim().toLowerCase(Locale.ROOT);
        s = s.replaceAll("[\\s\\-_/]+", " ").trim();

        // alias map: normalize inputs like "rema1000" -> "rema 1000"
        String aliasKey = s.replaceAll("[\\s\\-_/]+", "");
        String alias = groceriesVendorAliases.get(aliasKey);
        if (alias != null && !alias.isBlank()) {
            return alias.trim().toLowerCase(Locale.ROOT);
        }
        return s;
    }

    /**
     * Computes a sorting metric: prefer unit price when available, otherwise use
     * the absolute price. If min/max unit prices exist, use their midpoint.
     */
    private static double metricForSort(DealDto d) {
        // prefer unit price (per kg) if present; else fallback to absolute price
        Double up = d.unitPrice();
        if (up != null)
            return up;
        // if we computed min/max, prefer the midpoint
        if (d.unitPriceMin() != null && d.unitPriceMax() != null) {
            return (d.unitPriceMin() + d.unitPriceMax()) / 2.0;
        }
        return d.price();
    }

    /**
     * Parses the excluded vendors CSV from configuration and returns a normalized
     * set for filtering results.
     */
    private Set<String> excludedVendorsNormalized() {
        if (excludedVendorsCsv == null || excludedVendorsCsv.isBlank())
            return Set.of();
        String[] parts = excludedVendorsCsv.split("\\s*,\\s*");
        Set<String> out = new HashSet<>();
        for (String p : parts) {
            String c = canonicalizeVendor(p);
            if (!c.isBlank())
                out.add(c);
        }
        return out;
    }

    /**
     * Initializes the runtime alias map for vendor normalization using the
     * configured aliases. Executed once after bean construction.
     */
    @PostConstruct
    void initVendorAliases() {
        vendorAliases.forEach((k, v) -> {
            if (k == null || v == null)
                return;
            String key = k.trim().toLowerCase(Locale.ROOT).replaceAll("[\\s\\-_/]+", "");
            groceriesVendorAliases.putIfAbsent(key, v);
        });
    }

    /**
     * Records request metrics (count, latency, and result size) with
     * low-cardinality tags.
     */
    private void recordMetrics(String term, String city, int limit, int outSize, long startNanos, boolean success) {
        long ms = (System.nanoTime() - startNanos) / 1_000_000;
        io.micrometer.core.instrument.Tags tags = io.micrometer.core.instrument.Tags.of("success",
                Boolean.toString(success), "city", norm(city),
                // keep term coarse to avoid cardinality explosions:
                "term_class", termClass(term), "limit", Integer.toString(limit));
        metrics.counter("thehub.groceries.requests", tags).increment();
        metrics.summary("thehub.groceries.results.count", tags).record(outSize);
        metrics.timer("thehub.groceries.latency", tags).record(ms, java.util.concurrent.TimeUnit.MILLISECONDS);
    }

    private static String norm(String s) {
        return (s == null || s.isBlank()) ? "<none>" : s.toLowerCase(Locale.ROOT);
    }
    private static String cityOrDefault(GroceryDealsSettings s) {
        return (s.city() == null || s.city().isBlank()) ? "<default>" : s.city();
    }
    private static String termClass(String term) {
        if (term == null)
            return "<none>";
        int len = term.length();
        if (len <= 3)
            return "short";
        if (len <= 8)
            return "medium";
        return "long";
    }
    private static boolean sample(double p) {
        return java.util.concurrent.ThreadLocalRandom.current().nextDouble() < p;
    }
}