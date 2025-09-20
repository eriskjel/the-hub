import { DrinkCase } from "../types";

export const monsterCase: DrinkCase = {
    id: "monster",
    label: "Monster Energy",
    variants: [
        // Blue
        { name: "Original Zero", image: "/drinks/monster/original_zero.png", rarity: "blue" },
        { name: "Rio Punch", image: "/drinks/monster/rio_punch.png", rarity: "blue" },
        { name: "Ultra Paradise", image: "/drinks/monster/ultra_paradise.png", rarity: "blue" },
        { name: "Bad Apple", image: "/drinks/monster/bad_apple.png", rarity: "blue" },
        { name: "Ultra Black", image: "/drinks/monster/ultra_black.png", rarity: "blue" },
        { name: "Lando Norris", image: "/drinks/monster/lando_norris.png", rarity: "blue" },

        // Purple
        { name: "Ultra Gold", image: "/drinks/monster/ultra_gold.png", rarity: "purple" },
        {
            name: "Ultra Watermelon",
            image: "/drinks/monster/ultra_watermelon.png",
            rarity: "purple",
        },
        { name: "Ultra Rosa", image: "/drinks/monster/ultra_rosa.png", rarity: "purple" },
        { name: "Valentino Rossi", image: "/drinks/monster/vr46.png", rarity: "purple" },
        {
            name: "Ultra Fiesta Mango",
            image: "/drinks/monster/ultra_fiesta_mango.png",
            rarity: "purple",
        },

        // Pink
        { name: "Original", image: "/drinks/monster/original.png", rarity: "pink" },
        { name: "Full Throttle", image: "/drinks/monster/full_throttle.png", rarity: "pink" },
        {
            name: "Ultra Strawberry Dreams",
            image: "/drinks/monster/ultra_strawberry_dreams.png",
            rarity: "pink",
        },

        // Red
        { name: "Aussie Lemonade", image: "/drinks/monster/aussie_lemonade.png", rarity: "red" },
        { name: "Ultra White", image: "/drinks/monster/ultra_white.png", rarity: "red" },

        // Yellow (legendary)
        { name: "Mango Loco", image: "/drinks/monster/mango_loco.png", rarity: "yellow" },
        { name: "Peachy Keen", image: "/drinks/monster/peachy_keen.png", rarity: "yellow" },
    ],
};
