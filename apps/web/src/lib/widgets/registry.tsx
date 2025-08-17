"use client";

import type { ServerPingsWidget } from "@/types/widgets/types";
import type { PingsData } from "@/types/widgets/data";
import { fetchJson } from "@/lib/widgets/fetchJson";
import ServerPingsView from "@/components/widgets/ServerPingsView";
import { ReactElement } from "react";

type Fetcher<D> = (instanceId: string) => Promise<D>;
type Renderer<D, W> = (props: { data: D; widget?: W }) => ReactElement;

type Registry = {
    "server-pings": {
        fetch: Fetcher<PingsData>;
        Component: Renderer<PingsData, ServerPingsWidget>;
    };
};

export const registry: Registry = {
    "server-pings": {
        fetch: (id: string) => fetchJson<PingsData>(`/api/backend/server-pings?instanceId=${id}`),
        Component: ServerPingsView,
    },
};
