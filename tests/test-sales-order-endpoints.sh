#!/bin/bash
# Sales Order Endpoint Tests
# Usage: ./tests/test-sales-order-endpoints.sh
# Requires: curl, python3

set -euo pipefail

BASE_URL="http://localhost:8080/etendo/sws"
ROLE_ID="42D0EEB1C66F497A90DD526DC597E6F0"
ORG_ID="7BABA5FF80494CAFA54DEBD22EC46F01"
WH_ID="9CF98A18BC754B99998E421F91C5FE12"

PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $label"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}FAIL${NC} $label (expected=$expected, got=$actual)"
  fi
}

assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  TOTAL=$((TOTAL + 1))
  if echo "$haystack" | grep -q "$needle"; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $label"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}FAIL${NC} $label (missing: $needle)"
  fi
}

assert_gt() {
  local label="$1" threshold="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$actual" -gt "$threshold" ] 2>/dev/null; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $label ($actual > $threshold)"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}FAIL${NC} $label ($actual not > $threshold)"
  fi
}

# ─── Auth ─────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}=== Authentication ===${NC}"

LOGIN_RESP=$(curl -s -X POST "$BASE_URL/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"admin\",\"password\":\"admin\",\"role\":\"$ROLE_ID\",\"organization\":\"$ORG_ID\",\"warehouse\":\"$WH_ID\"}")

TOKEN=$(echo "$LOGIN_RESP" | perl -ne 'print $1 if /"token"\s*:\s*"([^"]+)"/')
assert_gt "JWT token obtained" 0 "${#TOKEN}"

AUTH="-H \"Authorization: Bearer $TOKEN\""

# Helper to call endpoints with auth
api_get() {
  curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/go$1"
}
api_get_status() {
  curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL/go$1"
}
api_post() {
  curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$BASE_URL/go$1" -d "$2"
}

# ─── GET /sales-order/header (list) ──────────────────────────────────────────
echo -e "\n${YELLOW}=== GET /sales-order/header (list) ===${NC}"

LIST_RESP=$(api_get "/sales-order/header")
LIST_STATUS=$(api_get_status "/sales-order/header")

assert_eq "HTTP 200" "200" "$LIST_STATUS"

COUNT=$(echo "$LIST_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['count'])" 2>/dev/null || echo "0")
assert_gt "Returns orders" 0 "$COUNT"

# Check fields present in first record
FIRST=$(echo "$LIST_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin)['data'][0]; print(json.dumps(d))" 2>/dev/null || echo "{}")

for field in id identifier businessPartner orderDate documentNo documentStatus grandTotalAmount summedLineAmount currency; do
  assert_contains "Field '$field' present" "\"$field\"" "$FIRST"
done

