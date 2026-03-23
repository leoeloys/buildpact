#!/usr/bin/env bash
# run-command.sh — Execute a BuildPact command and write GitHub Action outputs.
#
# Usage: run-command.sh <command> [plan] [ci-mode]
#   command   BuildPact sub-command (e.g. plan, execute, quick).
#   plan      Optional path to a plan file/directory.
#   ci-mode   "true" to pass --ci flag (default: "true").

set -euo pipefail

COMMAND="${1:?run-command.sh: command argument is required}"
PLAN="${2:-}"
CI_MODE="${3:-true}"

# Signal to BuildPact internals that we are running inside CI.
export BP_CI=true

# Ensure RUNNER_TEMP has a fallback for local testing outside GitHub Actions.
RUNNER_TEMP="${RUNNER_TEMP:-/tmp}"
STDOUT_FILE="$RUNNER_TEMP/bp-stdout.txt"
STDERR_FILE="$RUNNER_TEMP/bp-stderr.txt"

# Build argument list.
ARGS=("$COMMAND")

if [ "$CI_MODE" = "true" ]; then
  ARGS+=("--ci")
fi

if [ -n "$PLAN" ]; then
  ARGS+=("$PLAN")
fi

echo "Running: buildpact ${ARGS[*]}"

# Execute, stream output to console AND capture it.
EXIT_CODE=0
buildpact "${ARGS[@]}" \
  > >(tee "$STDOUT_FILE") \
  2> >(tee "$STDERR_FILE" >&2) \
  || EXIT_CODE=$?

# ---------------------------------------------------------------------------
# Extract structured markers from stdout.
# [ci:cost] 0.04
# [ci:summary] 3 tasks completed, 0 failed
# ---------------------------------------------------------------------------
COST="$(grep -m1 '^\[ci:cost\]' "$STDOUT_FILE" | sed 's/^\[ci:cost\][[:space:]]*//' || true)"
COST="${COST:-0.00}"

SUMMARY="$(grep -m1 '^\[ci:summary\]' "$STDOUT_FILE" | sed 's/^\[ci:summary\][[:space:]]*//' || true)"
SUMMARY="${SUMMARY:-}"

# ---------------------------------------------------------------------------
# Write outputs to GITHUB_OUTPUT (or print for local testing).
# ---------------------------------------------------------------------------
GITHUB_OUTPUT="${GITHUB_OUTPUT:-/dev/null}"

{
  echo "exit-code=${EXIT_CODE}"
  echo "cost=${COST}"
  printf 'summary=%s\n' "$SUMMARY"
} >> "$GITHUB_OUTPUT"

echo "Exit code : ${EXIT_CODE}"
echo "Cost      : \$${COST}"
echo "Summary   : ${SUMMARY}"

exit "$EXIT_CODE"
