import { Monster } from "../types";
import Image from "next/image";
import { RARITY_COLORS, RARITY_GLOWS } from "@/app/[locale]/(protected)/monster/rarityStyles";

export function MonsterCard({ monster }: { monster: Monster }) {
    const isLegendary = monster.rarity === "yellow";
    const imageSize = isLegendary ? 120 : 40;

    return (
        <div
            className={`flex h-40 w-40 flex-shrink-0 flex-col items-center justify-center rounded-lg border-2 p-2 transition-all duration-300 ${RARITY_COLORS[monster.rarity]} ${RARITY_GLOWS[monster.rarity]} shadow-lg`}
        >
            <Image src={monster.image} alt={monster.name} width={imageSize} height={imageSize} />
            {!isLegendary && (
                <p className="mt-2 text-center text-xs font-medium text-white">{monster.name}</p>
            )}
        </div>
    );
}
