import { useEffect, useState } from "react";
import { DrinkVariant } from "../types";
import {
    ANIMATION_DURATION,
    CONTAINER_WIDTH,
    ITEM_WIDTH,
    SPIN_ROUNDS,
} from "@/app/[locale]/(protected)/monster/constants";

const RARITY_PROBABILITIES = Object.freeze({
    blue: 79.92,
    purple: 15.98,
    pink: 3.2,
    red: 0.64,
    yellow: 0.26,
});

const LEGENDARY_PLACEHOLDER_IMAGE = "/drinks/gold.png";
const SPINNER_STRIP_BASE_SIZE = 200;

export function validateRarityWeightsDev() {
    if (process.env.NODE_ENV !== "development") return;
    const total = Object.values(RARITY_PROBABILITIES).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.001) {
        console.warn(`RARITY_PROBABILITIES sum to ${total}, expected 100`);
    }
}

export function useDrinkCase(drinks: DrinkVariant[]) {
    if (process.env.NODE_ENV === "development") validateRarityWeightsDev();
    const [selected, setSelected] = useState<DrinkVariant | null>(null);
    const [rolling, setRolling] = useState(false);
    const [offset, setOffset] = useState(0);
    const [animate, setAnimate] = useState(true);
    const [stripDrinks, setStripDrinks] = useState<DrinkVariant[]>(() =>
        maskLegendary(drinks.filter((d) => d.rarity !== "yellow"))
    );
    const [spinSound, setSpinSound] = useState<HTMLAudioElement | null>(null);

    useEffect(() => {
        // only runs on client
        setSpinSound(new Audio("/sounds/cs.m4a"));
    }, []);

    useEffect(() => {
        setStripDrinks(maskLegendary(createWeightedStrip(drinks, false)));
    }, [drinks]);

    const handleOpen = () => {
        if (rolling) return;

        if (spinSound) {
            spinSound.currentTime = 0;
            spinSound.play().catch(() => {
                // autoplay restrictions may require user gesture
            });
        }

        const weightedChoice = getWeightedRandom(drinks);
        const spinStrip = createVisualStrip(drinks, weightedChoice, 40); // ~40 items

        setStripDrinks(maskLegendary(spinStrip));

        setAnimate(true);
        setRolling(true);
        setOffset(0);

        setSelected(weightedChoice);

        const chosenIndex = spinStrip.findIndex((d) => d.name === weightedChoice.name);

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

function getWeightedRandom(drinks: DrinkVariant[]): DrinkVariant {
    const r = Math.random() * 100;
    let acc = 0;
    let picked: keyof typeof RARITY_PROBABILITIES = "blue";

    for (const [rarity, p] of Object.entries(RARITY_PROBABILITIES)) {
        acc += p;
        if (r < acc) {
            picked = rarity as keyof typeof RARITY_PROBABILITIES;
            break;
        }
    }

    const pool = drinks.filter((d) => d.rarity === picked);
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];

    const commons = drinks.filter((d) => d.rarity === "blue");
    if (commons.length) return commons[Math.floor(Math.random() * commons.length)];
    return drinks[Math.floor(Math.random() * drinks.length)];
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
