import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = [
    { ignores: ["**/node_modules/**", "**/.next/**", "**/out/**", "**/build/**", "next-env.d.ts"] },
    ...nextCoreWebVitals,
    ...nextTypescript,
    prettier,
    {
        rules: {
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        },
    },
];
export default eslintConfig;
