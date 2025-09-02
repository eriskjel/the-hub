"use client";

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,
    enableLogs: process.env.NODE_ENV !== "production",
    ignoreErrors: [/AbortError/, /Load failed/],
    beforeSend(event) {
        if (event.request?.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
        }
        return event;
    },
    tunnel: process.env.NODE_ENV === "production" ? "/monitoring" : undefined,
});

// Optional, if you were using it:
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
