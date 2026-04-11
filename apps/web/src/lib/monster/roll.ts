/**
 * Server-side authoritative roll for monster cases.
 *
 * Uses node:crypto for unpredictable randomness — avoids any "Math.random is
 * seedable" concerns and costs nothing. Pure function, no IO, no side effects,
 * trivial to unit-test.
 */
import { randomInt } from "node:crypto";
import {
    CASES,
    RARITY_PROBABILITIES,
    type CaseKey,
    type DrinkRarity,
    type DrinkVariant,
} from "./catalog";

// Probabilities are expressed as percentages with two decimals. Work in
// hundredths of a percent to keep the arithmetic in integers.
const SCALE = 10_000;
const TOTAL_WEIGHT = Object.values(RARITY_PROBABILITIES).reduce(
    (sum, p) => sum + Math.round(p * 100),
    0
);

if (TOTAL_WEIGHT !== SCALE) {
    throw new Error(
        `RARITY_PROBABILITIES must sum to 100 (got ${TOTAL_WEIGHT / 100}) — check catalog.ts`
    );
}

function pickRarity(): DrinkRarity {
    // randomInt(min, max) returns integer in [min, max). Uniform.
    const roll = randomInt(0, SCALE);
    let acc = 0;
    for (const [rarity, p] of Object.entries(RARITY_PROBABILITIES) as [DrinkRarity, number][]) {
        acc += Math.round(p * 100);
        if (roll < acc) return rarity;
    }
    // Unreachable because TOTAL_WEIGHT === SCALE, but TypeScript needs a return.
    return "blue";
}

export type RollResult = {
    item: string;
    rarity: DrinkRarity;
    image: string;
};

/**
 * Roll a single variant from the given case, weighted by rarity.
 *
 * Falls back gracefully if a rarity has no variants in the case (e.g. a case
 * with no legendaries): re-picks from the "blue" pool, then from the full
 * pool. Avoids crashing on sparse catalogs.
 */
export function rollCase(caseKey: CaseKey): RollResult {
    const variants = CASES[caseKey].variants;
    const picked = pickRarity();

    const pickFromPool = (pool: DrinkVariant[]) => pool[randomInt(0, pool.length)];

    const pool = variants.filter((v) => v.rarity === picked);
    const chosen: DrinkVariant =
        pool.length > 0
            ? pickFromPool(pool)
            : pickFromPool(
                  variants.filter((v) => v.rarity === "blue").length > 0
                      ? variants.filter((v) => v.rarity === "blue")
                      : variants
              );

    return {
        item: chosen.name,
        rarity: chosen.rarity,
        image: chosen.image,
    };
}
