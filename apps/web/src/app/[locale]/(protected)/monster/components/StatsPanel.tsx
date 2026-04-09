"use client";

import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { CaseKey } from "../cases";
import { CASES } from "../cases";
import type { OpeningRecord } from "../hooks/useOpeningHistory";
import { RARITY_BORDERS, RARITY_COLORS } from "../rarityStyles";
import type { DrinkRarity } from "../types";

const RARITY_LABELS: Record<DrinkRarity, string> = {
	blue: "Common",
	purple: "Uncommon",
	pink: "Rare",
	red: "Very Rare",
	yellow: "Legendary",
};

const RARITY_ORDER: DrinkRarity[] = ["yellow", "red", "pink", "purple", "blue"];

const EXPECTED_RATES: Record<DrinkRarity, number> = {
	blue: 79.92,
	purple: 15.98,
	pink: 3.2,
	red: 0.64,
	yellow: 0.26,
};

type Props = {
	history: OpeningRecord[];
	caseKey: CaseKey;
};

export function StatsPanel({ history, caseKey }: Props) {
	const t = useTranslations("monster");
	const caseHistory = history.filter((h) => h.caseType === caseKey);
	const total = caseHistory.length;
	const currentCase = CASES[caseKey];

	// Collection tracking
	const collected = new Set(caseHistory.map((h) => h.item));
	const totalVariants = currentCase.variants.length;

	// Rarity counts
	const rarityCounts: Record<DrinkRarity, number> = {
		blue: 0,
		purple: 0,
		pink: 0,
		red: 0,
		yellow: 0,
	};
	for (const h of caseHistory) {
		rarityCounts[h.rarity] = (rarityCounts[h.rarity] ?? 0) + 1;
	}

	if (total === 0) {
		return (
			<div className="w-full max-w-2xl rounded-lg border border-gray-700 bg-gray-900/50 p-6 text-center">
				<p className="text-gray-400">{t("stats.empty")}</p>
			</div>
		);
	}

	return (
		<div className="flex w-full max-w-2xl flex-col gap-4">
			{/* Summary row */}
			<div className="grid grid-cols-3 gap-3">
				<StatCard label={t("stats.totalOpens")} value={String(total)} />
				<StatCard
					label={t("stats.collected")}
					value={`${collected.size}/${totalVariants}`}
				/>
				<StatCard
					label={t("stats.legendaries")}
					value={String(rarityCounts.yellow)}
					highlight={rarityCounts.yellow > 0}
				/>
			</div>

			{/* Rarity breakdown */}
			<div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
				<h3 className="mb-3 text-sm font-semibold text-gray-300">
					{t("stats.rarityBreakdown")}
				</h3>
				<div className="space-y-2">
					{RARITY_ORDER.map((rarity) => {
						const count = rarityCounts[rarity];
						const pct = total > 0 ? (count / total) * 100 : 0;
						const expected = EXPECTED_RATES[rarity];
						return (
							<div key={rarity} className="flex items-center gap-3">
								<span
									className={clsx(
										"w-20 text-xs font-medium",
										`text-${rarity === "blue" ? "blue" : rarity === "purple" ? "purple" : rarity === "pink" ? "pink" : rarity === "red" ? "red" : "yellow"}-400`,
									)}
								>
									{RARITY_LABELS[rarity]}
								</span>
								<div className="relative h-4 flex-1 overflow-hidden rounded-full bg-gray-800">
									<div
										className={clsx(
											"h-full rounded-full transition-all duration-500",
											rarity === "blue"
												? "bg-blue-500"
												: rarity === "purple"
													? "bg-purple-500"
													: rarity === "pink"
														? "bg-pink-500"
														: rarity === "red"
															? "bg-red-500"
															: "bg-yellow-500",
										)}
										style={{
											width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
										}}
									/>
									{/* Expected rate marker */}
									<div
										className="absolute top-0 h-full w-0.5 bg-white/30"
										style={{ left: `${expected}%` }}
										title={`Expected: ${expected}%`}
									/>
								</div>
								<span className="w-16 text-right text-xs text-gray-400">
									{count} ({pct.toFixed(1)}%)
								</span>
							</div>
						);
					})}
				</div>
				<p className="mt-2 text-xs text-gray-500">
					{t("stats.expectedMarker")}
				</p>
			</div>

			{/* Collection grid */}
			<div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
				<h3 className="mb-3 text-sm font-semibold text-gray-300">
					{t("stats.collection")}
				</h3>
				<div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-800">
					<div
						className={clsx(
							"h-full rounded-full transition-all duration-500",
							collected.size === totalVariants
								? "bg-yellow-500"
								: collected.size / totalVariants >= 0.5
									? "bg-green-500"
									: "bg-blue-500",
						)}
						style={{
							width: `${(collected.size / totalVariants) * 100}%`,
						}}
					/>
				</div>
				<div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
					{[...currentCase.variants]
						.sort(
							(a, b) =>
								RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity),
						)
						.map((variant) => {
							const owned = collected.has(variant.name);
							const count = caseHistory.filter(
								(h) => h.item === variant.name,
							).length;
							return (
								<div
									key={variant.name}
									className={clsx(
										"relative flex flex-col items-center rounded-lg border p-1.5",
										owned
											? RARITY_COLORS[variant.rarity]
											: "border-gray-700 bg-gray-800/50",
									)}
									title={owned ? `${variant.name} (x${count})` : "???"}
								>
									<Image
										src={variant.image}
										alt={owned ? variant.name : "???"}
										width={48}
										height={48}
										className={clsx(
											"h-10 w-10 object-contain",
											!owned && "brightness-0 opacity-20",
										)}
									/>
									<span
										className={clsx(
											"mt-0.5 line-clamp-1 text-center text-[10px] leading-tight",
											owned ? "text-gray-200" : "text-gray-600",
										)}
									>
										{owned ? variant.name : "???"}
									</span>
									{owned && count > 1 && (
										<span
											className={clsx(
												"absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white",
												RARITY_BORDERS[variant.rarity].replace(
													"border-",
													"bg-",
												),
											)}
										>
											{count}
										</span>
									)}
								</div>
							);
						})}
				</div>
			</div>

			{/* Recent history */}
			<div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
				<h3 className="mb-3 text-sm font-semibold text-gray-300">
					{t("stats.recentDrops")}
				</h3>
				<div className="space-y-1.5">
					{caseHistory
						.slice(-10)
						.reverse()
						.map((h) => (
							<div
								key={h.openedAt}
								className={clsx(
									"flex items-center justify-between rounded px-2 py-1 text-sm",
									RARITY_COLORS[h.rarity],
								)}
							>
								<span className="font-medium">{h.item}</span>
								<span className="text-xs text-gray-400">
									{RARITY_LABELS[h.rarity]}
								</span>
							</div>
						))}
				</div>
			</div>
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
		<div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-center">
			<div
				className={clsx(
					"text-2xl font-bold",
					highlight ? "text-yellow-400" : "text-white",
				)}
			>
				{value}
			</div>
			<div className="text-xs text-gray-400">{label}</div>
		</div>
	);
}
