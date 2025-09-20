import { DrinkVariant } from "./types";

export const RARITY_BORDERS: Record<DrinkVariant["rarity"], string> = {
    blue: "border-blue-500",
    purple: "border-purple-500",
    pink: "border-pink-500",
    red: "border-red-500",
    yellow: "border-yellow-500",
};

export const RARITY_COLORS: Record<DrinkVariant["rarity"], string> = {
    blue: "border-blue-500 bg-blue-500/10",
    purple: "border-purple-500 bg-purple-500/10",
    pink: "border-pink-500 bg-pink-500/10",
    red: "border-red-500 bg-red-500/10",
    yellow: "border-yellow-500 bg-yellow-500/10",
};

export const RARITY_GLOWS: Record<DrinkVariant["rarity"], string> = {
    blue: "shadow-blue-500/50",
    purple: "shadow-purple-500/50",
    pink: "shadow-pink-500/50",
    red: "shadow-red-500/50",
    yellow: "shadow-yellow-500/50",
};
