#!/usr/bin/env bash
# BuildPact — One-line installer
# Usage: curl -fsSL https://raw.githubusercontent.com/leoeloys/buildpact/main/scripts/install.sh | bash
set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()  { printf "${BLUE}ℹ${NC}  %s\n" "$1"; }
ok()    { printf "${GREEN}✔${NC}  %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${NC}  %s\n" "$1"; }
fail()  { printf "${RED}✖${NC}  %s\n" "$1"; exit 1; }

# ─── Config ──────────────────────────────────────────────────────────────────
INSTALL_DIR="${BUILDPACT_INSTALL_DIR:-$HOME/.buildpact-cli}"
REPO_URL="https://github.com/leoeloys/buildpact.git"

# ─── Header ──────────────────────────────────────────────────────────────────
printf "\n${BOLD}  BuildPact Installer${NC}\n"
printf "  ─────────────────────\n\n"

# ─── Check prerequisites ────────────────────────────────────────────────────
command -v git >/dev/null 2>&1 || fail "Git is required. Install it first: https://git-scm.com"
command -v node >/dev/null 2>&1 || fail "Node.js >= 20 is required. Install it first: https://nodejs.org"
command -v npm >/dev/null 2>&1 || fail "npm is required (comes with Node.js)"

# Check Node.js version
NODE_MAJOR=$(node -e "console.log(process.version.slice(1).split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js >= 20 required, you have $(node --version). Update: https://nodejs.org"
fi

ok "Prerequisites: git, node v$(node --version | tr -d 'v'), npm"

# ─── Install or Update ──────────────────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --ff-only --quiet
  ok "Source updated"
else
  info "Cloning BuildPact..."
  git clone --depth 1 --quiet "$REPO_URL" "$INSTALL_DIR"
  ok "Cloned to $INSTALL_DIR"
fi

# ─── Build ───────────────────────────────────────────────────────────────────
cd "$INSTALL_DIR"
info "Installing dependencies..."
npm install --no-audit --no-fund --silent 2>/dev/null
ok "Dependencies installed"

info "Building..."
npm run build --silent 2>/dev/null
ok "Build complete"

# ─── Link globally ──────────────────────────────────────────────────────────
info "Linking 'buildpact' command..."
npm link --silent 2>/dev/null || {
  warn "npm link failed (permission issue). Trying with sudo..."
  sudo npm link --silent 2>/dev/null || fail "Could not link. Try: cd $INSTALL_DIR && sudo npm link"
}

# ─── Verify ──────────────────────────────────────────────────────────────────
VERSION=$(buildpact --version 2>/dev/null || echo "unknown")
ok "$VERSION installed and in PATH"

# ─── Done ────────────────────────────────────────────────────────────────────
printf "\n${GREEN}${BOLD}  Done!${NC} Start with:\n\n"
printf "    ${BOLD}buildpact init${NC}        # new project\n"
printf "    ${BOLD}buildpact adopt${NC}       # existing project\n"
printf "    ${BOLD}buildpact --help${NC}      # all commands\n\n"
printf "  To update later:  ${BOLD}buildpact upgrade${NC}\n\n"
