"use client";

import { fetchJson } from "@/lib/widgets/fetchJson";
import type { ServerPingsWidget } from "@/types/widgets/types";
import type { PingsData } from "@/types/widgets/data";
import ServerPingsView from "@/components/widgets/ServerPingsView";
import { ReactElement } from "react";

type Fetcher<D> = (instanceId: string) => Promise<D>;
type Renderer<D, W> = (props: { data: D; widget?: W }) => ReactElement;
type RegistryEntry<D, W> = { fetch: Fetcher<D>; Component: Renderer<D, W> };

type RegistryMap = {
    "server-pings": RegistryEntry<PingsData, ServerPingsWidget>;
    // "pi-health": RegistryEntry<PiHealthData, PiHealthWidget>;
};

export const registry: Partial<RegistryMap> = {
    "server-pings": {
        fetch: (id) => fetchJson<PingsData>(`/api/server-pings?instanceId=${id}`),
        Component: ServerPingsView,
    },
};
