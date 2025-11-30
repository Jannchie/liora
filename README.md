<div align="center">
  <img src="docs/social/liora-icon.png" alt="Liora Gallery icon" width="128" height="128" />
  <h1 align="center">Liora Gallery</h1>
  <img href="https://codetime.dev" alt="CodeTime Badge" src="https://shields.jannchie.com/endpoint?style=social&color=222&url=https%3A%2F%2Fapi.codetime.dev%2Fv3%2Fusers%2Fshield%3Fuid%3D2%26project%3Dliora%2B%255BWSL%253A%2BUbuntu-24.04%255D">
</div>

![Liora Gallery screenshot](docs/screenshots/liora-gallery-home.png)

Liora Gallery is a minimal, self-hosted gallery for photography and illustrations. It pairs a public waterfall grid with an admin workspace for uploads, metadata curation, SEO, and S3-backed storage. Built on Nuxt 4, Prisma, and any S3-compatible bucket.

## Contents

- [Contents](#contents)
- [What is Liora?](#what-is-liora)
- [Features](#features)
- [Requirements](#requirements)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [Development](#development)
- [Database](#database)
- [Deployment](#deployment)
  - [Production build (without Docker)](#production-build-without-docker)
  - [Docker](#docker)
- [Operations](#operations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## What is Liora?

Liora is a lightweight, multi-language gallery for photographers and illustrators. It ships with a public-facing waterfall layout, an admin console for uploads and edits, and sensible defaults for SEO and social sharing. Files live in S3-compatible storage; metadata and settings live in SQLite/LibSQL via Prisma.

## Features

- Public gallery with thumbhash placeholders, lazy loading, and i18n (zh-CN, en, ja) backed by Nuxt UI and Tailwind.
- Admin workspace with login: EXIF/metadata autofill, location search via an OpenStreetMap Nominatim proxy, optional AI genre classification (OpenAI-compatible), duplicate detection (perceptual hash + SHA-256), and bulk reclassify.
- Storage pipeline: uploads go to an S3-compatible bucket with safe file naming; hashes, histograms, and thumbhashes are stored alongside metadata for fast lookups.
- Site controls: edit site name, description, icon, and social links from the admin panel; Open Graph images are generated automatically.
- SEO and PWA: `@nuxtjs/seo` for canonical links/sitemap/robots, Nuxt OG images, and `@vite-pwa/nuxt` for installable experiences.

## Requirements

- Node.js 22+ and pnpm 10+
- S3-compatible storage (MinIO, Cloudflare R2, Wasabi, AWS S3, etc.) for uploads
- SQLite/LibSQL database URL (defaults to a local SQLite file)
- Optional: OpenAI-compatible API key for genre classification

## Quickstart

1. Copy envs and fill required values:

   ```bash
   cp .env.example .env
   ```

2. Install deps and start dev server:

   ```bash
   pnpm install
   pnpm dev
   ```

3. Visit <http://localhost:3000> (admin console at `/admin`).
4. Local data lives in `prisma/data.db`; migrations are required if you change the schema.

## Configuration

Core environment variables:

| Variable               | Required    | Description                                                                                        | Example                          |
| ---------------------- | ----------- | -------------------------------------------------------------------------------------------------- | -------------------------------- |
| `ADMIN_USERNAME`       | Yes         | Admin login for `/admin`                                                                           | `admin`                          |
| `ADMIN_PASSWORD`       | Yes         | Admin password                                                                                     | `change-me`                      |
| `ADMIN_SESSION_SECRET` | Recommended | Session signing secret (falls back to password if empty)                                           | `please-change-me`               |
| `DATABASE_URL`         | Optional    | SQLite/LibSQL connection. Default: `file:./prisma/data.db` locally, `file:/data/data.db` in Docker | `libsql://host/db?authToken=...` |
| `S3_ENDPOINT`          | Yes         | S3-compatible endpoint (no trailing slash)                                                         | `https://s3.example.com`         |
| `S3_BUCKET`            | Yes         | Bucket name                                                                                        | `liora`                          |
| `S3_ACCESS_KEY_ID`     | Yes         | Access key                                                                                         | `AKIA...`                        |
| `S3_SECRET_ACCESS_KEY` | Yes         | Secret key                                                                                         | `...`                            |
| `S3_PUBLIC_BASE_URL`   | Optional    | Public base URL/CDN prefix for serving files                                                       | `https://cdn.example.com/liora`  |
| `NUXT_SITE_URL`        | Recommended | Canonical site URL for SEO/sitemap                                                                 | `https://gallery.example.com`    |
| `NUXT_SITE_INDEXABLE`  | Optional    | `true`/`false` to control robots/sitemap                                                           | `true`                           |
| `OPENAI_API_KEY`       | Optional    | Enables AI genre classification                                                                    | `sk-...`                         |

Social links (rendered only when set): `NUXT_PUBLIC_SOCIAL_HOMEPAGE`, `NUXT_PUBLIC_SOCIAL_GITHUB`, `NUXT_PUBLIC_SOCIAL_TWITTER`, `NUXT_PUBLIC_SOCIAL_INSTAGRAM`, `NUXT_PUBLIC_SOCIAL_WEIBO`, `NUXT_PUBLIC_SOCIAL_YOUTUBE`, `NUXT_PUBLIC_SOCIAL_BILIBILI`, `NUXT_PUBLIC_SOCIAL_TIKTOK`, `NUXT_PUBLIC_SOCIAL_LINKEDIN`.

## Development

- Dev server: `pnpm dev`
- Lint: `pnpm exec eslint .`
- Tests (add specs under `tests/` or alongside features): `pnpm exec vitest`
- Production build/preview: `pnpm build && pnpm preview`
- Static export (when needed): `pnpm generate`

## Database

- Prisma schema lives in `prisma/schema.prisma`; local SQLite file is `prisma/data.db`.
- Apply schema changes: `pnpm exec prisma migrate dev --name <message>`
- Regenerate client (after schema edits): `pnpm exec prisma generate`
- Docker images run `pnpm exec prisma migrate deploy` on startup; mount `/data` to persist SQLite (`DATABASE_URL=file:/data/data.db` baked into the image).
- Utility scripts:
  - `pnpm backfill:exif`: parse EXIF and backfill metadata fields (camera, lens, exposure, capture time, etc.).
  - `pnpm backfill:thumbhash`: fetch stored images, compute thumbhash/perceptual hash/SHA-256, and store them in metadata.

## Deployment

### Production build (without Docker)

```bash
pnpm install
pnpm build
pnpm preview
```

### Docker

Build and run the production image on port 3000:

```bash
docker build -t liora .
docker run --rm -p 3000:3000 --env-file .env liora
```

- Listens on `0.0.0.0:3000`; override with `NUXT_HOST`/`NUXT_PORT`/`PORT`.
- Prisma migrations (`pnpm exec prisma migrate deploy`) run on container start.
- The image defaults to `DATABASE_URL=file:/data/data.db`; mount `/data` to persist SQLite or override the URL for LibSQL.

Use `scripts/build-docker.sh` to build tags for the current package version and `latest` (override the image name via `IMAGE_NAME`). Publish with `scripts/publish-docker.sh` (defaults to `docker.io/jannchie/liora`).

To persist SQLite with a host directory (e.g., `/srv/liora-db`):

```bash
docker run -d --name liora \
  -p 3000:3000 \
  --env-file .env \
  -v /srv/liora-db:/data \
  liora:latest
```

Compose example:

```yaml
services:
  liora:
    build: .
    image: liora:latest
    ports:
      - '3000:3000'
    env_file: .env
    volumes:
      - /srv/liora-db:/data
    restart: unless-stopped
```

## Operations

- Back up the SQLite file (`prisma/data.db` locally or `/data` in Docker) and your S3 bucket regularly.
- Set `NUXT_SITE_URL`/`NUXT_SITE_INDEXABLE` appropriately before exposing to crawlers.
- Geocoding uses a proxied Nominatim API; calls are throttled server-side (1 request/second).
- AI classification is optional; uploads still succeed without `OPENAI_API_KEY`.

## Troubleshooting

- Upload fails with “S3-compatible storage is not configured”: check `S3_*` envs and bucket permissions.
- Upload rejected with a conflict: a perceptual/SHA-256 duplicate was detected. Upload a different image or adjust the source.
- Geocoding slow or failing: Nominatim rate limits; try later or fill coordinates manually.
- Classification unavailable: verify `OPENAI_API_KEY`; admins can still set genres manually or use the reclassify action.
- Admin login rejected: ensure `ADMIN_USERNAME`/`ADMIN_PASSWORD` are set and the server restarted after changes.

## Contributing

Use pnpm, keep commits focused (Conventional Commits), and run `pnpm exec eslint .` plus `pnpm exec vitest` before opening a PR. See `CHANGELOG.md` for recent updates; licensing is MIT.

## License

MIT License. See `LICENSE` for details.
