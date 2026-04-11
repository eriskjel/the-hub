"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CASES, type CaseKey } from "@/app/[locale]/(protected)/monster/cases";
import { DrinkImagePreloader } from "@/app/[locale]/(protected)/monster/components/DrinkImagePreloader";
import { LiveFeed } from "@/app/[locale]/(protected)/monster/components/LiveFeed";
import {
    StatsGlobal,
    StatsPersonal,
    type StatsResponse,
} from "@/app/[locale]/(protected)/monster/components/StatsPanel";
import { SPIN_ROUNDS } from "@/app/[locale]/(protected)/monster/constants";
import { useDrinkCase } from "@/app/[locale]/(protected)/monster/hooks/useDrinkCase";
import { RARITY_BORDERS, RARITY_GLOWS } from "@/app/[locale]/(protected)/monster/rarityStyles";
import type { DrinkRarity } from "@/app/[locale]/(protected)/monster/types";
import { Roller } from "./components/Roller";

type OpenResponse = {
    id: string;
    caseType: CaseKey;
    item: string;
    rarity: DrinkRarity;
    image: string;
    openedAt: string;
};

const CASE_KEYS = Object.keys(CASES) as CaseKey[];

export default function DrinkCasePage() {
    const t = useTranslations("monster");
    const queryClient = useQueryClient();

    const [selectedCaseKey, setSelectedCaseKey] = useState<CaseKey>("monster");
    const currentCase = CASES[selectedCaseKey];

    const statsQuery = useQuery<StatsResponse>({
        queryKey: ["monster-stats", selectedCaseKey],
        queryFn: async () => {
            const res = await fetch(`/api/monster/stats?type=${selectedCaseKey}`);
            if (!res.ok) throw new Error(`stats ${res.status}`);
            return res.json();
        },
        retry: false,
    });

    const openMutation = useMutation<OpenResponse, Error, void>({
        mutationFn: async () => {
            const res = await fetch("/api/monster/open", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ caseType: selectedCaseKey }),
            });
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as {
                    error?: string;
                    retryAfterMs?: number;
                } | null;
                throw new Error(body?.error ?? `open ${res.status}`);
            }
            return res.json();
        },
        // Don't invalidate here — it would update stats/feed mid-animation
        // and spoil the result. Invalidation happens in the useEffect below
        // once the spin animation finishes (rolling → false).
    });

    const roll = useCallback(async () => {
        const result = await openMutation.mutateAsync();
        return { item: result.item, rarity: result.rarity, image: result.image };
    }, [openMutation]);

    const { selected, rolling, opening, offset, handleOpen, reset, duration, animate, stripMonsters } =
        useDrinkCase(currentCase.variants, roll);

    // Invalidate stats + feed only after the spin animation finishes,
    // so the result isn't spoiled in the side panels mid-spin.
    const wasRolling = useRef(false);
    useEffect(() => {
        if (wasRolling.current && !rolling) {
            queryClient.invalidateQueries({ queryKey: ["monster-feed"] });
            queryClient.invalidateQueries({ queryKey: ["monster-stats", selectedCaseKey] });
        }
        wasRolling.current = rolling;
    }, [rolling, queryClient, selectedCaseKey]);

    const repeated = useMemo(
        () => Array.from({ length: SPIN_ROUNDS + 2 }, () => stripMonsters).flat(),
        [stripMonsters]
    );

    const handleOpenAnother = () => {
        reset();
        setTimeout(() => {
            void handleOpen();
        }, 120);
    };

    const handleCaseSwitch = (key: CaseKey) => {
        if (rolling || opening) return;
        setSelectedCaseKey(key);
        reset();
    };

    const busy = rolling || opening;
    const rateLimited = openMutation.error?.message === "rate_limited";
    const showResult = !rolling && selected;

    const statsProps = {
        stats: statsQuery.data,
        isLoading: statsQuery.isLoading,
        isError: statsQuery.isError,
        caseKey: selectedCaseKey,
    };

    return (
        <div className="mx-auto mt-6 flex max-w-7xl flex-col gap-5 px-4 pb-8">
            <DrinkImagePreloader />

            {/* Case selector — centered at top */}
            <div className="flex justify-center gap-2">
                {CASE_KEYS.map((key) => {
                    const c = CASES[key];
                    const active = selectedCaseKey === key;
                    return (
                        <button
                            type="button"
                            key={key}
                            className={clsx(
                                "rounded-lg px-4 py-2 text-sm font-medium transition",
                                active
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                                    : "border border-border bg-surface text-muted hover:bg-surface-subtle hover:text-foreground"
                            )}
                            onClick={() => handleCaseSwitch(key)}
                        >
                            {c.label}
                        </button>
                    );
                })}
            </div>

            {/* 3-column layout: stats left | opener center | collection right */}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[280px_1fr_280px]">
                {/* Left: global stats + live feed */}
                <div className="order-2 flex flex-col gap-4 lg:order-1">
                    <StatsGlobal {...statsProps} />
                    <LiveFeed />
                </div>

                {/* Center: roller + result + button */}
                <div className="order-1 flex flex-col items-center gap-4 lg:order-2 lg:pt-8">
                    {/* Roller */}
                    <div className="w-full max-w-[640px]">
                        <Roller
                            drinks={repeated}
                            offset={offset}
                            duration={animate ? duration : 0}
                        />

                        {/* Preload chosen image during spin */}
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
                    </div>

                    {/* Result card — appears between roller and button */}
                    {showResult && (
                        <div
                            className={clsx(
                                "flex items-center gap-4 rounded-xl border-2 bg-black/85 px-6 py-3 shadow-xl backdrop-blur-sm",
                                RARITY_BORDERS[selected.rarity],
                                RARITY_GLOWS[selected.rarity]
                            )}
                        >
                            <Image
                                src={selected.image}
                                alt={selected.name}
                                className="h-auto w-16 rounded-lg"
                                width={64}
                                height={64}
                                loading="eager"
                            />
                            <span className="text-lg font-bold text-white">
                                {selected.name}
                            </span>
                        </div>
                    )}

                    {/* Open button */}
                    <div className="flex flex-col items-center gap-1.5">
                        <button
                            type="button"
                            className={clsx(
                                "flex items-center gap-2 rounded-lg px-8 py-3 text-lg font-semibold text-white transition",
                                "bg-emerald-600 shadow-md shadow-emerald-600/25 hover:bg-emerald-700",
                                "disabled:cursor-not-allowed disabled:opacity-50"
                            )}
                            onClick={showResult ? handleOpenAnother : () => void handleOpen()}
                            disabled={busy}
                        >
                            {opening && (
                                <span
                                    aria-hidden="true"
                                    className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-transparent"
                                />
                            )}
                            {opening
                                ? t("opening")
                                : rolling
                                  ? t("rolling")
                                  : t("button_text")}
                        </button>
                        {rateLimited && (
                            <p className="text-xs text-yellow-400">{t("rateLimited")}</p>
                        )}
                    </div>
                </div>

                {/* Right: personal stats + collection + recent drops */}
                <div className="order-3 flex flex-col gap-4">
                    <StatsPersonal {...statsProps} />
                </div>
            </div>
        </div>
    );
}
