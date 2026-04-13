import { DrinkCard } from "./DrinkCard";
import { DrinkVariant } from "../types";
import { ITEM_GAP, SPIN_TIMING_FUNCTION } from "@/app/[locale]/(protected)/monster/constants";

export type DrinkStripProps = {
    drinks: DrinkVariant[];
    offset: number;
    duration: number;
};

export function DrinkStrip({ drinks, offset, duration }: DrinkStripProps) {
    return (
        <div
            className="flex transition-transform"
            style={{
                transform: `translateX(-${offset}px)`,
                transitionDuration: `${duration}ms`,
                transitionTimingFunction: SPIN_TIMING_FUNCTION,
                gap: `${ITEM_GAP}px`,
            }}
        >
            {drinks.map((drink: DrinkVariant, idx) => (
                <DrinkCard key={`${drink.name}-${drink.image}-${idx}`} drink={drink} />
            ))}
        </div>
    );
}
