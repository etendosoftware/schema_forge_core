#!/usr/bin/env bash
# sync-offline-regen-check.sh
#
# Generates the mirror "Offline Regeneration Check" workflow for
# com.etendoerp.go from the canonical workflow in this repo.
#
# Strategy: the canonical YAML carries a `# @mirror-shared-below` marker.
# Everything ABOVE the marker is repo-specific (header, triggers, checkouts
# for schema_forge first) and gets replaced by a snippet stored in
#   scripts/mirror-offline-regen-check/header.yml
# Everything BELOW the marker is identical for both repos (setup-node,
# install, run regen-check, verify drift, dump on failure) and is copied
# verbatim from the canonical.
#
# Re-run after any change to the canonical workflow OR the header snippet
# so both repos stay in sync.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FORGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ETENDO_ROOT="$(cd "$SCHEMA_FORGE_ROOT/.." && pwd)"
GO_REPO_DIR="$ETENDO_ROOT/modules/com.etendoerp.go"

SOURCE="$SCHEMA_FORGE_ROOT/.github/workflows/offline-regen-check.yml"
HEADER_SNIPPET="$SCRIPT_DIR/mirror-offline-regen-check/header.yml"
TARGET="$GO_REPO_DIR/.github/workflows/offline-regen-check.yml"
MARKER="# @mirror-shared-below"

for f in "$SOURCE" "$HEADER_SNIPPET"; do
  if [ ! -f "$f" ]; then
    echo "🚨 Missing: $f" >&2
    exit 1
  fi
done

if [ ! -d "$GO_REPO_DIR" ]; then
  echo "🚨 com.etendoerp.go not found at: $GO_REPO_DIR" >&2
  echo "   Expected sibling layout: <etendo_root>/{schema_forge,modules/com.etendoerp.go}" >&2
  exit 1
fi

MARKER_LINE="$(grep -n -F "$MARKER" "$SOURCE" | head -n1 | cut -d: -f1 || true)"
if [ -z "$MARKER_LINE" ]; then
  echo "🚨 Marker '$MARKER' not found in $SOURCE" >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET")"

# Mirror = header snippet + canonical tail starting at the marker line.
{
  cat "$HEADER_SNIPPET"
  tail -n "+$MARKER_LINE" "$SOURCE"
} > "$TARGET"

echo "✅ Wrote mirror workflow:"
echo "   $TARGET"
echo ""
echo "Source pieces:"
echo "   header (replaced) : $HEADER_SNIPPET"
echo "   tail   (copied)   : $SOURCE (from line $MARKER_LINE)"
echo ""
echo "Next: review with"
echo "   (cd $GO_REPO_DIR && git diff .github/workflows/offline-regen-check.yml)"
