/**
 * Single source of truth for monster case data shared by client (animation,
 * stats rendering) and server (authoritative roll in /api/monster/open).
 *
 * Re-exports the existing case definitions so we don't have to move files,
 * and owns the rarity probability table that was previously duplicated
 * inside useDrinkCase.
 */
import { CASES, type CaseKey } from "@/app/[locale]/(protected)/monster/cases";
import type { DrinkRarity, DrinkVariant } from "@/app/[locale]/(protected)/monster/types";

export { CASES };
export type { CaseKey, DrinkRarity, DrinkVariant };

/**
 * Drop rates per rarity. Must sum to 100.
 * Source of truth — imported by both the visual spinner and the server roll.
 */
export const RARITY_PROBABILITIES: Readonly<Record<DrinkRarity, number>> = Object.freeze({
    blue: 79.92,
    purple: 15.98,
    pink: 3.2,
    red: 0.64,
    yellow: 0.26,
});

export const CASE_KEYS: readonly CaseKey[] = Object.freeze(Object.keys(CASES) as CaseKey[]);

export function isCaseKey(value: unknown): value is CaseKey {
    return typeof value === "string" && (CASE_KEYS as readonly string[]).includes(value);
}

/**
 * Lookup map: caseType → (itemName → DrinkVariant). Built once at module load.
 * Used by the server to validate that a reported item exists in the catalog
 * and to derive its canonical rarity + image.
 */
export const VARIANTS_BY_CASE: Readonly<Record<CaseKey, ReadonlyMap<string, DrinkVariant>>> =
    Object.freeze(
        CASE_KEYS.reduce(
            (acc, key) => {
                acc[key] = new Map(CASES[key].variants.map((v) => [v.name, v]));
                return acc;
            },
            {} as Record<CaseKey, ReadonlyMap<string, DrinkVariant>>
        )
    );
