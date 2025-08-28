import { useState } from "react";
import { Monster } from "../types";

const ITEM_WIDTH = 160;
const CONTAINER_WIDTH = 640;
const SPIN_ROUNDS = 3;
const ANIMATION_DURATION = 4000;

const RARITY_PROBABILITIES = {
    blue: 79.92,
    purple: 15.98,
    pink: 3.2,
    red: 0.64,
    yellow: 0.26,
};

export function useMonsterCase(monsters: Monster[]) {
    const [selected, setSelected] = useState<Monster | null>(null);
    const [rolling, setRolling] = useState(false);
    const [offset, setOffset] = useState(0);
    const [animate, setAnimate] = useState(true);
    const [stripMonsters, setStripMonsters] = useState<Monster[]>(monsters);

    const handleOpen = () => {
        if (rolling) return;

        const shuffled = shuffle(monsters);
        setStripMonsters(shuffled);

        setAnimate(true);
        setRolling(true);
        setOffset(0);

        const weightedChoice = getWeightedRandomMonster(shuffled);
        const tempChosenIndex = shuffled.findIndex((m) => m.name === weightedChoice.name);
        const chosenIndex = validateChosenIndex(tempChosenIndex, shuffled);

        setSelected(shuffled[chosenIndex]);

        const centerOffset = CONTAINER_WIDTH / 2 - ITEM_WIDTH / 2;
        const finalOffset =
            (shuffled.length * SPIN_ROUNDS + chosenIndex) * ITEM_WIDTH - centerOffset;

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
        stripMonsters,
    };
}

function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a;
}

function getWeightedRandomMonster(monsters: Monster[]): Monster {
    const random = Math.random() * 100;
    let cumulativeProbability = 0;
    let selectedRarity: keyof typeof RARITY_PROBABILITIES = "blue";

    for (const [rarity, probability] of Object.entries(RARITY_PROBABILITIES)) {
        cumulativeProbability += probability;
        if (random <= cumulativeProbability) {
            selectedRarity = rarity as keyof typeof RARITY_PROBABILITIES;
            break;
        }
    }

    const monstersOfRarity = monsters.filter((monster) => monster.rarity === selectedRarity);

    if (monstersOfRarity.length === 0) {
        const blueMonsters = monsters.filter((monster) => monster.rarity === "blue");
        if (blueMonsters.length > 0) {
            return blueMonsters[Math.floor(Math.random() * blueMonsters.length)];
        }
        return monsters[Math.floor(Math.random() * monsters.length)];
    }

    return monstersOfRarity[Math.floor(Math.random() * monstersOfRarity.length)];
}

function validateChosenIndex(chosenIndex: number, monsters: Monster[]): number {
    if (chosenIndex === -1) {
        return Math.floor(Math.random() * monsters.length);
    }
    return chosenIndex;
}
