import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [tsconfigPaths()],
    esbuild: {
        jsx: "automatic",
        jsxImportSource: "react",
    },
    test: {
        globals: true,
        api: false,
        css: false,
        setupFiles: ["./vitest.setup.ts"],
        projects: [
            {
                extends: true,
                test: {
                    name: "node",
                    environment: "node",
                    include: ["src/**/*.test.{ts,tsx}"],
                    exclude: ["src/**/*.component.test.{ts,tsx}"],
                },
            },
            {
                extends: true,
                test: {
                    name: "components",
                    environment: "jsdom",
                    include: ["src/**/*.component.test.{ts,tsx}"],
                },
            },
        ],
    },
});
