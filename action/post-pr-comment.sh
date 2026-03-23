#!/usr/bin/env bash
# post-pr-comment.sh — Create or update a BuildPact summary comment on a pull request.
#
# Reads from environment:
#   GITHUB_EVENT_NAME   Must be "pull_request" to proceed.
#   GITHUB_TOKEN        Personal access token / GITHUB_TOKEN secret.
#   GITHUB_REPOSITORY   Owner/repo (e.g. "acme/myproject").
#   GITHUB_RUN_ID       Workflow run ID for the deep-link.
#   GITHUB_SERVER_URL   Base GitHub URL (default: https://github.com).
#   BP_COMMAND          BuildPact command that was run.
#   BP_COST             Reported cost in USD.
#   BP_SUMMARY          One-line summary from [ci:summary].
#
# Args (optional fallback):
#   $1  PR number (if not derivable from event context).

set -euo pipefail

# ---------------------------------------------------------------------------
# Guard: only run on pull_request events.
# ---------------------------------------------------------------------------
EVENT="${GITHUB_EVENT_NAME:-}"
if [ "$EVENT" != "pull_request" ]; then
  echo "Not a pull_request event (got: '${EVENT}') — skipping PR comment."
  exit 0
fi

# ---------------------------------------------------------------------------
# Guard: require GITHUB_TOKEN.
# ---------------------------------------------------------------------------
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$GITHUB_TOKEN" ]; then
  echo "::warning ::GITHUB_TOKEN is not set — cannot post PR comment."
  exit 0
fi

# ---------------------------------------------------------------------------
# Resolve PR number.
# ---------------------------------------------------------------------------
PR_NUMBER="${1:-}"
if [ -z "$PR_NUMBER" ]; then
  # GitHub populates GITHUB_REF as refs/pull/<num>/merge on pull_request events.
  GITHUB_REF="${GITHUB_REF:-}"
  if [[ "$GITHUB_REF" =~ ^refs/pull/([0-9]+)/merge$ ]]; then
    PR_NUMBER="${BASH_REMATCH[1]}"
  fi
fi

if [ -z "$PR_NUMBER" ]; then
  echo "::warning ::Could not determine PR number — skipping PR comment."
  exit 0
fi

# ---------------------------------------------------------------------------
# Build comment body.
# ---------------------------------------------------------------------------
REPOSITORY="${GITHUB_REPOSITORY:-unknown/unknown}"
RUN_ID="${GITHUB_RUN_ID:-}"
SERVER_URL="${GITHUB_SERVER_URL:-https://github.com}"
COMMAND="${BP_COMMAND:-unknown}"
COST="${BP_COST:-0.00}"
SUMMARY="${BP_SUMMARY:-}"
MARKER="<!-- buildpact-summary -->"

if [ -n "$RUN_ID" ]; then
  RUN_LINK="${SERVER_URL}/${REPOSITORY}/actions/runs/${RUN_ID}"
else
  RUN_LINK="${SERVER_URL}/${REPOSITORY}/actions"
fi

# Derive tasks-completed from summary when possible (e.g. "3 tasks completed, 0 failed").
TASKS_COMPLETED="$(echo "$SUMMARY" | grep -oE '[0-9]+ tasks? completed' | head -1 || true)"
TASKS_COMPLETED="${TASKS_COMPLETED:-see summary}"

# Capture elapsed time if exported by run-command.sh.
TIME_ELAPSED="${BP_ELAPSED:-n/a}"

COMMENT_BODY="${MARKER}
### BuildPact CI Report

| Field | Value |
|-------|-------|
| Command | \`buildpact ${COMMAND}\` |
| Tasks completed | ${TASKS_COMPLETED} |
| Cost | \$${COST} |
| Time elapsed | ${TIME_ELAPSED} |

${SUMMARY:+> ${SUMMARY}
}
[View workflow run](${RUN_LINK})"

# ---------------------------------------------------------------------------
# GitHub REST API helpers.
# ---------------------------------------------------------------------------
API_BASE="https://api.github.com"
AUTH_HEADER="Authorization: Bearer ${GITHUB_TOKEN}"
ACCEPT_HEADER="Accept: application/vnd.github+json"
API_VERSION_HEADER="X-GitHub-Api-Version: 2022-11-28"

find_existing_comment() {
  local page=1
  while true; do
    local response
    response="$(curl -s -f \
      -H "$AUTH_HEADER" \
      -H "$ACCEPT_HEADER" \
      -H "$API_VERSION_HEADER" \
      "${API_BASE}/repos/${REPOSITORY}/issues/${PR_NUMBER}/comments?per_page=100&page=${page}")"

    # Extract comment ID where body contains the marker.
    local found_id
    found_id="$(echo "$response" | grep -B5 "$MARKER" | grep '"id":' | head -1 | grep -oE '[0-9]+' || true)"
    if [ -n "$found_id" ]; then
      echo "$found_id"
      return 0
    fi

    # Check if there are more pages.
    local count
    count="$(echo "$response" | grep -c '"id":' || true)"
    if [ "$count" -lt 100 ]; then
      break
    fi
    page=$((page + 1))
  done
  echo ""
}

post_comment() {
  local body="$1"
  curl -s -f -X POST \
    -H "$AUTH_HEADER" \
    -H "$ACCEPT_HEADER" \
    -H "$API_VERSION_HEADER" \
    -H "Content-Type: application/json" \
    "${API_BASE}/repos/${REPOSITORY}/issues/${PR_NUMBER}/comments" \
    -d "$(printf '{"body": %s}' "$(echo "$body" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")" \
    > /dev/null
  echo "PR comment posted on #${PR_NUMBER}."
}

update_comment() {
  local comment_id="$1"
  local body="$2"
  curl -s -f -X PATCH \
    -H "$AUTH_HEADER" \
    -H "$ACCEPT_HEADER" \
    -H "$API_VERSION_HEADER" \
    -H "Content-Type: application/json" \
    "${API_BASE}/repos/${REPOSITORY}/issues/comments/${comment_id}" \
    -d "$(printf '{"body": %s}' "$(echo "$body" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")" \
    > /dev/null
  echo "PR comment updated (id=${comment_id}) on #${PR_NUMBER}."
}

# ---------------------------------------------------------------------------
# Create or update comment.
# ---------------------------------------------------------------------------
EXISTING_ID="$(find_existing_comment)"

if [ -n "$EXISTING_ID" ]; then
  update_comment "$EXISTING_ID" "$COMMENT_BODY"
else
  post_comment "$COMMENT_BODY"
fi
