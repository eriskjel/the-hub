export type DrinkRarity = "blue" | "purple" | "pink" | "red" | "yellow";

export type DrinkVariant = {
    name: string;
    image: string;
    rarity: DrinkRarity;
};

export type DrinkCase = {
    id: string; // "monster", "burn", ...
    label: string; // Display name (Monster Energy, Burn, ...)
    variants: DrinkVariant[];
};
