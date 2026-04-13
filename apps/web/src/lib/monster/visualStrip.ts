import { RARITY_PROBABILITIES } from "@/lib/monster/catalog";
import type { DrinkVariant } from "@/app/[locale]/(protected)/monster/types";

/**
 * Pure strip-generation logic for the monster spinner.
 *
 * Kept separate from React state so the shuffle/tease/injection algorithms
 * can be unit tested and reasoned about in isolation. The hook only calls
 * these and renders the result.
 */

export const LEGENDARY_PLACEHOLDER_IMAGE = "/drinks/gold.png";
const IDLE_STRIP_BASE_SIZE = 200;

// Rarity roll thresholds for the spinning strip — cumulative percents.
const COMMON_THRESHOLD = 70;
const MID_THRESHOLD = 90;
const RARE_THRESHOLD = 98;

// Gold tease window inside the strip (indices).
const TEASE_PROBABILITY = 0.4;
const TEASE_MIN_INDEX = 5; // don't tease right at the start
const TEASE_GAP_FROM_CHOSEN = 2; // never adjacent to the winner

/** Legendary items are shown as a gold placeholder until the reveal. */
export function maskLegendary(drinks: DrinkVariant[]): DrinkVariant[] {
    return drinks.map((d) =>
        d.rarity === "yellow" ? { ...d, image: LEGENDARY_PLACEHOLDER_IMAGE } : d
    );
}

/**
 * Idle strip shown before the user spins. Proportional to rarity weights so
 * the strip looks representative. Legendaries optionally excluded so the
 * placeholder doesn't dominate while nothing is happening.
 */
export function createWeightedStrip(
    drinks: DrinkVariant[],
    includeLegendary = true
): DrinkVariant[] {
    const byRarity = groupByRarity(drinks);
    const weighted: DrinkVariant[] = [];

    (Object.keys(RARITY_PROBABILITIES) as Array<DrinkVariant["rarity"]>).forEach((rarity) => {
        if (!includeLegendary && rarity === "yellow") return;

        const pool = byRarity[rarity];
        if (!pool || pool.length === 0) return;

        const allocation = Math.max(
            pool.length,
            Math.round((RARITY_PROBABILITIES[rarity] / 100) * IDLE_STRIP_BASE_SIZE)
        );

        let rotation = shuffle(pool);
        let rotationIndex = 0;
        for (let i = 0; i < allocation; i++) {
            if (rotationIndex >= rotation.length) {
                rotation = shuffle(pool);
                rotationIndex = 0;
            }
            weighted.push(rotation[rotationIndex]);
            rotationIndex++;
        }
    });

    if (weighted.length === 0) return shuffle(drinks);
    return shuffle(weighted);
}

/**
 * Build the strip shown during an active spin. Uses a per-rarity shuffled
 * queue so every item in a pool is shown before any repeats (no "same red
 * twice while other reds never appear"), with a single gold-placeholder
 * tease on ~40% of non-legendary spins.
 */
