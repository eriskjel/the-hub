FROM node:20-alpine AS base
WORKDIR /repo
RUN corepack enable

# Copy only what's needed to install deps first (faster caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
# If you have shared packages, keep this; otherwise you can remove the next line
COPY packages ./packages

RUN pnpm install --frozen-lockfile

# --- dev (pnpm dev) ---
FROM base AS dev
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["pnpm","dev","-p","3000","--hostname","0.0.0.0"]

# --- build (standalone) ---
FROM base AS build
WORKDIR /repo
COPY . .
RUN pnpm --filter ./apps/web... build

# --- prod runtime (standalone output) ---
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone requires: next.config.js -> module.exports = { output: 'standalone' }
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public      ./apps/web/public
EXPOSE 3000
CMD ["node","apps/web/server.js"]