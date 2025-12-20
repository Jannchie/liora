#!/usr/bin/env sh
set -e

# Map legacy runtime envs to NUXT_* so runtime config picks them up.
map_env() {
  src="$1"
  dest="$2"
  src_value="$(eval "printf '%s' \"\${$src}\"")"
  dest_value="$(eval "printf '%s' \"\${$dest}\"")"
  if [ -z "$dest_value" ] && [ -n "$src_value" ]; then
    export "$dest=$src_value"
  fi
}

map_env ADMIN_USERNAME NUXT_ADMIN_USERNAME
map_env ADMIN_PASSWORD NUXT_ADMIN_PASSWORD
map_env ADMIN_SESSION_SECRET NUXT_ADMIN_SESSION_SECRET
map_env OPENAI_API_KEY NUXT_AI_OPENAI_API_KEY
map_env S3_ENDPOINT NUXT_STORAGE_ENDPOINT
map_env S3_BUCKET NUXT_STORAGE_BUCKET
map_env S3_ACCESS_KEY_ID NUXT_STORAGE_ACCESS_KEY_ID
map_env S3_SECRET_ACCESS_KEY NUXT_STORAGE_SECRET_ACCESS_KEY
map_env S3_PUBLIC_BASE_URL NUXT_STORAGE_PUBLIC_BASE_URL
map_env SOCIAL_HOMEPAGE NUXT_PUBLIC_SOCIAL_HOMEPAGE
map_env SOCIAL_GITHUB NUXT_PUBLIC_SOCIAL_GITHUB
map_env SOCIAL_TWITTER NUXT_PUBLIC_SOCIAL_TWITTER
map_env SOCIAL_INSTAGRAM NUXT_PUBLIC_SOCIAL_INSTAGRAM
map_env SOCIAL_WEIBO NUXT_PUBLIC_SOCIAL_WEIBO
map_env SOCIAL_YOUTUBE NUXT_PUBLIC_SOCIAL_YOUTUBE
map_env SOCIAL_BILIBILI NUXT_PUBLIC_SOCIAL_BILIBILI
map_env SOCIAL_TIKTOK NUXT_PUBLIC_SOCIAL_TIKTOK
map_env SOCIAL_LINKEDIN NUXT_PUBLIC_SOCIAL_LINKEDIN

# Derive image proxy domains from the public URL when users do not set them.
extract_host() {
  value="$1"
  [ -z "$value" ] && return 0
  stripped="${value#*://}"
  host_port="${stripped%%/*}"
  host="${host_port%%:*}"
  [ -n "$host" ] && printf '%s' "$host"
}

IMAGE_DOMAIN_DEFAULT="$(extract_host "$S3_PUBLIC_BASE_URL")"
if [ -n "$IMAGE_DOMAIN_DEFAULT" ] && [ -z "$IMAGE_DOMAINS" ]; then
  export IMAGE_DOMAINS="$IMAGE_DOMAIN_DEFAULT"
fi

if [ -z "$NUXT_PUBLIC_IMAGE_DOMAINS" ]; then
  if [ -n "$IMAGE_DOMAINS" ]; then
    export NUXT_PUBLIC_IMAGE_DOMAINS="$IMAGE_DOMAINS"
  elif [ -n "$IMAGE_DOMAIN_DEFAULT" ]; then
    export NUXT_PUBLIC_IMAGE_DOMAINS="$IMAGE_DOMAIN_DEFAULT"
  fi
fi

if [ -z "$NUXT_IPX_HTTP_DOMAINS" ]; then
  if [ -n "$IMAGE_DOMAINS" ]; then
    export NUXT_IPX_HTTP_DOMAINS="$IMAGE_DOMAINS"
  elif [ -n "$IMAGE_DOMAIN_DEFAULT" ]; then
    export NUXT_IPX_HTTP_DOMAINS="$IMAGE_DOMAIN_DEFAULT"
  fi
fi

exec "$@"
