package dev.thehub.backend.widgets.groceries.dto;

/**
 * Result of Gemini LLM filter/enrich for a single deal. Index matches the
 * position in the original list; is_relevant and display fields are from the
 * model.
 *
 * @param index
 *            zero-based index in the original deal list
 * @param isRelevant
 *            whether the item matches the user's search intent
 * @param cleanName
 *            shortened/cleaned product name (optional)
 * @param displayUnit
 *            e.g. "kr/l", "kr/kg", "kr/stk"
 * @param displayPricePerUnit
 *            price per unit in the display unit (optional)
 */
public record GeminiDealDecision(int index, boolean isRelevant, String cleanName, String displayUnit,
        Double displayPricePerUnit) {
}
