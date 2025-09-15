package dev.thehub.backend.widgets.groceries;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.thehub.backend.widgets.groceries.dto.DealDto;
import dev.thehub.backend.widgets.groceries.dto.GroceryDealsSettings;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Function;
import java.util.regex.Pattern;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

/**
 * GroceriesService integrates with the external Etilbudsavis API to search for
 * grocery offers and map them into the widget's domain DTOs. It handles:
 * <ul>
 * <li>Constructing the API request (GraphQL-like NDJSON) with location context
 * via a cookie</li>
 * <li>Parsing the NDJSON response and extracting the block that represents
 * offers</li>
 * <li>Mapping raw offer maps into {@link DealDto} with derived values (e.g.,
 * per piece and per-kg ranges)</li>
 * <li>Sorting by the best available metric (unit price preferred, otherwise
 * absolute price)</li>
 * <li>Filtering by excluded vendors and optionally surfacing preferred
 * vendors</li>
 * <li>Emitting Micrometer metrics with low-cardinality tags</li>
 * </ul>
 *
 * Configuration is supplied via Spring @Value properties (see
 * application-*.properties). The service is stateless with respect to requests;
 * it keeps a small in-memory alias map to normalize vendor names.
 */
@Service
@Getter
@Slf4j
public class GroceriesService {

    private final RestTemplate http;
    private final ObjectMapper mapper = new ObjectMapper();
    private final MeterRegistry metrics;
    private static final Pattern CSV_SPLIT = Pattern.compile("\\s*,\\s*");
    private static final Pattern SEP_COLLAPSE = Pattern.compile("[\\s\\-_/]+");

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

    @Value("${groceries.max-price:500}")
    private double defaultMaxPrice;

    private static final int SAFETY_CAP = 50;

    private final ConcurrentMap<String, String> groceriesVendorAliases = new ConcurrentHashMap<>();

    /**
     * Constructs the groceries service.
     *
     * @param http
     *            RestTemplate used to call the external Etilbudsavis API
     * @param metrics
     *            Micrometer registry for recording request metrics
     */
    public GroceriesService(RestTemplate http, MeterRegistry metrics) {
        this.http = http;
        this.metrics = metrics;
    }

    /**
     * Fetches grocery deals for the given settings.
     * <p>
     * This overload delegates to {@link #fetchDeals(GroceryDealsSettings, Integer)}
     * with no explicit top-N cap, so the effective limit will be taken from the
     * settings or default configuration.
     *
     * @param s
     *            search and location settings
     * @return a price-ascending list of deals; empty if the query term is blank or
     *         no data is returned
     * @throws IOException
     *             if network or parsing fails
     */
    public List<DealDto> fetchDeals(GroceryDealsSettings s) throws IOException {
        return fetchDeals(s, null);
    }

