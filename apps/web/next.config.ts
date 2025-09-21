import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
    output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "image-transformer-api.tjek.com",
                pathname: "/**",
            },
        ],
    },
    async headers() {
        return [
            {
                source: "/drinks/:path*", // matches /drinks/* (served from /public/drinks/*)
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=31536000, immutable", // cache for 1 year
                    },
                ],
            },
        ];
    },
};

export default withSentryConfig(withNextIntl(nextConfig), {
    org: "the-hub-web",
    project: "the-hub-web",
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: "/monitoring",
    disableLogger: true,
    automaticVercelMonitors: true,
});
