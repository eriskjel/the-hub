import { DrinkVariant } from "../types";
import Image from "next/image";
import { RARITY_COLORS, RARITY_GLOWS } from "@/app/[locale]/(protected)/monster/rarityStyles";
import { ReactElement } from "react";

export function DrinkCard({ drink }: { drink: DrinkVariant }): ReactElement {
    const isLegendary = drink.rarity === "yellow";
    const imageSize = isLegendary ? 120 : 40;

    return (
        <div
            className={`flex h-40 w-40 flex-shrink-0 flex-col items-center justify-center rounded-lg border-2 p-2 transition-all duration-300 ${RARITY_COLORS[drink.rarity]} ${RARITY_GLOWS[drink.rarity]} shadow-lg`}
        >
            <Image src={drink.image} alt={drink.name} width={imageSize} height={imageSize} />
            {!isLegendary && (
                <p className="mt-2 text-center text-xs font-medium text-white">{drink.name}</p>
            )}
        </div>
    );
}
