#!/usr/bin/env bash
set -euo pipefail

# Build and push Docker images tagged with package.json version and latest.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PACKAGE_VERSION="$(node --input-type=module -e "import { readFileSync } from 'fs'; const pkg = JSON.parse(readFileSync('package.json', 'utf8')); console.log(pkg.version ?? '');")"

if [ -z "$PACKAGE_VERSION" ]; then
  echo "error: package.json is missing a version" >&2
  exit 1
fi

IMAGE_NAME="${IMAGE_NAME:-docker.io/jannchie/liora}"

"${ROOT_DIR}/scripts/build-docker.sh"

docker push "${IMAGE_NAME}:${PACKAGE_VERSION}"
docker push "${IMAGE_NAME}:latest"
