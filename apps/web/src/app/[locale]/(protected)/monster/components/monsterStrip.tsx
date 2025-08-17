import { MonsterCard } from "./monsterCard";
import { Monster } from "../types";

export type MonsterStripProps = {
    monsters: Monster[];
    offset: number;
    duration: number;
};

export function MonsterStrip({ monsters, offset, duration }: MonsterStripProps) {
    return (
        <div
            className="flex transition-transform ease-out"
            style={{
                transform: `translateX(-${offset}px)`,
                transitionDuration: `${duration}ms`,
            }}
        >
            {monsters.map((monster, idx) => (
                <MonsterCard key={idx} monster={monster} />
            ))}
        </div>
    );
}
