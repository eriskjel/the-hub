/**
 * Fire-and-forget POST to /api/monster/open.
 * Silently fails if the migration hasn't been applied yet.
 */
export function recordOpeningToServer(payload: {
	caseType: string;
	item: string;
	rarity: string;
}) {
	fetch("/api/monster/open", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	}).catch(() => {
		// DB not ready or network error — localStorage is the fallback
	});
}
