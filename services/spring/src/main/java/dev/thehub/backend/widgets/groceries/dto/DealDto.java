package dev.thehub.backend.widgets.groceries.dto;

/**
 * Data transfer object representing a single grocery deal.
 *
 * <p>
 * Fields include both vendor-provided values and computed conveniences for
 * client sorting/rendering.
 *
 * @param name
 *            product name
 * @param store
 *            store/business name
 * @param price
 *            final price
 * @param unitPrice
 *            optional vendor-provided unit price per {@code baseUnit} (may be
 *            null)
 * @param validFrom
 *            ISO date from which the deal is valid
 * @param validUntil
 *            ISO date until which the deal is valid
 * @param image
 *            product image URL
 * @param storeLogo
 *            optional store logo URL
 * @param unit
 *            optional unit label (legacy; e.g., "lb")
 * @param pieceCountFrom
 *            minimum number of pieces in a multipack (nullable)
 * @param pieceCountTo
 *            maximum number of pieces in a multipack (nullable)
 * @param unitSizeFrom
 *            minimum size per piece (e.g., grams) (nullable)
 * @param unitSizeTo
 *            maximum size per piece (nullable)
 * @param unitSymbol
 *            unit symbol for size (e.g., "g" or "kg") (nullable)
 * @param baseUnit
 *            base unit for {@code unitPrice} (e.g., "kilogram") (nullable)
 * @param perPiecePrice
 *            computed convenience: {@code price / pieceCountFrom} when
 *            multipack
 * @param unitPriceMin
 *            computed best-case unit price per kg based on sizes (nullable)
 * @param unitPriceMax
 *            computed worst-case unit price per kg based on sizes (nullable)
 * @param multipack
 *            indicates whether the offer is a multipack
 */
public record DealDto(String name, String store, double price, Double unitPrice, // vendor-provided per baseUnit (e.g.,
                                                                                 // kr/kg)
        String validFrom, String validUntil, String image, String storeLogo, String unit, Integer pieceCountFrom,
        Integer pieceCountTo, Double unitSizeFrom, Double unitSizeTo, String unitSymbol, // e.g., "g"
        String baseUnit, // e.g., "kilogram"
        Double perPiecePrice, // computed: price / pieceCountFrom (when >1)
        Double unitPriceMin, // computed from sizes (best-case per-kg)
        Double unitPriceMax, // computed from sizes (worst-case per-kg)
        Boolean multipack // (pieceCountFrom != null && >1)
) {
}