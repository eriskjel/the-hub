import { useEffect, useState } from "react";
import { Monster } from "../types";
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

const LEGENDARY_PLACEHOLDER_IMAGE = "/monsters/gold.png";
const SPINNER_STRIP_BASE_SIZE = 200;

export function validateRarityWeightsDev() {
    if (process.env.NODE_ENV !== "development") return;
    const total = Object.values(RARITY_PROBABILITIES).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.001) {
        console.warn(`RARITY_PROBABILITIES sum to ${total}, expected 100`);
    }
}

export function useMonsterCase(monsters: Monster[]) {
    if (process.env.NODE_ENV === "development") validateRarityWeightsDev();
    const [selected, setSelected] = useState<Monster | null>(null);
    const [rolling, setRolling] = useState(false);
    const [offset, setOffset] = useState(0);
    const [animate, setAnimate] = useState(true);
    const [stripMonsters, setStripMonsters] = useState<Monster[]>(() =>
        maskLegendaryMonsters(monsters)
    );

    useEffect(() => {
        setStripMonsters(maskLegendaryMonsters(createWeightedStrip(monsters)));
    }, [monsters]);

    const handleOpen = () => {
        if (rolling) return;

        const spinStrip = createWeightedStrip(monsters);
        setStripMonsters(maskLegendaryMonsters(spinStrip));

        setAnimate(true);
        setRolling(true);
        setOffset(0);

        const weightedChoice = getWeightedRandomMonster(monsters);
        const matchingIndexes = findMatchingIndexes(spinStrip, weightedChoice);
        const chosenIndex = matchingIndexes.length
            ? matchingIndexes[Math.floor(Math.random() * matchingIndexes.length)]
            : Math.floor(Math.random() * spinStrip.length);

        setSelected(spinStrip[chosenIndex]);

        const centerOffset = CONTAINER_WIDTH / 2 - ITEM_WIDTH / 2;
        const finalOffset =
            (spinStrip.length * SPIN_ROUNDS + chosenIndex) * ITEM_WIDTH - centerOffset;

        // Double rAF ensures the browser applies the initial transform(0) before animating to final
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setOffset(finalOffset));
        });

        // When animation is done, release the UI
        setTimeout(() => setRolling(false), ANIMATION_DURATION);
    };

    const reset = () => {
        // Disable animation to snap back to 0 cleanly
        setAnimate(false);
        setOffset(0);
        setSelected(null);
        setRolling(false);

        // Re-enable animation for the next spin
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
        stripMonsters,
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

function getWeightedRandomMonster(monsters: Monster[]): Monster {
    // Pick a rarity by cumulative probability on [0,100)
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

    const pool = monsters.filter((m) => m.rarity === picked);
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];

    // Fallbacks if the strip somehow lacks that rarity
    const commons = monsters.filter((m) => m.rarity === "blue");
    if (commons.length) return commons[Math.floor(Math.random() * commons.length)];
    return monsters[Math.floor(Math.random() * monsters.length)];
}

function findMatchingIndexes(strip: Monster[], target: Monster): number[] {
    const indexes: number[] = [];
    for (let i = 0; i < strip.length; i++) {
        if (strip[i].name === target.name) indexes.push(i);
    }
    return indexes;
}

function maskLegendaryMonsters(monsters: Monster[]): Monster[] {
    return monsters.map((monster) =>
        monster.rarity === "yellow" ? { ...monster, image: LEGENDARY_PLACEHOLDER_IMAGE } : monster
    );
}

function createWeightedStrip(monsters: Monster[]): Monster[] {
    const byRarity = monsters.reduce(
        (acc, monster) => {
            (acc[monster.rarity] = acc[monster.rarity] || []).push(monster);
            return acc;
        },
        {} as Record<Monster["rarity"], Monster[]>
    );

    const weighted: Monster[] = [];
    (Object.keys(RARITY_PROBABILITIES) as Array<Monster["rarity"]>).forEach((rarity) => {
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

    if (weighted.length === 0) return shuffle(monsters);
    return shuffle(weighted);
}