    /**
     * Queries the external Etilbudsavis API for grocery deals using the provided
     * settings and maps the response into a list of {@link DealDto}.
     * <p>
     * The method constructs the NDJSON request, sets a location cookie, performs
     * the HTTP call, parses the NDJSON response, maps each offer into a DealDto,
     * filters excluded vendors, sorts results by price metric, and optionally
     * applies a favorite-vendor preference.
     *
     * @param s
     *            search and location settings (query, city/lat/lon, optional max
     *            results)
     * @param top
     *            optional cap on the number of deals to return (must be > 0 to
     *            apply); when null or invalid, {@code maxResults} from settings or
     *            the configured default limit is used
     * @return a price-ascending list of deals; empty if the search term is blank or
     *         no data is available
     * @throws IOException
     *             if the response payload cannot be parsed as valid NDJSON/JSON
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
            } catch (IOException e) {
                throw new UncheckedIOException("Encoding payload failed", e);
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
        headers.setAccept(List.of(MediaType.parseMediaType("application/x-ndjson")));
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
        Map<String, Object> offersBlock = pickOffersBlock(lines);
        if (offersBlock == null)
            return List.of();

        Object valueObj = offersBlock.get("value");
        if (!(valueObj instanceof Map<?, ?> vm))
            return List.of();
        Object dataObj = vm.get("data");
        if (!(dataObj instanceof List<?> dl) || dl.isEmpty())
            return List.of();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> data = (List<Map<String, Object>>) (List<?>) dl;

        if (log.isDebugEnabled()) {
            lines.stream().limit(5).forEach(b -> {
                Object k = b.get("key");
                Object v = b.get("value");
                int count = 0;
                if (v instanceof Map<?, ?> innerVm) {
                    Object d = innerVm.get("data");
                    if (d instanceof List<?> dl2)
                        count = dl2.size();
                }
                log.debug("eta line key={} dataCount={}", k, count);
            });
        }

        final Set<String> excluded = excludedVendorsNormalized();
        final Set<String> preferred = preferredVendorsNormalized();

        // Base comparator: cheapest first by metric
        Comparator<DealDto> byMetric = Comparator.comparingDouble(GroceriesService::metricForSort);

        // If favorites are enabled, group favorites first (but still sort by price
        // inside groups).
        Comparator<DealDto> cmp = preferFavoritesEnabled
                ? Comparator.<DealDto, Boolean>comparing(d -> !preferred.contains(canonicalizeVendor(d.store())))
                        .thenComparing(byMetric)
                : byMetric;

        List<DealDto> sorted = data.stream().map(this::toDeal).filter(Objects::nonNull)
                .filter(d -> !excluded.contains(canonicalizeVendor(d.store()))).sorted(cmp).toList();

        List<DealDto> capped = (top != null && top > 0) ? sorted.stream().limit(top).toList() : sorted;

        if (log.isDebugEnabled() || sample(0.02)) {
            long ms = (System.nanoTime() - t0) / 1_000_000;
            log.info("Groceries fetched term={} city={} fetchLimit={} returned={} ms={}", norm(term),
                    norm(cityOrDefault(s)), fetchLimit, capped.size(), ms);
        }

        recordMetrics(term, s.city(), fetchLimit, capped.size(), t0, true);
        return capped;
    }

    /**
     * Reorders deals so that favorite vendors are preferred unless a non-favorite
     * item is strictly cheaper according to the sorting metric.
     *
     * <p>
     * The input list must already be sorted ascending by
     * {@link #metricForSort(DealDto)}. The output preserves that order within the
     * non-favorites that beat the cheapest favorite and within the favorites
     * themselves.
     *
     * @param deals
     *            input list sorted by {@link #metricForSort(DealDto)}
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
     * Maps a raw offer map from the API into a typed {@link DealDto} and computes
     * several derived attributes (e.g., per-piece price, min/max per-kg unit price
     * range). Entries with missing/invalid price are ignored (return null).
     *
     * @param m
     *            raw map representing a single offer document
     * @return a populated DealDto or null when essential fields are missing (e.g.,
     *         price)
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
                        String key = SEP_COLLAPSE.matcher(slug.trim().toLowerCase(Locale.ROOT)).replaceAll("");
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
     * Attempts to parse an integer from a Number or String. Accepts numeric strings
     * with optional surrounding whitespace.
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
     * Builds an encoded value for the "eta-location" cookie consumed by the
     * Etilbudsavis API. The cookie carries latitude, longitude, geohash, city and
     * country, and is URL-encoded.
     *
     * @param lat
     *            latitude in decimal degrees
     * @param lon
     *            longitude in decimal degrees
     * @param city
     *            city name to include (falls back to default if null)
     * @return URL-encoded JSON payload accepted by the API as eta-location cookie
     *         value
     */
    private String buildEtaLocationCookie(double lat, double lon, String city) {
        String c = (city == null ? defaultCity : city).trim();
        String payload = String.format(Locale.ROOT,
                "{\"latitude\":%.7f,\"longitude\":%.7f,\"geohash\":\"%s\",\"city\":\"%s\",\"country\":\"%s\",\"mode\":\"manual\",\"text\":\"%s\"}",
                lat, lon, geoHash(lat, lon), c.replace("\"", "\\\""), countryCode, c.replace("\"", "\\\""));
        return URLEncoder.encode(payload, StandardCharsets.UTF_8);
    }

    /**
     * Parses an NDJSON response body into a list of JSON objects (as maps). Blank
     * lines and solitary closing bracket tokens are ignored.
     *
     * @param raw
     *            raw response body in NDJSON format
     * @return list of parsed maps (one entry per non-empty line)
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
     * "19,90" or "19.90" and ignoring currency symbols/spaces.
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
     *
     * @param candidates
     *            values to inspect in order
     * @return first non-blank String or null
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
     * set for comparisons. Normalization applies canonicalization and alias
     * resolution so comparisons become stable.
     *
     * @return set of normalized vendor names marked as preferred
     */
    private Set<String> preferredVendorsNormalized() {
        return parseVendorCsvNormalized(preferredVendorsCsv);
    }

    /**
     * Normalizes a vendor/store name to a canonical lowercase form, applying
     * configured aliases and collapsing whitespace and common separators (space,
     * dash, underscore, slash).
     *
     * @param raw
     *            original store/vendor name
     * @return normalized canonical name used for comparisons
     */
    private String canonicalizeVendor(String raw) {
        if (raw == null)
            return "";
        String s = raw.trim().toLowerCase(Locale.ROOT);
        s = SEP_COLLAPSE.matcher(s).replaceAll(" ").trim();

        String aliasKey = SEP_COLLAPSE.matcher(s).replaceAll("");
        String alias = groceriesVendorAliases.get(aliasKey);
        return (alias != null && !alias.isBlank()) ? alias.trim().toLowerCase(Locale.ROOT) : s;
    }

