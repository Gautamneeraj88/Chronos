#!/bin/bash
set -e

# Chronos dev helper — single entrypoint for common development tasks.
# Usage: bash scripts/dev.sh <command> [args]

COMMAND=${1:-help}

case $COMMAND in
  up)
    echo "Starting Chronos infrastructure..."
    podman-compose up -d
    echo "Waiting 10s for services to initialise..."
    sleep 10
    bash "$(dirname "$0")/setup-kafka-topics.sh"
    echo ""
    echo "✅ Infrastructure ready. Start services in 5 terminals:"
    echo "   cd packages/orchestrator && pnpm run dev   # :3001"
    echo "   cd packages/worker       && pnpm run dev   # :3002"
    echo "   cd packages/api-gateway  && pnpm run dev   # :3000"
    echo "   cd packages/notifier     && pnpm run dev   # :3003"
    echo "   cd packages/dashboard    && pnpm run dev   # :5173"
    ;;

  down)
    podman-compose down
    echo "✅ Infrastructure stopped"
    ;;

  test)
    turbo run test
    ;;

  test:integration)
    turbo run test:integration
    ;;

  build)
    turbo run build
    ;;

  lint)
    turbo run lint
    ;;

  health)
    bash "$(dirname "$0")/health-check.sh"
    ;;

  seed)
    bash "$(dirname "$0")/seed.sh" "${@:2}"
    ;;

  logs)
    SERVICE=${2:-orchestrator}
    echo "Tailing logs for chronos-$SERVICE (Ctrl-C to stop)..."
    podman logs -f "chronos-$SERVICE"
    ;;

  clean)
    echo "Removing all Chronos containers and volumes..."
    podman-compose down -v
    echo "✅ Cleaned"
    ;;

  help|*)
    echo "Usage: bash scripts/dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  up                  Start all infrastructure containers + create Kafka topics"
    echo "  down                Stop all infrastructure containers"
    echo "  test                Run unit tests (no containers needed)"
    echo "  test:integration    Run integration tests (containers required)"
    echo "  build               Build all packages"
    echo "  lint                Run ESLint across all packages"
    echo "  health              Check all service health endpoints"
    echo "  seed                Seed sample workflows (requires API_KEY env var)"
    echo "  logs [service]      Tail logs for a service (default: orchestrator)"
    echo "  clean               Remove all containers and volumes (destroys data)"
    ;;
esac
