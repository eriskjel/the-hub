import {
    AnyWidget,
    CinemateketSettings,
    CountdownSettings,
    Grid,
    GroceryDealsSettings,
    PiHealthSettings,
    ServerPingsSettings,
    WidgetKind,
} from "@/widgets/schema";

export type WidgetListItem = {
    id: string;
    instanceId: string;
    kind: WidgetKind;
    grid: Grid;
    settings: unknown;
};

type Provider = CountdownSettings["provider"];

export function toAnyWidget(row: WidgetListItem): AnyWidget {
    if (row.kind === "server-pings") {
        const settings = isServerPingsSettings(row.settings) ? row.settings : {};
        return { ...row, kind: "server-pings", settings };
    }
    if (row.kind === "pi-health") {
        const settings = isPiHealthSettings(row.settings) ? row.settings : { deviceId: "" };
        return { ...row, kind: "pi-health", settings };
    }
    if (row.kind === "grocery-deals") {
        const o = (row.settings ?? {}) as Partial<GroceryDealsSettings>;
        const settings: GroceryDealsSettings = {
            query: typeof o.query === "string" ? o.query : "",
            maxResults: typeof o.maxResults === "number" ? o.maxResults : undefined,
            city: typeof o.city === "string" ? o.city : undefined,
            lat: typeof o.lat === "number" ? o.lat : undefined,
            lon: typeof o.lon === "number" ? o.lon : undefined,
        };
        return { ...row, kind: "grocery-deals", settings } as AnyWidget;
    }
    if (row.kind === "countdown") {
        const o = (row.settings ?? {}) as Partial<CountdownSettings>;
        const validProvider =
            o.source === "provider" &&
            typeof o.provider === "string" &&
            (o.provider === "trippel-trumf" || o.provider === "dnb-supertilbud");
        const settings: CountdownSettings = {
            source: "provider",
            provider: validProvider ? (o.provider as Provider) : "trippel-trumf",
            showHours: typeof o.showHours === "boolean" ? o.showHours : true,
        };
        return { ...row, kind: "countdown", settings } as AnyWidget;
    }
    if (row.kind === "cinemateket") {
        const settings: CinemateketSettings = {};
        return { ...row, kind: "cinemateket", settings } as AnyWidget;
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
