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
        include: ["src/**/*.test.{ts,tsx}"],
        environment: "node",
        api: false,
        css: false,
        environmentMatchGlobs: [["**/*.component.test.{ts,tsx}", "jsdom"]],
        setupFiles: ["./vitest.setup.ts"],
    },
});