    /**
     * Computes a sorting metric for an offer. Preference order:
     * <ol>
     * <li>Explicit unitPrice (per base unit, e.g., per kg) if present</li>
     * <li>Midpoint of computed unitPriceMin/unitPriceMax when available</li>
     * <li>Absolute price as a fallback</li>
     * </ol>
     *
     * @param d
     *            deal
     * @return numeric metric used for ascending sorting
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
     * set used for filtering results from the API.
     *
     * @return set of normalized vendor names to exclude from results
     */
    private Set<String> excludedVendorsNormalized() {
        return parseVendorCsvNormalized(excludedVendorsCsv);
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
            String key = SEP_COLLAPSE.matcher(k.trim().toLowerCase(Locale.ROOT)).replaceAll("");
            groceriesVendorAliases.putIfAbsent(key, v);
        });
    }

    /**
     * Records request metrics (count, latency, and result size) with
     * low-cardinality tags. Tags include success flag, a coarse city name, a coarse
     * term length class, and the limit used.
     *
     * @param term
     *            raw search term
     * @param city
     *            city used for the request (may be null)
     * @param limit
     *            fetch limit requested
     * @param outSize
     *            number of deals returned after filtering/capping
     * @param startNanos
     *            monotonic start time for latency measurement
     * @param success
     *            whether the HTTP call and parsing were successful
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

    /**
     * Returns a normalized string for tags/logging: lower-cased or <none> when
     * blank/null.
     *
     * @param s
     *            input
     * @return normalized string or <none>
     */
    private static String norm(String s) {
        return (s == null || s.isBlank()) ? "<none>" : s.toLowerCase(Locale.ROOT);
    }
    /**
     * Returns the city value used for logging: "<default>" when not provided.
     *
     * @param s
     *            settings
     * @return city or <default>
     */
    private static String cityOrDefault(GroceryDealsSettings s) {
        return (s.city() == null || s.city().isBlank()) ? "<default>" : s.city();
    }
    /**
     * Coarsely classifies the search term length for metrics tagging to avoid
     * cardinality explosions.
     *
     * @param term
     *            input term
     * @return one of: <none>, short (<=3), medium (<=8), long (>8)
     */
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
    /**
     * Bernoulli sampler used to occasionally enable info-level logs without
     * flooding the logs.
     *
     * @param p
     *            probability in [0,1)
     * @return true with probability p
     */
    private static boolean sample(double p) {
        return java.util.concurrent.ThreadLocalRandom.current().nextDouble() < p;
    }

    /**
     * Parses a CSV list of vendors and returns a normalized set using
     * {@link #canonicalizeVendor(String)}. Empty or blank inputs return an empty
     * set.
     *
     * @param csv
     *            comma-separated vendor names
     * @return normalized set
     */
    private Set<String> parseVendorCsvNormalized(String csv) {
        if (csv == null || csv.isBlank())
            return Set.of();
        String[] parts = CSV_SPLIT.split(csv);
        Set<String> out = new HashSet<>(parts.length);
        for (String p : parts) {
            String c = canonicalizeVendor(p);
            if (!c.isBlank())
                out.add(c);
        }
        return out;
    }

    /**
     * Heuristically picks the block that contains "offers" from a list of NDJSON
     * lines. It looks for a value.data list whose entries resemble offer documents
     * (contain business/store and price/unitPrice).
     *
     * @param lines
     *            parsed NDJSON lines
     * @return the first matching block map, or null if none found
     */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> pickOffersBlock(List<Map<String, Object>> lines) {
        for (Map<String, Object> b : lines) {
            Object v = b.get("value");
            if (!(v instanceof Map<?, ?> vm))
                continue;
            Object data = vm.get("data");
            if (!(data instanceof List<?> list) || list.isEmpty())
                continue;

            // Heuristic: the offers "data" entries contain "business" and a "price".
            Object first = list.get(0);
            if (first instanceof Map<?, ?> m) {
                boolean looksLikeOffer = (m.containsKey("business") || m.containsKey("store"))
                        && (m.containsKey("price") || m.containsKey("unitPrice"));
                if (looksLikeOffer)
                    return b;
            }
        }
        return null;
    }

    /**
     * Encodes latitude/longitude into a geohash string with fixed precision.
     *
     * @param lat
     *            latitude in decimal degrees
     * @param lon
     *            longitude in decimal degrees
     * @return base32 geohash (precision 7)
     */
    private static String geoHash(double lat, double lon) {
        final String BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
        int precision = 7; // matches their example
        double minLat = -90, maxLat = 90, minLon = -180, maxLon = 180;
        boolean evenBit = true;
        int bit = 0, ch = 0;
        StringBuilder hash = new StringBuilder();

        while (hash.length() < precision) {
            if (evenBit) {
                double mid = (minLon + maxLon) / 2;
                if (lon >= mid) {
                    ch = (ch << 1) | 1;
                    minLon = mid;
                } else {
                    ch = (ch << 1);
                    maxLon = mid;
                }
            } else {
                double mid = (minLat + maxLat) / 2;
                if (lat >= mid) {
                    ch = (ch << 1) | 1;
                    minLat = mid;
                } else {
                    ch = (ch << 1);
                    maxLat = mid;
                }
            }
            evenBit = !evenBit;
            if (++bit == 5) {
                hash.append(BASE32.charAt(ch));
                bit = 0;
                ch = 0;
            }
        }
        return hash.toString();
    }
}