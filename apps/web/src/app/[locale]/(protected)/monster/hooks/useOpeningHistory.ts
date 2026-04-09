import { useCallback, useSyncExternalStore } from "react";
import { recordOpeningToServer } from "@/lib/monster/recordOpening";
import type { DrinkRarity } from "../types";

export type OpeningRecord = {
	caseType: string;
	item: string;
	rarity: DrinkRarity;
	openedAt: string; // ISO
};

const STORAGE_KEY = "monster-opening-history";

let listeners: Array<() => void> = [];

function emit() {
	for (const l of listeners) l();
}

function getSnapshot(): OpeningRecord[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as OpeningRecord[]) : [];
	} catch {
		return [];
	}
}

function getServerSnapshot(): OpeningRecord[] {
	return [];
}

function subscribe(cb: () => void) {
	listeners.push(cb);
	return () => {
		listeners = listeners.filter((l) => l !== cb);
	};
}

export function recordOpening(record: OpeningRecord) {
	const current = getSnapshot();
	current.push(record);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
	emit();
}

export function useOpeningHistory() {
	const history = useSyncExternalStore(
		subscribe,
		getSnapshot,
		getServerSnapshot,
	);

	const record = useCallback((opening: Omit<OpeningRecord, "openedAt">) => {
		recordOpening({ ...opening, openedAt: new Date().toISOString() });
		recordOpeningToServer(opening);
	}, []);

	return { history, record };
}