# Check FK fields are objects with id+identifier
BP_HAS_ID=$(echo "$FIRST" | python3 -c "
import sys,json
d=json.load(sys.stdin)
bp=d.get('businessPartner',{})
print('yes' if isinstance(bp, dict) and 'id' in bp and 'identifier' in bp else 'no')
" 2>/dev/null || echo "no")
assert_eq "businessPartner is {id,identifier}" "yes" "$BP_HAS_ID"

CURRENCY_HAS_ID=$(echo "$FIRST" | python3 -c "
import sys,json
d=json.load(sys.stdin)
c=d.get('currency',{})
print('yes' if isinstance(c, dict) and 'id' in c and 'identifier' in c else 'no')
" 2>/dev/null || echo "no")
assert_eq "currency is {id,identifier}" "yes" "$CURRENCY_HAS_ID"

# ─── GET /sales-order/header/:id (by ID) ────────────────────────────────────
echo -e "\n${YELLOW}=== GET /sales-order/header/:id (by ID) ===${NC}"

FIRST_ID=$(echo "$LIST_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])" 2>/dev/null || echo "")

if [ -n "$FIRST_ID" ]; then
  BYID_STATUS=$(api_get_status "/sales-order/header/$FIRST_ID")
  assert_eq "HTTP 200" "200" "$BYID_STATUS"

  BYID_RESP=$(api_get "/sales-order/header/$FIRST_ID")

  BYID_ID=$(echo "$BYID_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
  assert_eq "Returns correct ID" "$FIRST_ID" "$BYID_ID"

  for field in businessPartner partnerAddress orderDate scheduledDeliveryDate warehouse priceList paymentTerms invoiceAddress documentNo documentStatus grandTotalAmount summedLineAmount currency delivered; do
    assert_contains "Field '$field' in detail" "\"$field\"" "$BYID_RESP"
  done
else
  echo -e "  ${RED}SKIP${NC} No order ID available"
fi

# ─── GET /sales-order/header/:id (not found) ────────────────────────────────
echo -e "\n${YELLOW}=== GET /sales-order/header/:id (not found) ===${NC}"

NOTFOUND_STATUS=$(api_get_status "/sales-order/header/00000000000000000000000000000000")
assert_eq "HTTP 404 for missing ID" "404" "$NOTFOUND_STATUS"

# ─── POST /sales-order/header (create) ──────────────────────────────────────
echo -e "\n${YELLOW}=== POST /sales-order/header (create) ===${NC}"

# Extract reference IDs from the first existing order
BP_ID=$(echo "$FIRST" | python3 -c "import sys,json; print(json.load(sys.stdin)['businessPartner']['id'])" 2>/dev/null || echo "")
ADDR_ID=$(echo "$BYID_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['partnerAddress']['id'])" 2>/dev/null || echo "")
WH_REF=$(echo "$BYID_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['warehouse']['id'])" 2>/dev/null || echo "")
PL_ID=$(echo "$BYID_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['priceList']['id'])" 2>/dev/null || echo "")
PT_ID=$(echo "$BYID_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['paymentTerms']['id'])" 2>/dev/null || echo "")
INV_ADDR=$(echo "$BYID_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['invoiceAddress']['id'])" 2>/dev/null || echo "")

POST_BODY=$(cat <<ENDJSON
{
  "businessPartner": "$BP_ID",
  "partnerAddress": "$ADDR_ID",
  "orderDate": "2026-03-06",
  "scheduledDeliveryDate": "2026-03-13",
  "warehouse": "$WH_REF",
  "priceList": "$PL_ID",
  "paymentTerms": "$PT_ID",
  "invoiceAddress": "$INV_ADDR"
}
ENDJSON
)

POST_RAW=$(api_post "/sales-order/header" "$POST_BODY")
POST_STATUS=$(echo "$POST_RAW" | tail -1)
POST_RESP=$(echo "$POST_RAW" | sed '$d')

assert_eq "HTTP 201 Created" "201" "$POST_STATUS"

if [ "$POST_STATUS" = "201" ]; then
  NEW_ID=$(echo "$POST_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
  assert_gt "New order has ID" 0 "${#NEW_ID}"

  # Verify we can GET the newly created order
  if [ -n "$NEW_ID" ]; then
    VERIFY_STATUS=$(api_get_status "/sales-order/header/$NEW_ID")
    assert_eq "GET new order returns 200" "200" "$VERIFY_STATUS"

    VERIFY_RESP=$(api_get "/sales-order/header/$NEW_ID")
    VERIFY_BP=$(echo "$VERIFY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['businessPartner']['id'])" 2>/dev/null || echo "")
    assert_eq "New order has correct BP" "$BP_ID" "$VERIFY_BP"
  fi
else
  echo -e "  ${RED}POST failed, response:${NC}"
  echo "$POST_RESP" | head -5
fi

# ─── Summary ────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}════════════════════════════════════════${NC}"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}ALL TESTS PASSED: $PASS/$TOTAL${NC}"
else
  echo -e "${RED}FAILED: $FAIL/$TOTAL${NC} (${GREEN}$PASS passed${NC})"
fi
echo ""
exit "$FAIL"
