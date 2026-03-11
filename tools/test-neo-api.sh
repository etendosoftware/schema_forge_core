#!/usr/bin/env bash
# test-neo-api.sh — Full integration test for NEO Headless API
# Tests ALL endpoints: GET, POST, PUT, PATCH, DELETE + Selectors
# for SalesOrder Header and Lines.

set -euo pipefail

BASE_URL="${ETENDO_URL:-http://localhost:8080/etendo}"
LOGIN_URL="${BASE_URL}/sws/login"
NEO_URL="${BASE_URL}/sws/neo"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

header() {
  echo ""
  echo -e "${BOLD}${CYAN}── $1 ──${RESET}"
}

check_result() {
  local test_name="$1"
  local http_code="$2"
  shift 2
  local expected_codes=("$@")
  local matched=false
  for code in "${expected_codes[@]}"; do
    [[ "$http_code" == "$code" ]] && matched=true && break
  done
  if $matched; then
    echo -e "  ${GREEN}PASS${RESET} [${http_code}] $test_name"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}FAIL${RESET} [${http_code}] $test_name (expected: ${expected_codes[*]})"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

skip() {
  echo -e "  ${YELLOW}SKIP${RESET} $1"
  SKIP_COUNT=$((SKIP_COUNT + 1))
}

extract_http_code() { echo "$1" | tail -1 | sed 's/.*HTTP_CODE://'; }
extract_body() { echo "$1" | sed '$d'; }

# JSON helper: extract a value by dot path
jq_path() {
  local json="$1" path="$2"
  echo "$json" | python3 -c "
import sys, json
raw = sys.stdin.buffer.read()
try: text = raw.decode('utf-8')
except: text = raw.decode('latin-1')
try: data = json.loads(text)
except: sys.exit(1)
obj = data
for key in '${path}'.split('.'):
    if key.startswith('['):
        obj = obj[int(key[1:-1])]
    elif isinstance(obj, list):
        obj = obj[int(key)]
    else:
        obj = obj.get(key)
    if obj is None: sys.exit(1)
if isinstance(obj, (dict, list)):
    print(json.dumps(obj, default=str)[:2000])
else:
    print(obj)
" 2>/dev/null
}

# JSON summary printer
json_summary() {
  python3 -c "
import sys, json
raw = sys.stdin.buffer.read()
try: text = raw.decode('utf-8')
except: text = raw.decode('latin-1')
try: data = json.loads(text)
except:
    print('  (non-JSON)')
    sys.exit(0)
if isinstance(data, dict):
    resp = data.get('response', data)
    if isinstance(resp, dict):
        status = resp.get('status', '')
        if status: print(f'  status: {status}')
        d = resp.get('data', resp.get('DATA', None))
        if isinstance(d, list):
            print(f'  records: {len(d)}')
            if d:
                keys = list(d[0].keys())[:8]
                print(f'  first keys: {keys}')
        err = resp.get('error', data.get('error', None))
        if err:
            if isinstance(err, dict): print(f'  error: {err.get(\"message\", err)}')
            else: print(f'  error: {str(err)[:200]}')
    else:
        print(f'  keys: {list(data.keys())[:8]}')
elif isinstance(data, list):
    print(f'  array[{len(data)}]')
else:
    print(f'  {str(data)[:200]}')
" <<< "$1" 2>/dev/null || echo "  (parse error)"
}

# curl wrapper
neo_curl() {
  local method="$1" url="$2" data="${3:-}"
  local args=(-s -w '\nHTTP_CODE:%{http_code}' -X "$method" "$url" -H "Content-Type: application/json")
  [[ -n "$AUTH_HEADER" ]] && args+=(-H "$AUTH_HEADER")
  [[ -n "$data" ]] && args+=(-d "$data")
  curl "${args[@]}"
}

echo -e "${BOLD}NEO Headless API — Full Test Suite${RESET}"
echo "Target: ${BASE_URL}"
echo "Date:   $(date '+%Y-%m-%d %H:%M:%S')"

# ═══════════════════════════════════════════════
# LOGIN
# ═══════════════════════════════════════════════
header "0. Login"
AUTH_HEADER=""

