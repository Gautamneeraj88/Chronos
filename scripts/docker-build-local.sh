#!/bin/bash
set -e

# Build all Chronos Docker images locally.
# Usage:
#   ./scripts/docker-build-local.sh                    # build all services
#   REGISTRY=my-registry VERSION=v0.8.0 ./scripts/docker-build-local.sh
#   ./scripts/docker-build-local.sh api-gateway        # build a single service

REGISTRY=${REGISTRY:-ghcr.io/gautamneeraj88/chronos}
VERSION=${VERSION:-dev}
SERVICES=("api-gateway" "orchestrator" "worker" "notifier" "dashboard")

# If a service name is passed as argument, build only that one
if [[ -n "$1" ]]; then
  SERVICES=("$1")
fi

# Build context must always be the repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Detect container CLI (podman or docker)
if [[ -z "$DOCKER_CMD" ]]; then
  if command -v docker &>/dev/null; then
    DOCKER_CMD=docker
  elif command -v podman &>/dev/null; then
    DOCKER_CMD=podman
  else
    echo "Error: neither docker nor podman found in PATH" >&2
    exit 1
  fi
fi

# Podman defaults to OCI format which does not persist HEALTHCHECK.
# Pass --format docker to produce Docker-compatible images.
FORMAT_FLAG=""
if [[ "$DOCKER_CMD" == "podman" ]]; then
  FORMAT_FLAG="--format docker"
fi

echo "Building Chronos images — tool: $DOCKER_CMD, registry: $REGISTRY, version: $VERSION"
echo ""

for service in "${SERVICES[@]}"; do
  echo "▶ Building $service..."
  # shellcheck disable=SC2086
  $DOCKER_CMD build \
    -f "$REPO_ROOT/packages/$service/Dockerfile" \
    -t "$REGISTRY/$service:$VERSION" \
    $FORMAT_FLAG \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    "$REPO_ROOT"
  echo "✓ $service → $REGISTRY/$service:$VERSION"
  echo ""
done

echo "All images built successfully."
echo ""
echo "To run the full stack:"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "To push to registry:"
echo "  docker push $REGISTRY/api-gateway:$VERSION"
echo "  (repeat for each service)"
