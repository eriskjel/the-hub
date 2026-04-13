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

/**
 * Shape used by every monster feed UI row (LiveFeed, HighlightFeeds).
 * The API returns this normalized shape regardless of the underlying query.
 */
export type MonsterFeedItem = {
    id: string;
    item: string;
    rarity: DrinkRarity;
    openedAt: string;
    username: string;
    avatarUrl: string | null;
};
