export function fmtCoord(value: unknown, digits = 4): string {
    return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "";
}
