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
    // fallback: keep as-is; adjust if you start supporting more kinds
    return row as unknown as AnyWidget;
}

function isServerPingsSettings(s: unknown): s is ServerPingsSettings {
    if (!s || typeof s !== "object") return false;
    const o = s as any;
    return typeof o.target === "string" || Array.isArray(o.targets) || o.targets === undefined;
}

function isPiHealthSettings(s: unknown): s is PiHealthSettings {
    return !!s && typeof (s as any).deviceId === "string";
}
