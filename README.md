# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## S3-compatible storage

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

## SEO

This project uses `@nuxtjs/seo` for canonical links, sitemap generation, and social previews. Set your canonical host with `NUXT_SITE_URL` (or `NUXT_PUBLIC_SITE_URL`), and toggle indexing via `NUXT_SITE_INDEXABLE=true|false`. When no URL is provided, local development falls back to `http://localhost:3000`.
