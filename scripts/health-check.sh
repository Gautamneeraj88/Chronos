#!/bin/bash

# Check health of all Chronos services.
# Exits 0 if all are healthy, 1 if any are down.

FAILED=0

check() {
  local name=$1
  local url=$2
  if curl -sf --max-time 3 "$url" > /dev/null 2>&1; then
    echo "✅ $name"
  else
    echo "❌ $name  ($url)"
    FAILED=1
  fi
}

echo "Checking Chronos services..."
echo ""

# Application services
check "API Gateway"   "http://localhost:3000/health"
check "Orchestrator"  "http://localhost:3001/health"
check "Worker"        "http://localhost:3002/health"
check "Notifier"      "http://localhost:3003/health"

# Dashboard — check for 200 on root
check "Dashboard"     "http://localhost:5173"

# Observability
check "Prometheus"    "http://localhost:9090/-/healthy"
check "Grafana"       "http://localhost:3004/api/health"
check "Loki"          "http://localhost:3100/ready"
check "Jaeger"        "http://localhost:16686"

echo ""

if [ $FAILED -eq 0 ]; then
  echo "All services healthy."
else
  echo "One or more services are down. Check logs with: bash scripts/dev.sh logs <service>"
  exit 1
fi
