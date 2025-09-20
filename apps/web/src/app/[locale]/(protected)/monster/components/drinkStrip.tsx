import { DrinkCard } from "./drinkCard";
import { DrinkVariant } from "../types";
import { SPIN_TIMING_FUNCTION } from "@/app/[locale]/(protected)/monster/constants";

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
            }}
        >
            {drinks.map((drink: DrinkVariant, idx) => (
                <DrinkCard key={`${drink.name}-${drink.image}-${idx}`} drink={drink} />
            ))}
        </div>
    );
}
