"use client";

import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { RARITY_PROBABILITIES } from "@/lib/monster/catalog";
import type { CaseKey } from "../cases";
import { CASES } from "../cases";
import { RARITY_POP_COLORS } from "../rarityStyles";
import type { DrinkRarity } from "../types";

const RARITY_ORDER: DrinkRarity[] = ["yellow", "red", "pink", "purple", "blue"];

const RARITY_TEXT_COLORS: Record<DrinkRarity, string> = {
    blue: "text-blue-400",
    purple: "text-purple-400",
    pink: "text-pink-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
};

const RARITY_BAR_COLORS: Record<DrinkRarity, string> = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    pink: "bg-pink-500",
    red: "bg-red-500",
    yellow: "bg-yellow-500",
};

export type RecentItem = {
    id: string;
    item: string;
    rarity: DrinkRarity;
    openedAt: string;
};

export type StatsResponse = {
    personal: {
        total: number;
        byRarity: Record<DrinkRarity, number>;
        ownedItems: string[];
        recentItems: RecentItem[];
        collectionRank: {
            playersTotal: number;
            playersBeat: number;
            percentile: number;
        } | null;
    };
    global: {
        total: number;
        byRarity: Record<DrinkRarity, number>;
    };
};

type Props = {
    stats: StatsResponse | undefined;
    isLoading: boolean;
    isError: boolean;
    caseKey: CaseKey;
};

function StatsPlaceholder({ message }: { message: string }) {
    return (
        <div className="border-border bg-surface w-full rounded-xl border p-5 text-center">
            <p className="text-muted">{message}</p>
        </div>
    );
}

/* ── Left column: global stats (total opens, legendaries) ── */
export function StatsGlobal({ stats, isLoading, isError }: Props) {
    const t = useTranslations("monster");

    if (isLoading) return <StatsPlaceholder message={t("stats.loading")} />;
    // Hide entirely when the stats endpoint is unavailable (e.g. migration
    // not applied), mirroring LiveFeed. Personal stats still show their own
    // placeholder so the user knows where their history would appear.
    if (isError || !stats) return null;

    const { global } = stats;

    return (
        <div className="flex w-full flex-col gap-3">
            <h2 className="text-muted text-sm font-semibold tracking-wide uppercase">
                {t("global.title")}
            </h2>
            <StatCard label={t("global.totalOpens")} value={String(global.total)} />
            <StatCard
                label={t("global.legendaries")}
                value={String(global.byRarity.yellow)}
                highlight={global.byRarity.yellow > 0}
            />
        </div>
    );
}

