import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { groceryCreateSettingsSchema, groceryEditSettingsSchema } from "@/widgets/create/registry";

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
    /** LLM-cleaned name when Gemini filter ran */
    displayName?: string;
    /** e.g. "kr/l", "kr/kg", "kr/stk" when Gemini normalized units */
    displayUnit?: string;
    /** Price per display unit when set by Gemini */
    displayPricePerUnit?: number;
};

/** API response: list plus flag so frontend can refetch when enrichment completes */
export type GroceryDealsResponse = { deals: Deal[]; isEnriched: boolean };

type GrocerySettingsUnion =
    | z.infer<typeof groceryCreateSettingsSchema>
    | z.infer<typeof groceryEditSettingsSchema>;

export type GroceryForm = UseFormReturn<{
    kind: "grocery-deals";
    settings: GrocerySettingsUnion;
}>;

export type GroceryErrors = {
    settings?: {
        query?: { message?: string };
        maxResults?: { message?: string };
        city?: { message?: string };
        lat?: { message?: string };
        lon?: { message?: string };
    };
};
