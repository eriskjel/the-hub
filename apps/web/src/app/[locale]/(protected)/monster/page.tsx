"use client";

import { useTranslations } from "next-intl";
import { Monster } from "./types";
import { useMonsterCase } from "./hooks/useMonsterCase";
import { Roller } from "./components/roller";
import Image from "next/image";
import { useMemo } from "react";
import { SPIN_ROUNDS } from "@/app/[locale]/(protected)/monster/constants";
import clsx from "clsx";
import { RARITY_BORDERS } from "@/app/[locale]/(protected)/monster/rarityStyles";

const monsters: Monster[] = [
    // Blue rarity (79.92% - most common)
    { name: "Original", image: "/monsters/original.png", rarity: "blue" },

    { name: "Aussie Lemonade", image: "/monsters/aussie_lemonade.png", rarity: "blue" },
    { name: "Original Zero", image: "/monsters/original_zero.png", rarity: "blue" },
    { name: "Rio Punch", image: "/monsters/rio_punch.png", rarity: "blue" },
    { name: "Ultra Paradise", image: "/monsters/ultra_paradise.png", rarity: "blue" },
    { name: "Bad Apple", image: "/monsters/bad_apple.png", rarity: "blue" },
    { name: "Ultra Black", image: "/monsters/ultra_black.png", rarity: "blue" },

    // Purple rarity (15.98%)
    { name: "Ultra Gold", image: "/monsters/ultra_gold.png", rarity: "purple" },
    { name: "Full Throttle", image: "/monsters/full_throttle.png", rarity: "purple" },
    { name: "Ultra Watermelon", image: "/monsters/ultra_watermelon.png", rarity: "purple" },
    { name: "Ultra Rosa", image: "/monsters/ultra_rosa.png", rarity: "purple" },

    // Pink rarity (3.2%)
    { name: "Peachy Keen", image: "/monsters/peachy_keen.png", rarity: "pink" },
    { name: "Valentino Rossi", image: "/monsters/vr46.png", rarity: "pink" },
    { name: "Ultra White", image: "/monsters/ultra_white.png", rarity: "pink" },
    { name: "Ultra Fiesta Mango", image: "/monsters/ultra_fiesta_mango.png", rarity: "purple" },

    // Red rarity (0.64%)
    {
        name: "Ultra Strawberry Dreams",
        image: "/monsters/ultra_strawberry_dreams.png",
        rarity: "red",
    },
    { name: "Lando Norris", image: "/monsters/lando_norris.png", rarity: "red" },

    // Yellow rarity (0.26% - legendary)
    { name: "Mango Loco", image: "/monsters/mango_loco.png", rarity: "yellow" },
    { name: "Burn", image: "/monsters/burn.png", rarity: "yellow" },
];

export default function MonsterPage() {
    const { selected, rolling, offset, handleOpen, reset, duration, animate, stripMonsters } =
        useMonsterCase(monsters);

    const t = useTranslations("monster");

    const repeatedMonsters = useMemo(
        () => Array.from({ length: SPIN_ROUNDS + 2 }, () => stripMonsters).flat(),
        [stripMonsters]
    );

    const handleOpenAnother = () => {
        reset();
        setTimeout(() => {
            handleOpen();
        }, 120);
    };

    return (
        <div className="mt-8 flex h-full flex-col items-center justify-center gap-6 text-center">
            <h1 className="text-5xl font-bold">{t("title")}</h1>

            <div className="flex gap-4">
                <div className="flex gap-4 text-white">
                    {!selected || rolling ? (
                        <button
                            className="rounded bg-green-600 px-6 py-3 text-xl font-semibold transition hover:bg-green-700 disabled:opacity-50"
                            onClick={handleOpen}
                            disabled={rolling}
                        >
                            {rolling ? t("rolling") : t("button_text")}
                        </button>
                    ) : (
                        <button
                            className="rounded bg-green-600 px-6 py-3 text-xl font-semibold transition hover:bg-green-700"
                            onClick={handleOpenAnother}
                        >
                            {t("button_text")}
                        </button>
                    )}
                </div>
            </div>

            <Roller monsters={repeatedMonsters} offset={offset} duration={animate ? duration : 0} />

            {/* Preload the selected image during the spin to avoid pop-in */}
            {selected && rolling && (
                <Image
                    src={selected.image}
                    alt=""
                    width={128}
                    height={128}
                    priority
                    className="hidden"
                    aria-hidden={true}
                />
            )}

            {/* Reserve space responsively so it fits on all devices */}
            <div className="mt-4 min-h-[clamp(160px,28vh,260px)]">
                {!rolling && selected && (
                    <div
                        className={clsx(
                            "rounded-lg border-2 bg-black/50 p-4 sm:p-6",
                            RARITY_BORDERS[selected.rarity]
                        )}
                    >
                        <Image
                            src={selected.image}
                            alt={selected.name}
                            className="mx-auto mb-2 h-auto w-[clamp(80px,24vw,128px)] rounded-lg"
                            width={128}
                            height={128}
                            loading="eager"
                            sizes="(max-width: 640px) 24vw, 128px"
                        />
                        <div className="mb-2 text-2xl font-bold sm:text-3xl">{selected.name}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
