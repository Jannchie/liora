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

## Configuration

### Admin auth

```txt
ADMIN_USERNAME=<username>
ADMIN_PASSWORD=<password>
ADMIN_SESSION_SECRET=<random-secret>
```

### Database

Defaults to the bundled SQLite file at `prisma/dev.db`. Override with:

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
