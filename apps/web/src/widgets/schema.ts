import type { ReactElement } from "react";
import type { PingsData } from "@/widgets/server-pings/types";
import { Deal } from "@/widgets/grocery-deals/types";
import { CountdownData } from "@/widgets/countdown/types";

/* 1) Allowed kinds (extend over time) */
export const WIDGET_KINDS = ["server-pings", "pi-health", "grocery-deals", "countdown"] as const;
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

export type GroceryDealsSettings = {
    query: string; // e.g. "monster"
    maxResults?: number; // default 12
    city?: string; // optional (for display)
    lat?: number; // optional (for eta-location cookie)
    lon?: number; // optional
};

export type CountdownSource =
    | { source: "fixed-date"; targetIso: string }
    | {
          source: "monthly-rule";
          time: string; // "08:00" (client local)
          byWeekday?: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
          bySetPos?: number; // e.g., 1, 2, -1
          dayOfMonth?: number; // alternative to weekday+setpos
      }
    | {
          source: "provider";
          provider: "trippel-trumf" | "dnb-supertilbud";
      };

export type CountdownSettings = {
    showHours?: boolean;
} & CountdownSource;

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
export type GroceryDealsWidget = BaseWidget<"grocery-deals", GroceryDealsSettings>;
export type CountdownWidget = BaseWidget<"countdown", CountdownSettings>;

export type AnyWidget = ServerPingsWidget | PiHealthWidget | GroceryDealsWidget | CountdownWidget;

/* 5) Data returned by each widget's fetch */
export type DataByKind = {
    "server-pings": PingsData;
    "pi-health": unknown;
    "grocery-deals": Deal[];
    countdown: CountdownData;
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
    pollMs?: number;
};

export type Registry = {
    [K in WidgetKind]?: Entry<K>;
};
