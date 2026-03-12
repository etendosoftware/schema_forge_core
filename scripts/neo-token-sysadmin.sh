#!/usr/bin/env bash
# Generate a JWT token for System Administrator (role 0, org *)
# Usage: ./scripts/neo-token-sysadmin.sh
#   or:  TOKEN=$(./scripts/neo-token-sysadmin.sh)
# Env vars: ETENDO_URL, ETENDO_USER, ETENDO_PASSWORD

set -euo pipefail

BASE_URL="${ETENDO_URL:-http://localhost:8080/etendo}"
USERNAME="${ETENDO_USER:-admin}"
PASSWORD="${ETENDO_PASSWORD:-admin}"

RESPONSE=$(/usr/bin/curl -s --connect-timeout 5 -X POST "$BASE_URL/sws/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" 2>/dev/null) || {
  echo "ERROR: Cannot connect to Etendo at $BASE_URL" >&2
  exit 1
}

TOKEN=$(python3 -c "
import json, sys
data = json.loads(sys.stdin.buffer.read().decode('utf-8','replace'))
if data.get('status') == 'error':
    print('ERROR: ' + data.get('message','unknown'), file=sys.stderr)
    sys.exit(1)
print(data['token'])
" <<< "$RESPONSE" 2>/dev/null) || {
  echo "ERROR: Login failed. Response: $RESPONSE" >&2
  exit 1
}

echo "$TOKEN"
