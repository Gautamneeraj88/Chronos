#!/bin/bash
set -e

# Seed sample workflows into a running Chronos instance.
#
# Usage:
#   API_KEY=ck_your_key bash scripts/seed.sh
#
# Prerequisites:
#   1. The full stack is running (bash scripts/dev.sh up + all services)
#   2. Create an API key in the dashboard: Settings → API Keys → New Key
#   3. Set API_KEY to the key value shown at creation time
#
# Optional overrides:
#   GATEWAY_URL=http://localhost:3000  (default)

GATEWAY_URL=${GATEWAY_URL:-http://localhost:3000}
API_KEY=${API_KEY:-}

if [ -z "$API_KEY" ]; then
  echo "Error: API_KEY is required."
  echo ""
  echo "Usage: API_KEY=<your-key> bash scripts/seed.sh"
  echo ""
  echo "Create an API key in the dashboard first:"
  echo "  1. Open http://localhost:5173"
  echo "  2. Go to Settings → API Keys → New Key"
  echo "  3. Copy the key (shown once at creation)"
  exit 1
fi

echo "Seeding sample workflows into $GATEWAY_URL..."
echo ""

# Extract id from JSON response (handles both "id":"val" and "id": "val")
extract_id() {
  python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('id',''))"
}

# ── Order processing workflow ──────────────────────────────────────────────────
echo "Creating: order-processing"
ORDER_WF_ID=$(curl -sf -X POST "$GATEWAY_URL/workflows" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "order-processing",
    "steps": [
      {
        "name": "charge-card",
        "type": "activity",
        "activity": "chargeCard",
        "compensation": "refund-card",
        "retries": 3,
        "timeoutMs": 10000
      },
      {
        "name": "update-inventory",
        "type": "activity",
        "activity": "updateInventory",
        "compensation": "restore-inventory",
        "retries": 3,
        "timeoutMs": 10000
      },
      {
        "name": "send-confirmation",
        "type": "activity",
        "activity": "sendConfirmation",
        "retries": 2,
        "timeoutMs": 5000
      }
    ]
  }' | extract_id)

echo "  ✅ order-processing → $ORDER_WF_ID"

# ── User onboarding workflow ───────────────────────────────────────────────────
echo "Creating: user-onboarding"
ONBOARDING_WF_ID=$(curl -sf -X POST "$GATEWAY_URL/workflows" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user-onboarding",
    "steps": [
      {
        "name": "create-account",
        "type": "activity",
        "activity": "createAccount",
        "compensation": "delete-account",
        "retries": 2,
        "timeoutMs": 5000
      },
      {
        "name": "send-welcome-email",
        "type": "activity",
        "activity": "sendWelcomeEmail",
        "retries": 3,
        "timeoutMs": 15000
      },
      {
        "name": "provision-resources",
        "type": "activity",
        "activity": "provisionResources",
        "compensation": "teardown-resources",
        "retries": 2,
        "timeoutMs": 30000
      }
    ]
  }' | extract_id)

echo "  ✅ user-onboarding → $ONBOARDING_WF_ID"

# ── Trigger a sample execution ─────────────────────────────────────────────────
echo ""
echo "Triggering a sample execution of order-processing..."
EXEC_ID=$(curl -sf -X POST "$GATEWAY_URL/executions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflowId\": \"$ORDER_WF_ID\",
    \"input\": {
      \"orderId\": \"ORD-SEED-001\",
      \"customerId\": \"CUST-001\",
      \"amount\": 99.99,
      \"currency\": \"USD\"
    }
  }" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('id',''))")

echo "  ✅ execution started → $EXEC_ID"

echo ""
echo "Done! Open the dashboard to see your workflows:"
echo "  http://localhost:5173/workflows"
echo ""
echo "Watch the execution:"
echo "  http://localhost:5173/executions/$EXEC_ID"
