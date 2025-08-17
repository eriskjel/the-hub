import {
    AnyWidget,
    Grid,
    PiHealthSettings,
    ServerPingsSettings,
    WidgetKind,
} from "@/types/widgets/types";

export type WidgetListItem = {
    id: string;
    instanceId: string;
    kind: WidgetKind;
    title: string;
    grid: Grid;
    settings: unknown;
};

export function toAnyWidget(row: WidgetListItem): AnyWidget {
    if (row.kind === "server-pings") {
        const settings = isServerPingsSettings(row.settings) ? row.settings : {};
        return { ...row, kind: "server-pings", settings };
    }
    if (row.kind === "pi-health") {
        const settings = isPiHealthSettings(row.settings) ? row.settings : { deviceId: "" };
        return { ...row, kind: "pi-health", settings };
    }
    return row as unknown as AnyWidget;
}

function isServerPingsSettings(s: unknown): s is ServerPingsSettings {
    if (typeof s !== "object" || s === null) return false;
    const o = s as Record<string, unknown>;

    // Case 1: single target
    const hasTarget = typeof o["target"] === "string";

    // Case 2: multiple targets, all strings
    const hasTargets =
        Array.isArray(o["targets"]) && o["targets"].every((t) => typeof t === "string");

    // Case 3: optional property (no targets specified at all)
    const targetsOptional = !("targets" in o) || o["targets"] === undefined;

    return hasTarget || hasTargets || targetsOptional;
}

function isPiHealthSettings(s: unknown): s is PiHealthSettings {
    if (typeof s !== "object" || s === null) return false;
    const o = s as Record<string, unknown>;
    return typeof o["deviceId"] === "string";
}
