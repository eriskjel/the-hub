import { Monster } from "../types";
import Image from "next/image";

const RARITY_COLORS = {
    blue: "border-blue-500 bg-blue-500/10",
    purple: "border-purple-500 bg-purple-500/10",
    pink: "border-pink-500 bg-pink-500/10",
    red: "border-red-500 bg-red-500/10",
    yellow: "border-yellow-500 bg-yellow-500/10",
};

const RARITY_GLOWS = {
    blue: "shadow-blue-500/50",
    purple: "shadow-purple-500/50",
    pink: "shadow-pink-500/50",
    red: "shadow-red-500/50",
    yellow: "shadow-yellow-500/50",
};

export function MonsterCard({ monster }: { monster: Monster }) {
    return (
        <div
            className={`flex h-40 w-40 flex-shrink-0 flex-col items-center justify-center rounded-lg border-2 p-2 transition-all duration-300 ${RARITY_COLORS[monster.rarity]} ${RARITY_GLOWS[monster.rarity]} shadow-lg`}
        >
            <Image src={monster.image} alt={monster.name} width={40} height={40} />
            <p className="mt-2 text-center text-xs font-medium text-white">{monster.name}</p>
        </div>
    );
}
