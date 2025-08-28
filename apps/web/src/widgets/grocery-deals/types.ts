export type Deal = {
    name: string;
    store: string;
    price: number;
    unitPrice?: number; // vendor per baseUnit
    unit?: string;
    validFrom?: string;
    validUntil?: string;
    image?: string;
    storeLogo?: string;
    pieceCountFrom?: number;
    pieceCountTo?: number;
    unitSizeFrom?: number;
    unitSizeTo?: number;
    unitSymbol?: string; // "g"
    baseUnit?: string; // "kilogram"
    perPiecePrice?: number; // computed
    unitPriceMin?: number; // computed
    unitPriceMax?: number; // computed
    multipack?: boolean;
};
