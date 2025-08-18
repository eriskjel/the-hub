const lastWarn = new Map<string, number>();
export const warnOnce = (key: string, msg: string) => {
    const now = Date.now();
    if ((lastWarn.get(key) ?? 0) + 60_000 < now) {
        console.warn(msg);
        lastWarn.set(key, now);
    }
};
