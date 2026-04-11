import { useEffect, useState } from "react";
import {
    ANIMATION_DURATION,
    CONTAINER_WIDTH,
    ITEM_WIDTH,
    SPIN_ROUNDS,
} from "@/app/[locale]/(protected)/monster/constants";
import { RARITY_PROBABILITIES } from "@/lib/monster/catalog";
import type { DrinkRarity, DrinkVariant } from "../types";

const LEGENDARY_PLACEHOLDER_IMAGE = "/drinks/gold.png";
const SPINNER_STRIP_BASE_SIZE = 200;

export function validateRarityWeightsDev() {
    if (process.env.NODE_ENV !== "development") return;
    const total = Object.values(RARITY_PROBABILITIES).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.001) {
        console.warn(`RARITY_PROBABILITIES sum to ${total}, expected 100`);
    }
}

/**
 * The caller (page.tsx) performs the authoritative roll via the server and
 * hands the result back through this callback. The hook is purely responsible
 * for the visual animation + the "latest result" UI state.
 */
export type RollFn = () => Promise<{
    item: string;
    rarity: DrinkRarity;
    image: string;
}>;

export function useDrinkCase(drinks: DrinkVariant[], roll: RollFn) {
    if (process.env.NODE_ENV === "development") validateRarityWeightsDev();

    const [selected, setSelected] = useState<DrinkVariant | null>(null);
    const [rolling, setRolling] = useState(false);
    const [opening, setOpening] = useState(false); // waiting on the server roll
    const [offset, setOffset] = useState(0);
    const [animate, setAnimate] = useState(true);
    const [stripDrinks, setStripDrinks] = useState<DrinkVariant[]>(() =>
        maskLegendary(drinks.filter((d) => d.rarity !== "yellow"))
    );
    const [spinSound, setSpinSound] = useState<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio("/sounds/cs.m4a");
        audio.addEventListener("error", () => {
            console.warn("Failed to load audio file: /sounds/cs.m4a");
            setSpinSound(null);
        });
        setSpinSound(audio);
    }, []);

    useEffect(() => {
        setStripDrinks(maskLegendary(createWeightedStrip(drinks, false)));
    }, [drinks]);

    const handleOpen = async () => {
        if (rolling || opening) return;

        setOpening(true);
        let result: Awaited<ReturnType<RollFn>>;
        try {
            result = await roll();
        } catch {
            // Caller is expected to surface the error via its own toast/UI
            // (mutation.error); we just bail out so the button re-enables.
            setOpening(false);
            return;
        }

        // Hydrate the chosen variant using catalog data (image from server
        // may differ if someone races a catalog change; trust the server).
        const chosenVariant: DrinkVariant = {
            name: result.item,
            image: result.image,
            rarity: result.rarity,
        };

        if (spinSound) {
            spinSound.currentTime = 0;
            spinSound.play().catch(() => {
                // autoplay restrictions may require user gesture
            });
        }

        const spinStrip = createVisualStrip(drinks, chosenVariant, 40);
        setStripDrinks(maskLegendary(spinStrip));

        setAnimate(true);
        setOpening(false);
        setRolling(true);
        setOffset(0);
        setSelected(chosenVariant);

        const chosenIndex = spinStrip.findIndex((d) => d.name === chosenVariant.name);
        const centerOffset = CONTAINER_WIDTH / 2 - ITEM_WIDTH / 2;
        const finalOffset =
            (spinStrip.length * SPIN_ROUNDS + chosenIndex) * ITEM_WIDTH - centerOffset;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => setOffset(finalOffset));
        });

        setTimeout(() => setRolling(false), ANIMATION_DURATION);
    };

    const reset = () => {
        setAnimate(false);
        setOffset(0);
        setSelected(null);
        setRolling(false);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => setAnimate(true));
        });
    };

    return {
        selected,
        rolling,
        opening,
        offset,
        handleOpen,
        reset,
        duration: ANIMATION_DURATION,
        animate,
        stripMonsters: stripDrinks,
    };
}

function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function maskLegendary(drinks: DrinkVariant[]): DrinkVariant[] {
    return drinks.map((d) =>
        d.rarity === "yellow" ? { ...d, image: LEGENDARY_PLACEHOLDER_IMAGE } : d
    );
}

function createWeightedStrip(drinks: DrinkVariant[], includeLegendary = true): DrinkVariant[] {
    const byRarity = drinks.reduce(
        (acc, d) => {
            (acc[d.rarity] ||= []).push(d);
            return acc;
        },
        {} as Record<DrinkVariant["rarity"], DrinkVariant[]>
    );

    const weighted: DrinkVariant[] = [];
    (Object.keys(RARITY_PROBABILITIES) as Array<DrinkVariant["rarity"]>).forEach((rarity) => {
        if (!includeLegendary && rarity === "yellow") return;

        const pool = byRarity[rarity];
        if (!pool || pool.length === 0) return;

        const allocation = Math.max(
            pool.length,
            Math.round((RARITY_PROBABILITIES[rarity] / 100) * SPINNER_STRIP_BASE_SIZE)
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

function createVisualStrip(
    drinks: DrinkVariant[],
    chosen: DrinkVariant,
    rounds: number = 30
): DrinkVariant[] {
    const commons = drinks.filter((d) => d.rarity === "blue");
    const mids = drinks.filter((d) => ["purple", "pink"].includes(d.rarity));
    const rares = drinks.filter((d) => d.rarity === "red");
    const legendaries = drinks.filter((d) => d.rarity === "yellow");

    const strip: DrinkVariant[] = [];

    for (let i = 0; i < rounds; i++) {
        let pool: DrinkVariant[] = commons;

        const roll = Math.random() * 100;
        if (roll < 70 && commons.length) pool = commons;
        else if (roll < 90 && mids.length) pool = mids;
        else if (roll < 98 && rares.length) pool = rares;
        else if (legendaries.length && chosen.rarity === "yellow") pool = legendaries;

        let candidate: DrinkVariant | null = null;
        let attempts = 0;

        if (pool.length > 0) {
            do {
                candidate = randomPick(pool);
                attempts++;
            } while (
                strip.length > 0 &&
                candidate.name === strip[strip.length - 1].name &&
                attempts < 5
            );
        }

        if (candidate) {
            strip.push(candidate);
        }
    }

    // inject chosen near the end
    const insertPos = Math.floor(strip.length * 0.8);
    strip[insertPos] = chosen;

    return strip;
}

function randomPick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
