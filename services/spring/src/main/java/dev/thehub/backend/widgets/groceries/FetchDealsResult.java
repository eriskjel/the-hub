package dev.thehub.backend.widgets.groceries;

import dev.thehub.backend.widgets.groceries.dto.DealDto;
import java.util.List;

/**
 * Result of fetching grocery deals: the list and whether it was already
 * enriched by Gemini (cache hit) so the client can refetch later for live
 * update.
 */
public record FetchDealsResult(List<DealDto> deals, boolean isEnriched) {
}
