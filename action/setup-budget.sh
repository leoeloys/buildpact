#!/usr/bin/env bash
# setup-budget.sh — Write or merge budget config into .buildpact/config.yaml.
#
# Usage: setup-budget.sh <budget>
#   budget  Per-session budget in USD (e.g. "1.00"). Pass "" or "0" to skip.

set -euo pipefail

BUDGET="${1:-}"

# Skip when budget is unset, empty, or zero.
if [ -z "$BUDGET" ] || [ "$BUDGET" = "0" ] || [ "$BUDGET" = "0.00" ]; then
  echo "Budget guard disabled — skipping config write."
  exit 0
fi

CONFIG_DIR=".buildpact"
CONFIG_FILE="$CONFIG_DIR/config.yaml"

mkdir -p "$CONFIG_DIR"

if [ -f "$CONFIG_FILE" ]; then
  # File exists — remove any existing budget block and append the new one.
  # The budget block is identified by the leading 'budget:' key.
  TEMP_FILE="$(mktemp)"
  # Strip existing budget block (key + indented sub-keys) before re-appending.
  awk '
    /^budget:/ { skip=1; next }
    skip && /^[[:space:]]/ { next }
    { skip=0; print }
  ' "$CONFIG_FILE" > "$TEMP_FILE"
  mv "$TEMP_FILE" "$CONFIG_FILE"

  printf '\nbudget:\n  per_session_usd: %s\n' "$BUDGET" >> "$CONFIG_FILE"
  echo "Budget updated in $CONFIG_FILE: \$${BUDGET}"
else
  # No config file — create a minimal one.
  cat > "$CONFIG_FILE" <<YAML
budget:
  per_session_usd: ${BUDGET}
YAML
  echo "Budget config created at $CONFIG_FILE: \$${BUDGET}"
fi
