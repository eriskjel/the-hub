package dev.thehub.backend.widgets.groceries.dto;

/**
 * Data transfer object representing a single grocery deal.
 *
 * @param name
 *            product name
 * @param store
 *            store/business name
 * @param price
 *            final price
 * @param unitPrice
 *            optional unit price (may be null)
 * @param validFrom
 *            ISO date from which the deal is valid
 * @param validUntil
 *            ISO date until which the deal is valid
 * @param image
 *            product image URL
 * @param storeLogo
 *            optional store logo URL
 */
public record DealDto(String name, String store, double price, Double unitPrice, String validFrom, String validUntil,
        String image, String storeLogo) {
}