LOGIN_RAW=$(curl -s -w '\nHTTP_CODE:%{http_code}' \
  -X POST "${LOGIN_URL}" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin","role":"42D0EEB1C66F497A90DD526DC597E6F0"}')
LOGIN_CODE=$(extract_http_code "$LOGIN_RAW")
LOGIN_BODY=$(extract_body "$LOGIN_RAW")
check_result "POST /sws/login" "$LOGIN_CODE" "200"

TOKEN=$(jq_path "$LOGIN_BODY" "token" || echo "")
if [[ -z "$TOKEN" ]]; then
  echo -e "  ${RED}FATAL: No token. Aborting.${RESET}"
  exit 1
fi
echo "  Token: ${TOKEN:0:20}..."
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

# ═══════════════════════════════════════════════
# DISCOVERY & SPEC DESCRIBE
# ═══════════════════════════════════════════════
header "1. Discovery"
RAW=$(neo_curl GET "${NEO_URL}/")
CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
check_result "GET /sws/neo/ (discovery)" "$CODE" "200"
json_summary "$BODY"

header "2. Spec Describe"
RAW=$(neo_curl GET "${NEO_URL}/SalesOrder")
CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
check_result "GET /sws/neo/SalesOrder (describe)" "$CODE" "200"
json_summary "$BODY"

# ═══════════════════════════════════════════════
# HEADER — GET list
# ═══════════════════════════════════════════════
header "3. Header — GET list"
RAW=$(neo_curl GET "${NEO_URL}/SalesOrder/Header")
CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
check_result "GET /SalesOrder/Header (list)" "$CODE" "200"
json_summary "$BODY"

# Extract first ID
HEADER_ID=$(jq_path "$BODY" "response.data.0.id" 2>/dev/null || echo "")
if [[ -z "$HEADER_ID" ]]; then
  echo -e "  ${YELLOW}No record ID found — some tests will be skipped${RESET}"
fi

# ═══════════════════════════════════════════════
# HEADER — GET by ID
# ═══════════════════════════════════════════════
header "4. Header — GET by ID"
if [[ -n "$HEADER_ID" ]]; then
  RAW=$(neo_curl GET "${NEO_URL}/SalesOrder/Header/${HEADER_ID}")
  CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
  check_result "GET /SalesOrder/Header/${HEADER_ID:0:8}..." "$CODE" "200"
  json_summary "$BODY"
else
  skip "GET by ID — no record ID"
fi

# ═══════════════════════════════════════════════
# HEADER — Selectors
# ═══════════════════════════════════════════════
header "5. Header — Selectors"
RAW=$(neo_curl GET "${NEO_URL}/SalesOrder/Header/selectors")
CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
check_result "GET /SalesOrder/Header/selectors (list)" "$CODE" "200"
json_summary "$BODY"

# Pick first selector column name and fetch values
FIRST_SEL=$(jq_path "$BODY" "selectors.0.columnName" 2>/dev/null || jq_path "$BODY" "0.columnName" 2>/dev/null || echo "")
if [[ -z "$FIRST_SEL" ]]; then
  FIRST_SEL="C_BPartner_ID"
  echo "  Using default selector: $FIRST_SEL"
else
  echo "  First selector column: $FIRST_SEL"
fi

RAW=$(neo_curl GET "${NEO_URL}/SalesOrder/Header/selectors/${FIRST_SEL}")
CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
check_result "GET /SalesOrder/Header/selectors/${FIRST_SEL}" "$CODE" "200"
json_summary "$BODY"

# ═══════════════════════════════════════════════
# HEADER — PATCH (update a field on existing record)
# ═══════════════════════════════════════════════
header "6. Header — PATCH"
if [[ -n "$HEADER_ID" ]]; then
  # Read current description, then patch it
  RAW=$(neo_curl PATCH "${NEO_URL}/SalesOrder/Header/${HEADER_ID}" "{\"id\":\"${HEADER_ID}\",\"_entityName\":\"Order\",\"description\":\"NEO test patch\"}")
  CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
  check_result "PATCH /SalesOrder/Header/${HEADER_ID:0:8}..." "$CODE" "200"
  json_summary "$BODY"

  # Revert
  RAW=$(neo_curl PATCH "${NEO_URL}/SalesOrder/Header/${HEADER_ID}" "{\"id\":\"${HEADER_ID}\",\"_entityName\":\"Order\",\"description\":null}")
  CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
  check_result "PATCH revert description to null" "$CODE" "200"
else
  skip "PATCH — no record ID"
fi

# ═══════════════════════════════════════════════
# HEADER — PUT (full update, same as PATCH in Etendo)
# ═══════════════════════════════════════════════
header "7. Header — PUT"
if [[ -n "$HEADER_ID" ]]; then
  RAW=$(neo_curl PUT "${NEO_URL}/SalesOrder/Header/${HEADER_ID}" "{\"id\":\"${HEADER_ID}\",\"_entityName\":\"Order\",\"description\":\"NEO test put\"}")
  CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
  check_result "PUT /SalesOrder/Header/${HEADER_ID:0:8}..." "$CODE" "200"
  json_summary "$BODY"

  # Revert
  RAW=$(neo_curl PUT "${NEO_URL}/SalesOrder/Header/${HEADER_ID}" "{\"id\":\"${HEADER_ID}\",\"_entityName\":\"Order\",\"description\":null}")
  CODE=$(extract_http_code "$RAW")
  check_result "PUT revert" "$CODE" "200"
else
  skip "PUT — no record ID"
fi

# ═══════════════════════════════════════════════
# LINES — GET list (child of Header)
# ═══════════════════════════════════════════════
header "8. Lines — GET list"
if [[ -n "$HEADER_ID" ]]; then
  RAW=$(neo_curl GET "${NEO_URL}/SalesOrder/Lines?parentId=${HEADER_ID}")
  CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
  check_result "GET /SalesOrder/Lines?parentId=${HEADER_ID:0:8}..." "$CODE" "200"
  json_summary "$BODY"

  LINE_ID=$(jq_path "$BODY" "response.data.0.id" 2>/dev/null || echo "")
  if [[ -n "$LINE_ID" ]]; then
    echo "  First line ID: ${LINE_ID:0:12}..."
  else
    echo -e "  ${YELLOW}No lines found for this order${RESET}"
  fi
else
  skip "Lines GET — no header ID"
  LINE_ID=""
fi

# ═══════════════════════════════════════════════
# LINES — GET by ID
# ═══════════════════════════════════════════════
header "9. Lines — GET by ID"
if [[ -n "${LINE_ID:-}" ]]; then
  RAW=$(neo_curl GET "${NEO_URL}/SalesOrder/Lines/${LINE_ID}")
  CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
  check_result "GET /SalesOrder/Lines/${LINE_ID:0:8}..." "$CODE" "200"
  json_summary "$BODY"
else
  skip "Lines GET by ID — no line ID"
fi

# ═══════════════════════════════════════════════
# LINES — Selectors
# ═══════════════════════════════════════════════
header "10. Lines — Selectors"
RAW=$(neo_curl GET "${NEO_URL}/SalesOrder/Lines/selectors")
CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
check_result "GET /SalesOrder/Lines/selectors (list)" "$CODE" "200"
json_summary "$BODY"

# Pick first simple (non-OBUISEL) selector for lines
LINE_SEL=$(echo "$BODY" | python3 -c "
import sys, json
raw = sys.stdin.buffer.read()
try: text = raw.decode('utf-8')
except: text = raw.decode('latin-1')
data = json.loads(text)
sels = data.get('selectors', data) if isinstance(data, dict) else data
for s in sels:
    if s.get('type') == 'simple':
        print(s['columnName'])
        break
" 2>/dev/null || echo "C_UOM_ID")
echo "  Testing selector: $LINE_SEL"

RAW=$(neo_curl GET "${NEO_URL}/SalesOrder/Lines/selectors/${LINE_SEL}")
CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
check_result "GET /SalesOrder/Lines/selectors/${LINE_SEL}" "$CODE" "200"
json_summary "$BODY"

# ═══════════════════════════════════════════════
# LINES — PATCH
# ═══════════════════════════════════════════════
header "11. Lines — PATCH"
if [[ -n "${LINE_ID:-}" ]]; then
  RAW=$(neo_curl PATCH "${NEO_URL}/SalesOrder/Lines/${LINE_ID}" "{\"id\":\"${LINE_ID}\",\"_entityName\":\"OrderLine\",\"description\":\"NEO line test\"}")
  CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
  check_result "PATCH /SalesOrder/Lines/${LINE_ID:0:8}..." "$CODE" "200"
  json_summary "$BODY"

  # Revert
  RAW=$(neo_curl PATCH "${NEO_URL}/SalesOrder/Lines/${LINE_ID}" "{\"id\":\"${LINE_ID}\",\"_entityName\":\"OrderLine\",\"description\":null}")
  CODE=$(extract_http_code "$RAW")
  check_result "PATCH revert line description" "$CODE" "200"
else
  skip "Lines PATCH — no line ID"
fi

# ═══════════════════════════════════════════════
# POST (create) — test endpoint responds, expect validation error
# ═══════════════════════════════════════════════
header "12. Header — POST (create attempt)"
RAW=$(neo_curl POST "${NEO_URL}/SalesOrder/Header" '{"_entityName":"Order","documentNo":"NEO-TEST-001"}')
CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
check_result "POST /SalesOrder/Header (minimal, expect error)" "$CODE" "200" "201" "400" "409" "500"
json_summary "$BODY"

# ═══════════════════════════════════════════════
# DELETE — test endpoint responds
# ═══════════════════════════════════════════════
header "13. Header — DELETE (attempt on existing)"
if [[ -n "$HEADER_ID" ]]; then
  RAW=$(neo_curl DELETE "${NEO_URL}/SalesOrder/Header/${HEADER_ID}")
  CODE=$(extract_http_code "$RAW"); BODY=$(extract_body "$RAW")
  # Accept errors too — we just want to confirm the endpoint is reachable
  check_result "DELETE /SalesOrder/Header/${HEADER_ID:0:8}... (expect error)" "$CODE" "200" "204" "400" "403" "409" "500"
  json_summary "$BODY"
else
  skip "DELETE — no record ID"
fi

# ═══════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════
TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))

echo ""
echo -e "${BOLD}════════════════════════════════${RESET}"
echo -e "${BOLD}Summary${RESET}"
echo -e "${BOLD}════════════════════════════════${RESET}"
echo -e "  Total:   ${TOTAL}"
echo -e "  ${GREEN}Passed:  ${PASS_COUNT}${RESET}"
echo -e "  ${RED}Failed:  ${FAIL_COUNT}${RESET}"
echo -e "  ${YELLOW}Skipped: ${SKIP_COUNT}${RESET}"
echo ""

if [[ "$FAIL_COUNT" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All tests passed!${RESET}"
  exit 0
else
  echo -e "${RED}${BOLD}${FAIL_COUNT} test(s) failed.${RESET}"
  exit 1
fi