export function createVisualStrip(
    drinks: DrinkVariant[],
    chosen: DrinkVariant,
    rounds: number
): { strip: DrinkVariant[]; chosenIndex: number } {
    const commons = drinks.filter((d) => d.rarity === "blue");
    const mids = drinks.filter((d) => d.rarity === "purple" || d.rarity === "pink");
    const rares = drinks.filter((d) => d.rarity === "red");
    const legendaries = drinks.filter((d) => d.rarity === "yellow");

    const pickCommon = makeRarityQueue(commons);
    const pickMid = makeRarityQueue(mids);
    const pickRare = makeRarityQueue(rares);
    const pickLegend = makeRarityQueue(legendaries);

    const strip: DrinkVariant[] = [];
    for (let i = 0; i < rounds; i++) {
        const prevName = strip.length > 0 ? strip[strip.length - 1].name : undefined;
        const roll = Math.random() * 100;

        let candidate: DrinkVariant | null = null;
        if (roll < COMMON_THRESHOLD) candidate = pickCommon(prevName);
        else if (roll < MID_THRESHOLD) candidate = pickMid(prevName) ?? pickCommon(prevName);
        else if (roll < RARE_THRESHOLD)
            candidate = pickRare(prevName) ?? pickMid(prevName) ?? pickCommon(prevName);
        else if (chosen.rarity === "yellow")
            candidate = pickLegend(prevName) ?? pickRare(prevName) ?? pickCommon(prevName);
        else candidate = pickCommon(prevName);

        if (candidate) strip.push(candidate);
    }

    // Inject the winner at ~80% of the strip so there's still some tail to
    // decelerate through after it's in view.
    const chosenIndex = Math.floor(strip.length * 0.8);
    strip[chosenIndex] = chosen;

    scrubChosenNeighbors(strip, chosenIndex, chosen, drinks);
    maybeInjectGoldTease(strip, chosenIndex, chosen, legendaries);

    return { strip, chosenIndex };
}

/**
 * Neighbors of the injected winner were picked before the injection, so they
 * can collide with it. Replace any match with a different item — preferring
 * the same rarity bucket so the strip still feels balanced.
 */
function scrubChosenNeighbors(
    strip: DrinkVariant[],
    chosenIndex: number,
    chosen: DrinkVariant,
    drinks: DrinkVariant[]
) {
    const replace = (idx: number) => {
        if (idx < 0 || idx >= strip.length) return;
        if (strip[idx].name !== chosen.name) return;
        const sameRarity = drinks.filter(
            (d) => d.rarity === strip[idx].rarity && d.name !== chosen.name
        );
        const pool =
            sameRarity.length > 0 ? sameRarity : drinks.filter((d) => d.name !== chosen.name);
        if (pool.length > 0) strip[idx] = randomPick(pool);
    };
    replace(chosenIndex - 1);
    replace(chosenIndex + 1);
}

/**
 * On non-legendary spins, occasionally drop a single gold-placeholder card
 * into the strip (never adjacent to the winner) so the spinner flirts past
 * gold for drama. Legendary rolls already show gold at the reveal.
 */
function maybeInjectGoldTease(
    strip: DrinkVariant[],
    chosenIndex: number,
    chosen: DrinkVariant,
    legendaries: DrinkVariant[]
) {
    if (chosen.rarity === "yellow") return;
    if (legendaries.length === 0) return;
    if (Math.random() >= TEASE_PROBABILITY) return;

    const windowEnd = chosenIndex - TEASE_GAP_FROM_CHOSEN;
    if (windowEnd <= TEASE_MIN_INDEX) return;

    const teaseIndex = TEASE_MIN_INDEX + Math.floor(Math.random() * (windowEnd - TEASE_MIN_INDEX));
    strip[teaseIndex] = randomPick(legendaries);
}

/**
 * Shuffled queue that refills on exhaustion and avoids two-in-a-row.
 * Guarantees every item in the pool is shown before any repeats.
 */
function makeRarityQueue(pool: DrinkVariant[]) {
    let queue: DrinkVariant[] = [];
    const refill = () => {
        queue = shuffle(pool);
    };
    return (avoidName?: string): DrinkVariant | null => {
        if (pool.length === 0) return null;
        if (queue.length === 0) refill();
        let next = queue.shift()!;
        if (avoidName && next.name === avoidName && pool.length > 1) {
            if (queue.length === 0) refill();
            const swapWith = queue.shift()!;
            queue.unshift(next);
            next = swapWith;
        }
        return next;
    };
}

function groupByRarity(drinks: DrinkVariant[]) {
    return drinks.reduce(
        (acc, d) => {
            (acc[d.rarity] ||= []).push(d);
            return acc;
        },
        {} as Record<DrinkVariant["rarity"], DrinkVariant[]>
    );
}

function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function randomPick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
