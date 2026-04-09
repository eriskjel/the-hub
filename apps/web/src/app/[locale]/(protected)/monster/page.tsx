"use client";

import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { CASES, type CaseKey } from "@/app/[locale]/(protected)/monster/cases";
import { DrinkImagePreloader } from "@/app/[locale]/(protected)/monster/components/DrinkImagePreloader";
import { LiveFeed } from "@/app/[locale]/(protected)/monster/components/LiveFeed";
import { StatsPanel } from "@/app/[locale]/(protected)/monster/components/StatsPanel";
import { SPIN_ROUNDS } from "@/app/[locale]/(protected)/monster/constants";
import { useDrinkCase } from "@/app/[locale]/(protected)/monster/hooks/useDrinkCase";
import { useOpeningHistory } from "@/app/[locale]/(protected)/monster/hooks/useOpeningHistory";
import { RARITY_BORDERS } from "@/app/[locale]/(protected)/monster/rarityStyles";
import { Roller } from "./components/Roller";

type Tab = "open" | "stats";

export default function DrinkCasePage() {
	const t = useTranslations("monster");
	const [activeTab, setActiveTab] = useState<Tab>("open");
	const [selectedCaseKey, setSelectedCaseKey] = useState<CaseKey>("monster");
	const currentCase = CASES[selectedCaseKey];

	const { history, record } = useOpeningHistory();

	const {
		selected,
		rolling,
		offset,
		handleOpen,
		reset,
		duration,
		animate,
		stripMonsters,
	} = useDrinkCase(currentCase.variants, {
		caseType: selectedCaseKey,
		onOpen: (result) =>
			record({
				caseType: result.caseType,
				item: result.item,
				rarity: result.rarity as "blue" | "purple" | "pink" | "red" | "yellow",
			}),
	});

	const repeated = useMemo(
		() => Array.from({ length: SPIN_ROUNDS + 2 }, () => stripMonsters).flat(),
		[stripMonsters],
	);

	const handleOpenAnother = () => {
		reset();
		setTimeout(handleOpen, 120);
	};

	const handleCaseSwitch = (key: CaseKey) => {
		if (rolling) return;
		setSelectedCaseKey(key);
		reset();
	};

	return (
		<div className="mt-8 flex h-full flex-col items-center justify-center gap-6 text-center">
			<DrinkImagePreloader />
			<h1 className="text-5xl font-bold">{currentCase.label}</h1>

			{/* Case + Tab selector */}
			<div className="flex flex-col items-center gap-3">
				<div className="flex gap-4">
					{Object.values(CASES).map((c) => (
						<button
							type="button"
							key={c.id}
							className={clsx(
								"rounded px-4 py-2",
								selectedCaseKey === c.id
									? "bg-green-600 text-white"
									: "bg-gray-700 text-gray-200",
							)}
							onClick={() => handleCaseSwitch(c.id as CaseKey)}
						>
							{c.label}
						</button>
					))}
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						className={clsx(
							"rounded-full px-4 py-1.5 text-sm font-medium transition",
							activeTab === "open"
								? "bg-green-600 text-white"
								: "bg-gray-800 text-gray-400 hover:text-gray-200",
						)}
						onClick={() => setActiveTab("open")}
					>
						{t("tabs.open")}
					</button>
					<button
						type="button"
						className={clsx(
							"rounded-full px-4 py-1.5 text-sm font-medium transition",
							activeTab === "stats"
								? "bg-green-600 text-white"
								: "bg-gray-800 text-gray-400 hover:text-gray-200",
						)}
						onClick={() => setActiveTab("stats")}
					>
						{t("tabs.stats")}
						{history.filter((h) => h.caseType === selectedCaseKey).length >
							0 && (
							<span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-700 px-1 text-xs">
								{history.filter((h) => h.caseType === selectedCaseKey).length}
							</span>
						)}
					</button>
				</div>
			</div>

			{activeTab === "open" ? (
				<>
					{/* spin button */}
					<div className="flex gap-4 text-white">
						{!selected || rolling ? (
							<button
								type="button"
								className="rounded bg-green-600 px-6 py-3 text-xl font-semibold transition hover:bg-green-700 disabled:opacity-50"
								onClick={handleOpen}
								disabled={rolling}
							>
								{rolling ? t("rolling") : t("button_text")}
							</button>
						) : (
							<button
								type="button"
								className="rounded bg-green-600 px-6 py-3 text-xl font-semibold transition hover:bg-green-700"
								onClick={handleOpenAnother}
							>
								{t("button_text")}
							</button>
						)}
					</div>

					<Roller
						drinks={repeated}
						offset={offset}
						duration={animate ? duration : 0}
					/>

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
									RARITY_BORDERS[selected.rarity],
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
								<div className="mb-2 text-2xl font-bold sm:text-3xl">
									{selected.name}
								</div>
							</div>
						)}
					</div>
				</>
			) : (
				<>
					<StatsPanel history={history} caseKey={selectedCaseKey} />
					<LiveFeed />
				</>
			)}
		</div>
	);
}
