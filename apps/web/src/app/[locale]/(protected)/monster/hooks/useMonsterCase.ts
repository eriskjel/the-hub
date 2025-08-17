import { useState } from "react";
import { Monster } from "../types";

const ITEM_WIDTH = 160;
const CONTAINER_WIDTH = 640;
const SPIN_ROUNDS = 3;
const ANIMATION_DURATION = 4000;

export function useMonsterCase(monsters: Monster[]) {
    const [selected, setSelected] = useState<Monster | null>(null);
    const [rolling, setRolling] = useState(false);
    const [offset, setOffset] = useState(0);

    const handleOpen = () => {
        if (rolling) return;

        setRolling(true);
        const chosen = getRandomMonster(monsters);
        setSelected(chosen);

        const chosenIndex = monsters.findIndex((m) => m.name === chosen.name);
        const centerOffset = CONTAINER_WIDTH / 2 - ITEM_WIDTH / 2;
        const finalOffset =
            (monsters.length * SPIN_ROUNDS + chosenIndex) * ITEM_WIDTH - centerOffset;

        setOffset(finalOffset);
        setTimeout(() => setRolling(false), ANIMATION_DURATION);
    };

    return { selected, rolling, offset, handleOpen };
}

function getRandomMonster(monsters: Monster[]): Monster {
    return monsters[Math.floor(Math.random() * monsters.length)];
}
