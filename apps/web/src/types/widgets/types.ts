// 1) Allowed kinds (extend over time)
export const WIDGET_KINDS = ["server-pings", "pi-health"] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

// 2) Grid (camelCase on the client)
export type Grid = { x: number; y: number; w: number; h: number };

// 3) Settings per kind
export type ServerPingsSettings = {
    target?: string; // single
    targets?: string[]; // or multiple
};

export type PiHealthSettings = {
    deviceId: string; // pi_devices.id
};

// 4) Discriminated widget type (from API /widgets/list)
export type WidgetBase<K extends WidgetKind, S> = {
    id: string;
    instanceId: string;
    kind: K;
    title: string;
    grid: Grid;
    settings: S;
};

export type ServerPingsWidget = WidgetBase<"server-pings", ServerPingsSettings>;
export type PiHealthWidget = WidgetBase<"pi-health", PiHealthSettings>;

export type AnyWidget = ServerPingsWidget | PiHealthWidget;
