# The Hub — Fullstack Monorepo

A personal dashboard application built as a **pnpm monorepo** with a **Next.js 16 (TypeScript)** frontend, a **Spring Boot 3.5 (Java 21)** backend, and **Supabase** for authentication and Postgres.

Users log in and manage a customisable grid of **widgets** — each widget fetches live data from the backend and renders it on the dashboard.

> ⚠️ **Work in progress.** Expect rapid changes to features, architecture, and documentation.

---

## 📂 Project Structure

```
the-hub/
├── apps/
│   └── web/              # Next.js 16 frontend (TypeScript, Tailwind CSS 4)
├── services/
│   └── spring/           # Spring Boot 3.5 backend (Java 21, Maven)
├── supabase/             # Supabase config & SQL migrations
├── docs/                 # Developer documentation (merging strategy, etc.)
├── compose.yaml          # Docker Compose for local development
├── compose.prod.yaml     # Docker Compose for production
├── pnpm-workspace.yaml   # pnpm workspace definition
└── package.json          # Root scripts & shared dev-dependencies
```

---

## ✨ Features

### Widget Dashboard

The core feature is a widget-based dashboard where authenticated users can create, configure, and arrange widgets in a responsive grid. Supported widget types:

| Widget | Description |
| --- | --- |
| **Server Pings** | Monitors uptime by pinging one or more URLs |
| **Grocery Deals** | Searches Norwegian grocery deals via Etilbudsavis, with optional Gemini AI relevance filtering |
| **Countdown** | Counts down to the next occurrence of a provider-based event (e.g. Trippel Trumf, DNB Supertilbud) |
| **Cinemateket** | Shows upcoming film screenings from Cinemateket Trondheim |

### Other Features

- **Monster Case Simulator** — A CS:GO-style case opening mini-game for energy drinks, with rarity tiers and animated rollers
- **Admin Panel** — User and widget management for administrators
- **Internationalisation (i18n)** — Full English and Norwegian translations via `next-intl`
- **Dark/Light Theme** — Toggle between themes
- **Authentication** — Email-based auth powered by Supabase Auth
- **Error Monitoring** — Sentry integration for both client and server errors

---

## 🛠 Tech Stack

### Frontend (`apps/web`)

- [Next.js](https://nextjs.org/) 16 with Turbopack
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) 4
- [next-intl](https://next-intl.dev/) for i18n
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs) for auth
- [Sentry](https://sentry.io/) for error monitoring
- [Vitest](https://vitest.dev/) + Testing Library for tests
- [Prettier](https://prettier.io/) + [ESLint](https://eslint.org/) for formatting/linting

### Backend (`services/spring`)

- [Spring Boot](https://spring.io/projects/spring-boot) 3.5
- Java 21
- Spring Security (OAuth 2 Resource Server, Supabase JWT)
- Spring JDBC with PostgreSQL
- [SpringDoc OpenAPI](https://springdoc.org/) (Swagger UI)
- Checkstyle (Google style) + Spotless for formatting
- Lombok

### Infrastructure

- [Supabase](https://supabase.com/) — Auth & PostgreSQL database
- [Docker](https://www.docker.com/) & Docker Compose — Containerised dev and prod environments
- GitHub Actions CI/CD — Automated linting, testing, building, and Docker image publishing (GHCR)

---

## ✅ Prerequisites

- **Node.js** 20+
- **pnpm** (via Corepack)
- **Java** 21+ (for backend development)
- **Docker & Docker Compose** (optional, for running services locally)
- **Supabase** project (for auth & Postgres)

---

## 🚀 Getting Started

### 1. Clone & install dependencies

```bash
git clone https://github.com/eriskjel/the-hub.git
cd the-hub
corepack enable
pnpm install
```

### 2. Environment variables

Copy the example env file for the backend and fill in your values:

```bash
cp services/spring/.env.example services/spring/.env
```

The frontend requires Supabase keys — set these in your shell or a `.env.local` in `apps/web/`:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### 3. Run with Docker Compose (recommended)

Start both frontend and backend with hot-reload:

```bash
docker compose up
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8080

### 4. Run individually

**Frontend only:**

```bash
pnpm dev          # runs Next.js dev server with Turbopack
```

**Backend only (requires Maven & JDK 21):**

```bash
cd services/spring
./mvnw spring-boot:run
```

---

## 📋 Available Scripts

Root-level pnpm scripts (defined in `package.json`):

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Build the frontend for production |
| `pnpm lint` | Run ESLint on the frontend |
| `pnpm test` | Run Vitest in watch mode |
| `pnpm test:run` | Run Vitest once (CI mode) |
| `pnpm test:ui` | Open the Vitest UI |

---

## 🔄 CI/CD

Four GitHub Actions workflows automate quality checks:

| Workflow | Trigger | Description |
| --- | --- | --- |
| `web-ci.yml` | PR → `main` | Prettier check, Vitest tests, Next.js build |
| `backend-ci.yml` | PR/push → `main` | Docker build (PR) or build & push to GHCR (main) |
| `backend-lint.yml` | PR/push → `main` | Checkstyle + Spotless formatting verification |
| `main.yml` | Push → `main` (migrations) | Applies Supabase SQL migrations to production |

---

## 🤝 Contributing

Contributions are very welcome — just open a PR!

1. Fork the repo
2. Create a feature branch
3. Commit with clear messages
4. Open a Pull Request (link to any issue if relevant)

See [`docs/merging.md`](docs/merging.md) for details on the branching and merging strategy.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).