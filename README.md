# Liora Gallery

Nuxt 4 gallery for photography and illustration uploads with Prisma and S3-compatible storage.

## Local development

```bash
pnpm install
pnpm dev
```

## Production build

```bash
pnpm build
pnpm preview
```

## Docker

Build the production image and run it on port `3000`:

```bash
docker build -t liora .
docker run --rm -p 3000:3000 --env-file .env liora
```

The container listens on `0.0.0.0:3000` by default (`NUXT_HOST`/`NUXT_PORT`/`PORT` can be overridden).
At runtime the container runs `pnpm exec prisma migrate deploy` before starting the Nuxt server, so the database schema stays up to date.

### Build helper script

Use `scripts/build-docker.sh` to build the image tagged with the `package.json` version and `latest`. Override the image name via `IMAGE_NAME`.

```bash
IMAGE_NAME=your-registry.example.com/liora ./scripts/build-docker.sh
```

To publish to Docker Hub (after `docker login`), use the helper script:

```bash
./scripts/publish-docker.sh  # defaults to docker.io/jannchie/liora
```

### Docker with a mounted SQLite volume

Use an external volume to persist the SQLite database (`DATABASE_URL=file:/data/data.db` in the examples below).

1) Build the production image:

```bash
docker build -t liora .
```

2) Prepare a host directory for the database (e.g., `/srv/liora-db`). You can rely on the container’s startup hook to apply migrations automatically, or run them once ahead of time with the build-stage image (includes Prisma and pnpm):

```bash
docker build --target build -t liora-build .
docker run --rm \
  -e DATABASE_URL=file:/data/data.db \
  -v /srv/liora-db:/data \
  liora-build pnpm exec prisma migrate deploy
```

3) Start the app container, mounting the same volume and passing required env vars:

```bash
docker run -d --name liora \
  -p 3000:3000 \
  -e DATABASE_URL=file:/data/data.db \
  -e S3_ENDPOINT=... \
  -e S3_BUCKET=... \
  -e S3_ACCESS_KEY_ID=... \
  -e S3_SECRET_ACCESS_KEY=... \
  -v /srv/liora-db:/data \
  liora
```

`docker-compose.yml` example:

```yaml
services:
  liora:
    build: .
    image: liora:latest
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: 'file:/data/data.db'
      S3_ENDPOINT: ''
      S3_BUCKET: ''
      S3_ACCESS_KEY_ID: ''
      S3_SECRET_ACCESS_KEY: ''
    volumes:
      - /srv/liora-db:/data
    restart: unless-stopped
```

Whenever you add new migrations, rerun step 2 against the same volume and restart the app container.

## Configuration

### Admin auth

```txt
ADMIN_USERNAME=<username>
ADMIN_PASSWORD=<password>
ADMIN_SESSION_SECRET=<random-secret>
```

### Database

Defaults to the bundled SQLite file at `prisma/data.db` (auto-created if missing). Override with:

```txt
DATABASE_URL=libsql://<host>/<db>?authToken=<token>
```

### S3-compatible storage

Set the following environment variables to upload files to an S3-compatible bucket (e.g., Cloudflare R2, MinIO, Wasabi):

```txt
S3_ENDPOINT=https://<endpoint>
S3_BUCKET=<bucket-name>
S3_ACCESS_KEY_ID=<access-key-id>
S3_SECRET_ACCESS_KEY=<secret-access-key>
# Optional: public URL base (defaults to endpoint + bucket)
S3_PUBLIC_BASE_URL=https://<public-base>/<bucket-name>
```

Ensure the token has write permission to the bucket and, if public access is desired, enable public reads or use a custom domain.

### Location search

The admin upload form uses the public OpenStreetMap Nominatim API (proxied by `/api/geocode`) to look up place names and fill coordinates. Calls are throttled to one request per second and queued server-side. No extra environment variables are required; keep usage light to respect the free service limits.

### AI classification

Set an OpenAI-compatible key to enable automatic genre classification (prompt: `prompts/PhotographyGenreClassification.md`, model: `gpt-5.1-nano`) during uploads. The final label is stored in the `File.genre` column.

```txt
OPENAI_API_KEY=<openai-key>
```

The key is read server-side only; without it uploads still succeed but genre classification is skipped.

### SEO

This project uses `@nuxtjs/seo` for canonical links, sitemap generation, and social previews. Set your canonical host with `NUXT_SITE_URL` (or `NUXT_PUBLIC_SITE_URL`), and toggle indexing via `NUXT_SITE_INDEXABLE=true|false`. When no URL is provided, local development falls back to `http://localhost:3000`.

### Social links

Set any of the following environment variables to show social icons in the gallery header card. Only non-empty values render.

```txt
NUXT_PUBLIC_SOCIAL_GITHUB=https://github.com/<username>
NUXT_PUBLIC_SOCIAL_TWITTER=https://x.com/<username>
NUXT_PUBLIC_SOCIAL_INSTAGRAM=https://instagram.com/<username>
NUXT_PUBLIC_SOCIAL_WEIBO=https://weibo.com/<username>
NUXT_PUBLIC_SOCIAL_YOUTUBE=https://youtube.com/@<username>
NUXT_PUBLIC_SOCIAL_BILIBILI=https://space.bilibili.com/<id>
NUXT_PUBLIC_SOCIAL_TIKTOK=https://www.tiktok.com/@<username>
NUXT_PUBLIC_SOCIAL_LINKEDIN=https://www.linkedin.com/in/<username>
```
