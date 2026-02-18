package dev.thehub.backend.widgets.groceries;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.thehub.backend.widgets.groceries.dto.DealDto;
import dev.thehub.backend.widgets.groceries.dto.GeminiDealDecision;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

/**
 * Calls the Gemini API to filter grocery deals by relevance to the user query
 * and to suggest display units (e.g. kr/l for liquids). Uses structured JSON
 * output and an in-memory cache for "fast first, refetch later": return raw
 * immediately, run Gemini in background, cache result for next request.
 */
@Component
@Slf4j
public class GeminiGroceryEnricher {

    private static final String GEMINI_MODEL = "gemini-2.5-flash";
    private static final String GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL
            + ":generateContent";

    private final RestTemplate http;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Executor executor;

    private record CachedEnrichment(List<DealDto> deals, String baseSignature, long cachedAtMs) {
    }

    private final ConcurrentHashMap<String, CachedEnrichment> cache = new ConcurrentHashMap<>();
    private final Set<String> inFlightRequests = ConcurrentHashMap.newKeySet();

    @Value("${groceries.gemini.enabled:true}")
    private boolean enabled;

    @Value("${groceries.gemini.api-key:}")
    private String apiKey;

    @Value("${groceries.gemini.cache-ttl-seconds:1800}")
    private long cacheTtlSeconds;

    @Value("${groceries.gemini.cache-stale-max-seconds:86400}")
    private long cacheStaleMaxSeconds;

    public GeminiGroceryEnricher(@Qualifier("geminiRestTemplate") RestTemplate http,
            @Qualifier("groceryEnrichmentExecutor") Executor executor) {
        this.http = http;
        this.executor = executor;
    }

