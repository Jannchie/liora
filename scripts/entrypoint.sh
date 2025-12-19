#!/usr/bin/env sh
set -e

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

exec "$@"
