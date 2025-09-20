import { DrinkCase } from "../types";

export const redbullBurnCase: DrinkCase = {
    id: "redbullBurn",
    label: "Burn + Red Bull",
    variants: [
        // Burn
        { name: "Burn Fruit Punch", image: "/drinks/burn/fruit punch.png", rarity: "blue" },
        { name: "Burn Apple Kiwi", image: "/drinks/burn/apple kiwi.png", rarity: "purple" },
        { name: "Burn White Citrus", image: "/drinks/burn/white citrus.png", rarity: "red" },
        { name: "Burn Classic", image: "/drinks/burn/burn.png", rarity: "yellow" },

        // Red Bull
        { name: "Red Bull Zero", image: "/drinks/redbull/red bull zero.png", rarity: "blue" },
        {
            name: "Red Bull Sugar Free",
            image: "/drinks/redbull/red bull sugar free.png",
            rarity: "purple",
        },
        { name: "Red Bull Original", image: "/drinks/redbull/red bull.png", rarity: "yellow" },
    ],
};