    /**
     * Returns true if the enricher is configured (non-blank API key) and should be
     * used.
     */
    public boolean isEnabled() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }

    private static String buildCacheKey(String query, String city) {
        String q = (query == null) ? "" : query.trim().toLowerCase(Locale.ROOT);
        String c = (city == null || city.isBlank()) ? "" : city.trim().toLowerCase(Locale.ROOT);
        return q + "\t" + c;
    }

    /**
     * Returns cached enriched list for this query+city if present. Used for "fast
     * first, refetch later": first request returns raw and triggers async; refetch
     * gets cache hit.
     */
    public Optional<List<DealDto>> getCachedEnrichment(String query, String city, List<DealDto> currentBaseDeals) {
        String key = buildCacheKey(query, city);
        CachedEnrichment cached = cache.get(key);
        if (cached != null && !cached.deals().isEmpty()) {
            long ageMs = cacheAgeMs(cached);
            if (ageMs > ttlMs(cacheTtlSeconds)) {
                return Optional.empty();
            }

            String currentSignature = signatureOf(currentBaseDeals);
            if (!Objects.equals(cached.baseSignature(), currentSignature)) {
                return Optional.empty();
            }

            return Optional.of(cached.deals());
        }
        return Optional.empty();
    }

    /**
     * Returns stale cached enrichment (if not too old) for stale-while-revalidate.
     * This does not enforce signature freshness and should be paired with an async
     * refresh.
     */
    public Optional<List<DealDto>> getStaleCachedEnrichment(String query, String city) {
        String key = buildCacheKey(query, city);
        CachedEnrichment cached = cache.get(key);
        if (cached == null || cached.deals().isEmpty())
            return Optional.empty();

        long ageMs = cacheAgeMs(cached);
        if (ageMs > ttlMs(cacheStaleMaxSeconds)) {
            cache.remove(key);
            return Optional.empty();
        }
        return Optional.of(cached.deals());
    }

    /**
     * Runs Gemini in the background and caches the merged result. Call when cache
     * miss: return raw list immediately, then call this so the next request gets
     * enriched from cache.
     */
    public void triggerAsyncEnrichment(String query, String city, List<DealDto> deals) {
        if (!isEnabled() || deals == null || deals.isEmpty())
            return;
        String key = buildCacheKey(query, city);
        if (!inFlightRequests.add(key))
            return;
        if (cache.size() > 1000)
            cache.clear();
        List<DealDto> dealSnapshot = new ArrayList<>(deals);
        executor.execute(() -> {
            try {
                List<GeminiDealDecision> decisions = filterAndEnrich(query, dealSnapshot);
                if (decisions.isEmpty()) {
                    return;
                }
                List<DealDto> merged = merge(dealSnapshot, decisions);
                if (!merged.isEmpty()) {
                    cache.put(key, new CachedEnrichment(merged, signatureOf(dealSnapshot), System.currentTimeMillis()));
                    int dropped = Math.max(0, dealSnapshot.size() - merged.size());
                    log.info("Gemini groceries cached key={} inputSize={} outputSize={} dropped={}", key,
                            dealSnapshot.size(), merged.size(), dropped);
                }
            } catch (Exception e) {
                if (e instanceof HttpClientErrorException.TooManyRequests) {
                    log.warn("Gemini rate limit exceeded, skipping enrichment");
                } else {
                    log.warn("Gemini async enrichment failed: {}", e.getMessage());
                }
            } finally {
                inFlightRequests.remove(key);
            }
        });
    }

    private static List<DealDto> merge(List<DealDto> deals, List<GeminiDealDecision> decisions) {
        Map<Integer, GeminiDealDecision> decisionMap = decisions.stream()
                .collect(Collectors.toMap(GeminiDealDecision::index, d -> d, (a, b) -> a));
        List<DealDto> out = new ArrayList<>();
        for (int i = 0; i < deals.size(); i++) {
            DealDto original = deals.get(i);
            GeminiDealDecision dec = decisionMap.get(i);
            if (dec != null && !dec.isRelevant())
                continue;
            if (dec != null) {
                String displayUnit = dec.displayUnit();
                Double displayPricePerUnit = dec.displayPricePerUnit();
                if (isLiquidUnit(original.unitSymbol()) && !"kr/l".equals(displayUnit)) {
                    Double perLiter = computePricePerLiter(original);
                    if (perLiter != null) {
                        displayUnit = "kr/l";
                        displayPricePerUnit = perLiter;
                    }
                }
                out.add(original.withDisplay(dec.cleanName(), displayUnit, displayPricePerUnit));
            } else {
                out.add(original);
            }
        }
        return out.isEmpty() ? deals : out;
    }

    /** True if unit symbol indicates volume (liters). */
    private static boolean isLiquidUnit(String unitSymbol) {
        if (unitSymbol == null || unitSymbol.isBlank())
            return false;
        String s = unitSymbol.trim().toLowerCase(Locale.ROOT);
        return "l".equals(s) || "cl".equals(s) || "ml".equals(s) || "liter".equals(s) || "litre".equals(s);
    }

    /**
     * Computes price per liter when pieceCountFrom, unitSizeFrom and unitSymbol
     * (l/cl/ml) are present.
     */
    private static Double computePricePerLiter(DealDto d) {
        Integer pcs = d.pieceCountFrom();
        if (pcs == null)
            pcs = 1;
        Double size = d.unitSizeFrom();
        String sym = d.unitSymbol();
        if (pcs <= 0 || size == null || size <= 0 || sym == null || sym.isBlank())
            return null;
        String s = sym.trim().toLowerCase(Locale.ROOT);
        double litersPerPiece;
        if ("l".equals(s) || "liter".equals(s) || "litre".equals(s))
            litersPerPiece = size;
        else if ("cl".equals(s))
            litersPerPiece = size / 100.0;
        else if ("ml".equals(s))
            litersPerPiece = size / 1000.0;
        else
            return null;
        double totalLiters = pcs * litersPerPiece;
        if (totalLiters <= 0)
            return null;
        return d.price() / totalLiters;
    }

    /**
     * Sends the deal list and user query to Gemini and returns one decision per
     * deal (index, isRelevant, cleanName, displayUnit, displayPricePerUnit). On any
     * failure returns an empty list; caller should treat that as "keep all deals
     * unchanged".
     *
     * @param userQuery
     *            the widget search term (e.g. "Monster", "Pepsi max")
     * @param deals
     *            list of deals in display order
     * @return list of decisions, one per deal, or empty on error
     */
    @SuppressWarnings("unchecked")
    public List<GeminiDealDecision> filterAndEnrich(String userQuery, List<DealDto> deals) {
        if (!isEnabled() || deals == null || deals.isEmpty())
            return List.of();

        log.info("Gemini groceries calling model query='{}' dealCount={}", userQuery, deals.size());
        List<Map<String, Object>> itemsForPrompt = new ArrayList<>();
        for (int i = 0; i < deals.size(); i++) {
            DealDto d = deals.get(i);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("index", i);
            item.put("name", d.name());
            item.put("store", d.store());
            item.put("price", d.price());
            item.put("pieceCountFrom", d.pieceCountFrom());
            item.put("unitSizeFrom", d.unitSizeFrom());
            item.put("unitSymbol", d.unitSymbol());
            item.put("baseUnit", d.baseUnit());
            itemsForPrompt.add(item);
        }

        String prompt = buildPrompt(userQuery, itemsForPrompt);
        Map<String, Object> requestBody = buildRequestBody(prompt);

        try {
            String url = GEMINI_URL + "?key=" + apiKey;
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> req = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> resp = http.exchange(url, HttpMethod.POST, req, String.class);

            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                log.warn("Gemini groceries non-2xx or empty body status={} bodyNull={}", resp.getStatusCode(),
                        resp.getBody() == null);
                return List.of();
            }

            Map<String, Object> responseJson = mapper.readValue(resp.getBody(), Map.class);
            String text = extractResponseText(responseJson);
            if (text == null || text.isBlank()) {
                log.warn("Gemini groceries empty response text (check candidates/blockReason in response)");
                return List.of();
            }

            List<Map<String, Object>> rawList = mapper.readValue(text,
                    mapper.getTypeFactory().constructCollectionType(List.class, Map.class));
            List<GeminiDealDecision> decisions = new ArrayList<>();
            int relevantCount = 0;
            int irrelevantCount = 0;
            for (Map<String, Object> o : rawList) {
                int index = number(o.get("index"), 0).intValue();
                boolean isRelevant = Boolean.TRUE.equals(o.get("is_relevant"))
                        || Boolean.TRUE.equals(o.get("isRelevant"));
                if (isRelevant)
                    relevantCount++;
                else
                    irrelevantCount++;
                String cleanName = string(o.get("clean_name"), o.get("cleanName"));
                String displayUnit = string(o.get("display_unit"), o.get("displayUnit"));
                Double displayPrice = toDouble(o.get("display_price_per_unit"), o.get("displayPricePerUnit"));
                decisions.add(new GeminiDealDecision(index, isRelevant, cleanName, displayUnit, displayPrice));
            }
            log.info("Gemini groceries ok decisions={} relevant={} irrelevant={}", decisions.size(), relevantCount,
                    irrelevantCount);
            return decisions;
        } catch (Exception e) {
            log.warn("Gemini groceries call failed, using unfiltered list: {}", e.getMessage());
            return List.of();
        }
    }

    private static String buildPrompt(String userQuery, List<Map<String, Object>> items) {
        try {
            String itemsJson = new ObjectMapper().writeValueAsString(items);
            return """
                    You are a grocery backend assistant. Filter and format raw API search results for a grocery price comparison widget.

                    Rules:
                    1. Relevance: Mark is_relevant = true if the product matches the User Query in a supermarket context (Food, Drinks, Hygiene, Household, Baby, etc.). E.g. query "soap" + "Dish Soap" = relevant; query "Monster" + "Monster Energy 0.5l" = relevant.
                    2. Irrelevance: Mark is_relevant = false ONLY if the product is clearly unrelated to the query or not typically sold in a grocery store (e.g. car parts, cables, spades, door protectors). E.g. query "soap" + result that is car wax or car parts = irrelevant. Do NOT mark false just because something is not food (e.g. soap, detergent, hygiene) — if it matches the query and is commonly sold in supermarkets, mark relevant.
                    3. Units: If unitSymbol is "l", "cl", or "ml", or the product name suggests liquid (e.g. soda, Pepsi, 0.33l, 1.5l, 33cl), you MUST use display_unit "kr/l" and set display_price_per_unit to price per liter: total_liters = (pieceCountFrom or 1) * (unitSizeFrom in liters: if unitSymbol is "cl" divide by 100, if "ml" divide by 1000). display_price_per_unit = price / total_liters. Never use "kr/kg" for beverages or liquids. For dry goods by weight only use "kr/kg". For piece counts (e.g. dishwasher tabs) use "kr/stk".
                    4. Clean name: Set clean_name to a short product name (e.g. "Monster Green 0.5l"); remove text like "4-pak", "billig!", extra marketing.

                    User query: "%s"

                    Products (one per index):
                    %s

                    Return a JSON array with one object per product. Each object must have: index (integer), is_relevant (boolean), clean_name (string), display_unit (string), display_price_per_unit (number or null).
                    """
                    .formatted(userQuery.replace("\"", "\\\""), itemsJson);
        } catch (Exception e) {
            throw new RuntimeException("Build prompt failed", e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> buildRequestBody(String prompt) {
        Map<String, Object> schema = Map.of("type", "array", "items",
                Map.of("type", "object", "properties", Map.of("index",
                        Map.of("type", "integer", "description", "Zero-based index of the product"), "is_relevant",
                        Map.of("type", "boolean", "description", "True if product matches search intent"), "clean_name",
                        Map.of("type", "string", "description", "Short product name"), "display_unit",
                        Map.of("type", "string", "description", "e.g. kr/l, kr/kg, kr/stk"), "display_price_per_unit",
                        Map.of("type", "number", "description", "Price per display unit")), "required",
                        List.of("index", "is_relevant")));

        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("responseMimeType", "application/json");
        generationConfig.put("responseJsonSchema", schema);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", prompt)))));
        body.put("generationConfig", generationConfig);
        return body;
    }

    private static String extractResponseText(Map<String, Object> responseJson) {
        try {
            List<?> candidates = (List<?>) responseJson.get("candidates");
            if (candidates == null || candidates.isEmpty())
                return null;
            Map<String, Object> first = (Map<String, Object>) candidates.get(0);
            Map<String, Object> content = (Map<String, Object>) first.get("content");
            if (content == null)
                return null;
            List<?> parts = (List<?>) content.get("parts");
            if (parts == null || parts.isEmpty())
                return null;
            Map<String, Object> part = (Map<String, Object>) parts.get(0);
            return (String) part.get("text");
        } catch (Exception e) {
            return null;
        }
    }

    private static Number number(Object o, int defaultVal) {
        if (o instanceof Number n)
            return n;
        if (o instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException ignored) {
            }
        }
        return defaultVal;
    }

    private static String string(Object snake, Object camel) {
        if (snake instanceof String s && !s.isBlank())
            return s;
        if (camel instanceof String s && !s.isBlank())
            return s;
        return null;
    }

    private static Double toDouble(Object snake, Object camel) {
        if (snake instanceof Number n)
            return n.doubleValue();
        if (camel instanceof Number n)
            return n.doubleValue();
        if (snake instanceof String s) {
            try {
                return Double.parseDouble(s.replace(",", ".").trim());
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    private static String signatureOf(List<DealDto> deals) {
        if (deals == null || deals.isEmpty())
            return "empty";
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (DealDto d : deals) {
                updateDigest(md, d.name());
                updateDigest(md, d.store());
                updateDigest(md, d.validUntil());
                updateDigest(md, Double.toString(d.price()));
                updateDigest(md, d.unitSymbol());
                updateDigest(md, d.baseUnit());
                md.update((byte) '\n');
            }
            byte[] bytes = md.digest();
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (Exception ex) {
            // Extremely unlikely; degrade gracefully to size marker.
            return "fallback:" + deals.size();
        }
    }

    private static void updateDigest(MessageDigest md, String value) {
        String safe = (value == null) ? "<null>" : value;
        md.update(safe.getBytes(StandardCharsets.UTF_8));
        md.update((byte) '|');
    }

    private static long cacheAgeMs(CachedEnrichment cached) {
        return Math.max(0, System.currentTimeMillis() - cached.cachedAtMs());
    }

    private static long ttlMs(long ttlSeconds) {
        return Math.max(1, ttlSeconds) * 1000L;
    }
}
