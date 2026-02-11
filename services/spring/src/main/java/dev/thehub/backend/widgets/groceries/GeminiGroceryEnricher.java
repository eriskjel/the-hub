package dev.thehub.backend.widgets.groceries;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.thehub.backend.widgets.groceries.dto.DealDto;
import dev.thehub.backend.widgets.groceries.dto.GeminiDealDecision;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
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

    private final ConcurrentHashMap<String, List<DealDto>> cache = new ConcurrentHashMap<>();

    @Value("${groceries.gemini.api-key:}")
    private String apiKey;

    @Value("${groceries.gemini.timeout-seconds:15}")
    private int timeoutSeconds;

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
        return apiKey != null && !apiKey.isBlank();
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
    public Optional<List<DealDto>> getCachedEnrichment(String query, String city) {
        String key = buildCacheKey(query, city);
        List<DealDto> cached = cache.get(key);
        return cached != null && !cached.isEmpty() ? Optional.of(cached) : Optional.empty();
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
        if (cache.containsKey(key))
            return;
        List<DealDto> dealSnapshot = new ArrayList<>(deals);
        executor.execute(() -> {
            try {
                List<GeminiDealDecision> decisions = filterAndEnrich(query, dealSnapshot);
                if (decisions.isEmpty())
                    return;
                List<DealDto> merged = merge(dealSnapshot, decisions);
                if (!merged.isEmpty()) {
                    cache.put(key, merged);
                    log.info("Gemini groceries cached key={} size={}", key, merged.size());
                }
            } catch (Exception e) {
                if (e instanceof HttpClientErrorException.TooManyRequests) {
                    log.warn("Gemini rate limit exceeded, skipping enrichment");
                } else {
                    log.warn("Gemini async enrichment failed", e);
                }
            }
        });
    }

    private static List<DealDto> merge(List<DealDto> deals, List<GeminiDealDecision> decisions) {
        List<DealDto> out = new ArrayList<>();
        for (GeminiDealDecision dec : decisions) {
            if (!dec.isRelevant() || dec.index() < 0 || dec.index() >= deals.size())
                continue;
            DealDto d = deals.get(dec.index());
            String displayUnit = dec.displayUnit();
            Double displayPricePerUnit = dec.displayPricePerUnit();
            // Fallback: if deal has volume unit (l/cl/ml) and Gemini didn't return kr/l,
            // compute it
            if (isLiquidUnit(d.unitSymbol()) && !"kr/l".equals(displayUnit)) {
                Double perLiter = computePricePerLiter(d);
                if (perLiter != null) {
                    displayUnit = "kr/l";
                    displayPricePerUnit = perLiter;
                }
            }
            out.add(d.withDisplay(dec.cleanName(), displayUnit, displayPricePerUnit));
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
        Double size = d.unitSizeFrom();
        String sym = d.unitSymbol();
        if (pcs == null || pcs <= 0 || size == null || size <= 0 || sym == null || sym.isBlank())
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
        if (!isEnabled() || deals == null || deals.isEmpty()) {
            if (log.isDebugEnabled())
                log.debug("Gemini groceries skip: enabled={} dealsSize={}", isEnabled(),
                        deals == null ? 0 : deals.size());
            return List.of();
        }

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
        if (log.isDebugEnabled()) {
            try {
                String itemsJson = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(itemsForPrompt);
                log.debug("Gemini groceries request payload (products): {}", itemsJson);
            } catch (Exception e) {
                log.debug("Gemini groceries request payload (serialize skip): {}", e.getMessage());
            }
        }

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

            if (log.isDebugEnabled())
                log.debug("Gemini groceries response raw (first 800 chars): {}",
                        text.length() > 800 ? text.substring(0, 800) + "..." : text);

            List<Map<String, Object>> rawList = mapper.readValue(text,
                    mapper.getTypeFactory().constructCollectionType(List.class, Map.class));
            List<GeminiDealDecision> decisions = new ArrayList<>();
            int relevantCount = 0;
            for (Map<String, Object> o : rawList) {
                int index = number(o.get("index"), 0).intValue();
                boolean isRelevant = Boolean.TRUE.equals(o.get("is_relevant"))
                        || Boolean.TRUE.equals(o.get("isRelevant"));
                if (isRelevant)
                    relevantCount++;
                String cleanName = string(o.get("clean_name"), o.get("cleanName"));
                String displayUnit = string(o.get("display_unit"), o.get("displayUnit"));
                Double displayPrice = toDouble(o.get("display_price_per_unit"), o.get("displayPricePerUnit"));
                if (log.isDebugEnabled())
                    log.debug("Gemini decision index={} isRelevant={} display_unit={} display_price_per_unit={}", index,
                            isRelevant, displayUnit, displayPrice);
                decisions.add(new GeminiDealDecision(index, isRelevant, cleanName, displayUnit, displayPrice));
            }
            if (!decisions.isEmpty() && log.isInfoEnabled())
                log.info(
                        "Gemini groceries ok decisions={} relevant={} sample display_unit={} display_price_per_unit={}",
                        decisions.size(), relevantCount, decisions.get(0).displayUnit(),
                        decisions.get(0).displayPricePerUnit());
            else
                log.info("Gemini groceries ok decisions={} relevant={}", decisions.size(), relevantCount);
            return decisions;
        } catch (Exception e) {
            log.warn("Gemini groceries call failed, using unfiltered list: {}", e.getMessage(), e);
            return List.of();
        }
    }

    private static String buildPrompt(String userQuery, List<Map<String, Object>> items) {
        try {
            String itemsJson = new ObjectMapper().writeValueAsString(items);
            return """
                    You are a grocery backend assistant. Filter and format raw API search results for a grocery price comparison widget.

                    Rules:
                    1. Relevance: Mark is_relevant false for any product that does NOT match the user's search intent. (e.g. if the user searched for "Monster" energy drink, mark false for "Monster" brand car parts, cables, door protectors, spades, or other non-food items.) Keep only food/drink that matches the query.
                    2. Units: If unitSymbol is "l", "cl", or "ml", or the product name suggests liquid (e.g. soda, Pepsi, 0.33l, 1.5l, 33cl), you MUST use display_unit "kr/l" and set display_price_per_unit to price per liter: total_liters = (pieceCountFrom or 1) * (unitSizeFrom in liters: if unitSymbol is "cl" divide by 100, if "ml" divide by 1000). display_price_per_unit = price / total_liters. Never use "kr/kg" for beverages or liquids. For dry goods by weight only use "kr/kg". For piece counts (e.g. dishwasher tabs) use "kr/stk".
                    3. Clean name: Set clean_name to a short product name (e.g. "Monster Green 0.5l"); remove text like "4-pak", "billig!", extra marketing.

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
}
