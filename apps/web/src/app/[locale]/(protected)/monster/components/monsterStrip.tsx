import { MonsterCard } from "./monsterCard";
import { Monster } from "../types";
import { SPIN_TIMING_FUNCTION } from "@/app/[locale]/(protected)/monster/constants";

export type MonsterStripProps = {
    monsters: Monster[];
    offset: number;
    duration: number;
};

export function MonsterStrip({ monsters, offset, duration }: MonsterStripProps) {
    return (
        <div
            className="flex transition-transform"
            style={{
                transform: `translateX(-${offset}px)`,
                transitionDuration: `${duration}ms`,
                transitionTimingFunction: SPIN_TIMING_FUNCTION,
            }}
        >
            {monsters.map((monster, idx) => (
                <MonsterCard key={`${monster.name}-${idx}`} monster={monster} />
            ))}
        </div>
    );
}
