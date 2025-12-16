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
[ -n "$IMAGE_DOMAIN_DEFAULT" ] && [ -z "$IMAGE_DOMAINS" ] && export IMAGE_DOMAINS="$IMAGE_DOMAIN_DEFAULT"

exec "$@"
