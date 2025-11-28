# Repository Guidelines

## Project Structure & Module Organization

- `app/pages` holds Nuxt page routes; `app/components` stores shared UI; `app/assets/css/main.css` carries Tailwind-driven styles; `app/types` contains shared TypeScript contracts (e.g., `~/types/file`).
- `server/api` exposes Nitro endpoints, with file listing/upload flows in `files.get.ts` and `files.post.ts`; `server/utils` wraps Prisma (`prisma.ts`) and S3-compatible storage access (`s3.ts`).
- `prisma/schema.prisma` defines the LibSQL/SQLite schema; `prisma/migrations` tracks history; `prisma/data.db` is the local default. Generated Prisma artifacts live under `app/generated/prisma/client`—do not edit by hand.
- `public/` serves static assets; `nuxt.config.ts` centralizes runtime config (storage credentials, module setup).

## Build, Test, and Development Commands

- Use pnpm for all tasks: `pnpm install`.
- Local dev: `pnpm dev` (<http://localhost:3000>). Production bundle: `pnpm build`; preview: `pnpm preview`. Static export when needed: `pnpm generate`.
- Database workflow: `pnpm exec prisma migrate dev --name <message>` to evolve schema; `pnpm exec prisma generate` to refresh the client.
- Testing: run Vitest (add it if missing) with Nuxt test utils, e.g., `pnpm exec vitest`. Keep CI fast; prefer `--runInBand` when hitting the real DB.

## Coding Style & Naming Conventions

- TypeScript everywhere; prefer `<script setup>` in `.vue` files. Components in `PascalCase`, composables in `useXxx.ts`, server handlers in `verb.resource.ts`.
- Two-space indentation; keep imports ordered and explicit. Run linting with `pnpm exec eslint .` (configured via `@nuxt/eslint` and `.nuxt/eslint.config.mjs`).
- Favor Tailwind utility classes in `main.css`; keep UI minimal (no heavy gradients/shadows). Reuse `~/types` and `~/components` instead of redefining shapes.

## Testing Guidelines

- Place specs under `tests/` or alongside features as `*.spec.ts`. Use Vitest with `@nuxt/test-utils` for pages/server endpoints; mock Prisma and S3 uploads for unit tests.
- Include coverage for data shaping (metadata parsing, character list normalization) and API validation branches. Keep fixtures small and deterministic.

## Commit & Pull Request Guidelines

- Follow Conventional Commits (`feat:`, `fix:`, `chore:`). Keep commits focused and rebased.
- Before opening a PR, run `pnpm exec eslint .` and `pnpm exec vitest`; summarize behavior changes, link issues, and add screenshots for UI shifts.
- Note schema or config changes in the PR description; include migration names and any new env vars.

## Security & Configuration Tips

- Store secrets in `.env`/`.env.local` (never commit). Required variables: `DATABASE_URL` (defaults to `prisma/data.db`), `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_PUBLIC_BASE_URL`—any S3-compatible service with matching endpoint/keys works.
- Validate S3-compatible credentials before uploading; when debugging locally, rely on the default SQLite file instead of production URLs.
