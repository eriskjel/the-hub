package dev.thehub.backend.widgets.groceries.dto;

import java.util.List;

/**
 * API response wrapper for grocery deals. Tells the frontend whether the list
 * was already enriched by Gemini (cache hit) so it can skip or schedule a
 * delayed refetch.
 *
 * @param deals
 *            list of deals (raw or enriched)
 * @param isEnriched
 *            true if Gemini enrichment was applied (from cache or sync)
 */
public record GroceryDealsResponse(List<DealDto> deals, boolean isEnriched) {
}
