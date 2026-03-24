export const API = {
    widgets: {
        create: "/api/widgets/create",
        list: "/api/widgets/list",
        seed: "/api/widgets/seed",
        serverPings: "/api/widgets/server-pings",
        groceryDeals: "/api/widgets/grocery-deals",
        countdown: "/api/widgets/countdown",
        cinemateket: "/api/widgets/cinemateket",
        byId: (id: string) => `/api/widgets/${encodeURIComponent(id)}`,
    },
    admin: {
        countdown: {
            status: (providerId: string) =>
                `/api/backend/admin/widgets/countdown/status?providerId=${encodeURIComponent(providerId)}`,
            confirm: (providerId: string) =>
                `/api/backend/admin/widgets/countdown/confirm?providerId=${encodeURIComponent(providerId)}`,
        },
    },
} as const;
