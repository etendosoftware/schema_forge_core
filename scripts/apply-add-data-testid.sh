#!/usr/bin/env bash
set -euo pipefail
# Apply the data-testid codemod over one or more source trees.
# Usage: apply-add-data-testid.sh [path...] [--commit]
# With no path it rewrites every package that ships components (the monorepo was
# split into packages/app-shell-core + packages/etendo-go-core, so the default
# has to name both). The script only stages; --commit makes it commit too.
COMMIT_FLAG=""
TARGET_PATHS=()
for ARG in "$@"; do
  if [ "$ARG" = "--commit" ]; then
    COMMIT_FLAG="--commit"
  else
    TARGET_PATHS+=("$ARG")
  fi
done
if [ "${#TARGET_PATHS[@]}" -eq 0 ]; then
  TARGET_PATHS=(packages/app-shell-core/src packages/etendo-go-core/src)
fi

# Guard against a typo'd path silently rewriting nothing.
for TARGET_PATH in "${TARGET_PATHS[@]}"; do
  if [ ! -d "$TARGET_PATH" ]; then
    echo "Target path does not exist: $TARGET_PATH"
    exit 2
  fi
done

echo "Applying data-testid codemod to: ${TARGET_PATHS[*]}"
npx jscodeshift -t ./scripts/add-data-testid.cjs "${TARGET_PATHS[@]}" \
  --extensions=jsx --parser=babel \
  --ignore-pattern='**/node_modules/**' --ignore-pattern='**/dist/**'
if git rev-parse --git-dir >/dev/null 2>&1; then
  CHANGED=$(git status --porcelain)
  if [ -n "$CHANGED" ]; then
    echo "Files modified:"; git --no-pager status --short
    if [ "$COMMIT_FLAG" = "--commit" ]; then
      git add -A
      git commit -m "Feature ETP-4208: Apply data-testid codemod"
      echo "Changes committed."
    else
      echo "Changes staged. Commit manually or re-run with --commit."
    fi
  else echo "No files changed."; fi
fi