/* ── Right column: personal rarity bars + collection + recent drops ── */
export function StatsPersonal({ stats, isLoading, isError, caseKey }: Props) {
    const t = useTranslations("monster");
    const currentCase = CASES[caseKey];
    const totalVariants = currentCase.variants.length;

    const ownedSet = useMemo(
        () => new Set(stats?.personal.ownedItems ?? []),
        [stats?.personal.ownedItems]
    );

    if (isLoading) return <StatsPlaceholder message={t("stats.loading")} />;
    if (isError || !stats) return <StatsPlaceholder message={t("stats.unavailable")} />;

    const { personal } = stats;
    const total = personal.total;

    if (total === 0) return <StatsPlaceholder message={t("stats.empty")} />;

    const collectedCount = ownedSet.size;

    return (
        <div className="flex w-full flex-col gap-3">
            <h2 className="text-muted text-sm font-semibold tracking-wide uppercase">
                {t("yourStats")}
            </h2>

            {/* Rarity breakdown */}
            <div className="border-border bg-surface rounded-xl border p-4">
                <h3 className="text-muted mb-2.5 text-xs font-semibold tracking-wide uppercase">
                    {t("stats.rarityBreakdown")}
                </h3>
                <div className="space-y-1.5">
                    {RARITY_ORDER.map((rarity) => {
                        const count = personal.byRarity[rarity];
                        const pct = total > 0 ? (count / total) * 100 : 0;
                        const expected = RARITY_PROBABILITIES[rarity];
                        return (
                            <div key={rarity} className="flex items-center gap-2">
                                <span
                                    className={clsx(
                                        "w-16 shrink-0 text-xs font-medium",
                                        RARITY_TEXT_COLORS[rarity]
                                    )}
                                >
                                    {t(`rarity.${rarity}`)}
                                </span>
                                <div className="bg-surface-light relative h-3 flex-1 overflow-hidden rounded-full">
                                    <div
                                        className={clsx(
                                            "h-full rounded-full transition-all duration-500",
                                            RARITY_BAR_COLORS[rarity]
                                        )}
                                        style={{
                                            width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                                        }}
                                    />
                                    <div
                                        className="absolute top-0 h-full w-0.5 bg-amber-400/70"
                                        style={{ left: `${expected}%` }}
                                    />
                                </div>
                                <span className="text-muted w-14 shrink-0 text-right text-[11px] tabular-nums">
                                    {count} ({pct.toFixed(1)}%)
                                </span>
                            </div>
                        );
                    })}
                </div>
                <p className="text-muted-light mt-1.5 text-[10px]">{t("stats.expectedMarker")}</p>
            </div>

            {/* Collection grid */}
            <div className="border-border bg-surface rounded-xl border p-4">
                <h3 className="text-muted mb-2.5 text-xs font-semibold tracking-wide uppercase">
                    {t("stats.collection")} — {collectedCount}/{totalVariants}
                </h3>
                <div className="bg-surface-light mb-1.5 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                        className={clsx(
                            "h-full rounded-full transition-all duration-500",
                            collectedCount === totalVariants
                                ? "bg-yellow-500"
                                : collectedCount / totalVariants >= 0.5
                                  ? "bg-green-500"
                                  : "bg-blue-500"
                        )}
                        style={{
                            width: `${(collectedCount / totalVariants) * 100}%`,
                        }}
                    />
                </div>
                {personal.collectionRank && personal.collectionRank.playersTotal > 1 && (
                    <p className="text-muted mb-2 text-[11px]">
                        {t("stats.betterThan", {
                            beat: personal.collectionRank.playersBeat,
                            total: personal.collectionRank.playersTotal - 1,
                            pct: personal.collectionRank.percentile,
                        })}
                    </p>
                )}
                <div className="grid grid-cols-4 gap-1.5 xl:grid-cols-5">
                    {[...currentCase.variants]
                        .sort(
                            (a, b) =>
                                RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
                        )
                        .map((variant) => {
                            const owned = ownedSet.has(variant.name);
                            return (
                                <div
                                    key={variant.name}
                                    className={clsx(
                                        "relative flex flex-col items-center rounded-lg border p-1",
                                        owned
                                            ? RARITY_POP_COLORS[variant.rarity]
                                            : "border-border bg-surface-subtle"
                                    )}
                                    title={owned ? variant.name : undefined}
                                >
                                    <Image
                                        src={variant.image}
                                        alt={owned ? variant.name : ""}
                                        width={48}
                                        height={48}
                                        className={clsx(
                                            "h-8 w-8 object-contain",
                                            !owned && "opacity-15 brightness-0"
                                        )}
                                    />
                                    <span
                                        className={clsx(
                                            "mt-0.5 line-clamp-1 text-center text-[9px] leading-tight",
                                            owned ? "text-foreground" : "text-muted-light"
                                        )}
                                    >
                                        {owned ? variant.name : "???"}
                                    </span>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* Recent drops */}
            {personal.recentItems.length > 0 && (
                <div className="border-border bg-surface rounded-xl border p-4">
                    <h3 className="text-muted mb-2.5 text-xs font-semibold tracking-wide uppercase">
                        {t("stats.recentDrops")}
                    </h3>
                    <div className="max-h-[240px] space-y-1 overflow-y-auto">
                        {personal.recentItems.map((h) => (
                            <div
                                key={h.id}
                                className={clsx(
                                    "flex items-center justify-between rounded-lg border px-2.5 py-1 text-sm",
                                    RARITY_POP_COLORS[h.rarity]
                                )}
                            >
                                <span className="text-foreground font-medium">{h.item}</span>
                                <span className={clsx("text-xs", RARITY_TEXT_COLORS[h.rarity])}>
                                    {t(`rarity.${h.rarity}`)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({
    label,
    value,
    highlight,
}: {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div className="border-border bg-surface rounded-xl border p-2.5 text-center">
            <div
                className={clsx(
                    "text-xl font-bold",
                    highlight ? "text-yellow-400" : "text-foreground"
                )}
            >
                {value}
            </div>
            <div className="text-muted text-[11px]">{label}</div>
        </div>
    );
}
