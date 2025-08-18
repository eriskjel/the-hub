import type { ReactElement } from "react";
import type { PingsData } from "@/widgets/server-pings/types";

/* 1) Allowed kinds (extend over time) */
export const WIDGET_KINDS = ["server-pings", "pi-health"] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

/* 2) Grid (camelCase on the client) */
export type Grid = { x: number; y: number; w: number; h: number };

/* 3) Settings per kind */
export type ServerPingsSettings = {
    target?: string; // single
    targets?: string[]; // or multiple
};

export type PiHealthSettings = {
    deviceId: string; // pi_devices.id
};

/* 4) Discriminated widget type (from API /widgets/list) */
export type BaseWidget<K extends WidgetKind, S> = {
    id: string;
    instanceId: string;
    kind: K;
    title: string;
    grid: Grid;
    settings: S;
};

export type ServerPingsWidget = BaseWidget<"server-pings", ServerPingsSettings>;
export type PiHealthWidget = BaseWidget<"pi-health", PiHealthSettings>;

export type AnyWidget = ServerPingsWidget | PiHealthWidget;

/* 5) Data returned by each widget's fetch */
export type DataByKind = {
    "server-pings": PingsData; // pulling from your existing types
    "pi-health": unknown; // fill in when you implement
};

/* 6) Registry contracts */
export type Entry<K extends WidgetKind> = {
    // Optional: static widgets can omit fetch
    fetch?: (
        instanceId: string,
        widget?: Extract<AnyWidget, { kind: K }>
    ) => Promise<DataByKind[K]>;
    Component: (props: {
        data: DataByKind[K];
        widget: Extract<AnyWidget, { kind: K }>;
    }) => ReactElement;
};

export type Registry = {
    [K in WidgetKind]?: Entry<K>;
};
