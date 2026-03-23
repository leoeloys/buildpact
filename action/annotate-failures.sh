#!/usr/bin/env bash
# annotate-failures.sh — Emit GitHub Actions annotations and step summary from
# BuildPact output files.
#
# Structured error format expected in output:
#   [ci:error] file=<path> line=<line> message=<msg>
#
# Usage: annotate-failures.sh (reads from $RUNNER_TEMP/bp-stdout.txt and bp-stderr.txt)

set -euo pipefail

RUNNER_TEMP="${RUNNER_TEMP:-/tmp}"
STDOUT_FILE="$RUNNER_TEMP/bp-stdout.txt"
STDERR_FILE="$RUNNER_TEMP/bp-stderr.txt"
GITHUB_STEP_SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
emit_annotation() {
  local file="$1"
  local line="$2"
  local msg="$3"
  if [ -n "$file" ] && [ -n "$line" ]; then
    echo "::error file=${file},line=${line}::${msg}"
  else
    echo "::error ::${msg}"
  fi
}

# ---------------------------------------------------------------------------
# Collect failures
# ---------------------------------------------------------------------------
declare -a STRUCTURED_ERRORS=()
declare -a GENERIC_ERRORS=()

parse_file() {
  local src="$1"
  [ -f "$src" ] || return 0

  while IFS= read -r raw_line; do
    # Structured: [ci:error] file=src/foo.ts line=42 message=Something broke
    if [[ "$raw_line" =~ ^\[ci:error\] ]]; then
      local body="${raw_line#\[ci:error\] }"
      local file="" line="" message=""

      # Extract file=
      if [[ "$body" =~ file=([^[:space:]]+) ]]; then
        file="${BASH_REMATCH[1]}"
      fi
      # Extract line=
      if [[ "$body" =~ line=([0-9]+) ]]; then
        line="${BASH_REMATCH[1]}"
      fi
      # Extract message= (everything after message=)
      if [[ "$body" =~ message=(.+)$ ]]; then
        message="${BASH_REMATCH[1]}"
      fi

      emit_annotation "$file" "$line" "${message:-unknown error}"
      STRUCTURED_ERRORS+=("| \`${file:-?}\` | ${line:-?} | ${message:-unknown error} |")

    # Generic: lines containing "error" (case-insensitive) that are not markers
    elif echo "$raw_line" | grep -qi 'error' && [[ "$raw_line" != \[ci:* ]]; then
      echo "::error ::${raw_line}"
      GENERIC_ERRORS+=("$raw_line")
    fi
  done < "$src"
}

parse_file "$STDOUT_FILE"
parse_file "$STDERR_FILE"

# ---------------------------------------------------------------------------
# Write step summary
# ---------------------------------------------------------------------------
{
  if [ "${#STRUCTURED_ERRORS[@]}" -eq 0 ] && [ "${#GENERIC_ERRORS[@]}" -eq 0 ]; then
    echo "All tasks completed successfully."
  else
    echo "## BuildPact Failures"
    echo ""

    if [ "${#STRUCTURED_ERRORS[@]}" -gt 0 ]; then
      echo "| File | Line | Message |"
      echo "|------|------|---------|"
      for row in "${STRUCTURED_ERRORS[@]}"; do
        echo "$row"
      done
      echo ""
    fi

    if [ "${#GENERIC_ERRORS[@]}" -gt 0 ]; then
      echo "### Additional error output"
      echo ""
      echo '```'
      for msg in "${GENERIC_ERRORS[@]}"; do
        echo "$msg"
      done
      echo '```'
    fi
  fi
} >> "$GITHUB_STEP_SUMMARY"
