#!/usr/bin/env bash
set -euo pipefail
# Dry-run the data-testid codemod over one or more source trees.
# Usage: check-add-data-testid.sh [path...]
# With no path it scans every package that ships components (the monorepo was
# split into packages/app-shell-core + packages/etendo-go-core, so the default
# has to name both).
if [ "$#" -eq 0 ]; then
  set -- packages/app-shell-core/src packages/etendo-go-core/src
fi

# A typo'd path makes jscodeshift report "0 errors / 0 unmodified / 0 ok", which
# this script would read as a clean pass — a silent hole in a gate. Refuse to run
# on a path that does not exist instead.
for TARGET_PATH in "$@"; do
  if [ ! -d "$TARGET_PATH" ]; then
    echo "Target path does not exist: $TARGET_PATH"
    exit 2
  fi
done

echo "Running data-testid codemod dry-run on: $*"
OUTPUT=$(npx jscodeshift -t ./scripts/add-data-testid.cjs "$@" \
  --extensions=jsx --parser=babel \
  --ignore-pattern='**/node_modules/**' --ignore-pattern='**/dist/**' -d -p 2>&1) || RC=$?
RC=${RC:-0}
printf "%s\n" "$OUTPUT"
ERRORS=$(printf "%s" "$OUTPUT" | grep -Eo "^[[:space:]]*[0-9]+[[:space:]]+errors" | grep -Eo "[0-9]+" | head -n1 || true)
OK_COUNT=$(printf "%s" "$OUTPUT" | grep -Eo "^[[:space:]]*[0-9]+[[:space:]]+ok" | grep -Eo "[0-9]+" | head -n1 || true)
ERRORS=${ERRORS:-0}
OK_COUNT=${OK_COUNT:-0}
if [ "$ERRORS" -gt 0 ]; then echo "Errors detected."; exit 2; fi
if [ "$OK_COUNT" -gt 0 ]; then echo "Codemod would modify $OK_COUNT files."; exit 1; fi
echo "No modifications detected."
exit 0
