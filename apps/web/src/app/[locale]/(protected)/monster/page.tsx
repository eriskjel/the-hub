"use client";

import { useTranslations } from "next-intl";
import { Monster } from "./types";
import { useMonsterCase } from "./hooks/useMonsterCase";
import { Roller } from "./components/roller";

// if you later need to fetch user info from session you need this:
// export const dynamic = "force-dynamic";

const monsters: Monster[] = [
    { name: "Original", image: "/monsters/original.png" },
    { name: "Ultra White", image: "/monsters/ultra_white.png" },
    { name: "Aussie Lemonade", image: "/monsters/aussie_lemonade.png" },
    { name: "Original Zero", image: "/monsters/original_zero.png" },
    { name: "Peachy Keen", image: "/monsters/peachy_keen.png" },
    { name: "Rio Punch", image: "/monsters/rio_punch.png" },
    { name: "Ultra Fiesta Mango", image: "/monsters/ultra_fiesta_mango.png" },
    { name: "Ultra Paradise", image: "/monsters/ultra_paradise.png" },
    { name: "Ultra Rosa", image: "/monsters/ultra_rosa.png" },
    { name: "Mango Loco", image: "/monsters/mango_loco.png" },
    { name: "Ultra Strawberry Dreams", image: "/monsters/ultra_strawberry_dreams.png" },
];

const SPIN_ROUNDS = 3;
const ANIMATION_DURATION = 4000;

export default function MonsterPage() {
    const { selected, rolling, offset, handleOpen } = useMonsterCase(monsters);
    const t = useTranslations("monster");

    const repeatedMonsters: Monster[] = Array(SPIN_ROUNDS + 2)
        .fill(monsters)
        .flat();

    return (
        <div className="flex h-full flex-col items-center justify-center gap-6 text-center text-white">
            <h1 className="text-5xl font-bold">{t("title")}</h1>
            <button
                className="rounded bg-green-600 px-6 py-3 text-xl font-semibold transition hover:bg-green-700 disabled:opacity-50"
                onClick={handleOpen}
                disabled={selected !== null || rolling}
            >
                {rolling ? t("rolling") : t("button_text")}
            </button>
            <Roller monsters={repeatedMonsters} offset={offset} duration={ANIMATION_DURATION} />
            {!rolling && selected && <div className="mt-4 text-3xl font-bold">{selected.name}</div>}
        </div>
    );
}
