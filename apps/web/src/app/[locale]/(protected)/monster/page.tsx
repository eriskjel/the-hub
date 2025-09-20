"use client";

import { useTranslations } from "next-intl";
import { Roller } from "./components/roller";
import Image from "next/image";
import { useMemo, useState } from "react";
import { SPIN_ROUNDS } from "@/app/[locale]/(protected)/monster/constants";
import clsx from "clsx";
import { RARITY_BORDERS } from "@/app/[locale]/(protected)/monster/rarityStyles";
import { CaseKey, CASES } from "@/app/[locale]/(protected)/monster/cases";
import { useDrinkCase } from "@/app/[locale]/(protected)/monster/hooks/useDrinkCase";

export default function DrinkCasePage() {
    const t = useTranslations("monster");

    // for now, pick with state — later from route or dropdown
    const [selectedCaseKey, setSelectedCaseKey] = useState<CaseKey>("monster");
    const currentCase = CASES[selectedCaseKey];

    const { selected, rolling, offset, handleOpen, reset, duration, animate, stripMonsters } =
        useDrinkCase(currentCase.variants);

    const repeated = useMemo(
        () => Array.from({ length: SPIN_ROUNDS + 2 }, () => stripMonsters).flat(),
        [stripMonsters]
    );

    const handleOpenAnother = () => {
        reset();
        setTimeout(handleOpen, 120);
    };

    return (
        <div className="mt-8 flex h-full flex-col items-center justify-center gap-6 text-center">
            <h1 className="text-5xl font-bold">{currentCase.label}</h1>

            {/* selector for cases */}
            <div className="flex gap-4">
                {Object.values(CASES).map((c) => (
                    <button
                        key={c.id}
                        className={`rounded px-4 py-2 ${
                            selectedCaseKey === c.id
                                ? "bg-green-600 text-white"
                                : "bg-gray-700 text-gray-200"
                        }`}
                        onClick={() => setSelectedCaseKey(c.id as CaseKey)}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {/* spin button */}
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

            <Roller drinks={repeated} offset={offset} duration={animate ? duration : 0} />

            {/* preload + result */}
            {selected && rolling && (
                <Image
                    src={selected.image}
                    alt=""
                    width={128}
                    height={128}
                    priority
                    className="hidden"
                />
            )}

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
                        />
                        <div className="mb-2 text-2xl font-bold sm:text-3xl">{selected.name}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
