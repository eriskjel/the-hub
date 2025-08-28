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
};

export default withNextIntl(nextConfig);
