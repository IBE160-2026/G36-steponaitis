#!/usr/bin/env bash
# Preflight check before (and between) unattended build-loop runs.
# Exit 0 = ready; exit 1 = a hard requirement is missing. WARN lines do not block.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

fail=0
ok()   { printf 'OK    %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; }
bad()  { printf 'FAIL  %s\n' "$1"; fail=1; }

# Git: main, clean, in sync with origin
branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = "main" ] && ok "on branch main" || bad "on branch '$branch', expected main"
[ -z "$(git status --porcelain)" ] && ok "working tree clean" || bad "working tree not clean"
if git fetch -q origin main 2>/dev/null; then
  behind=$(git rev-list --count HEAD..origin/main)
  [ "$behind" = "0" ] && ok "not behind origin/main" || bad "behind origin/main by $behind commit(s)"
else
  warn "could not fetch origin (offline?)"
fi

# Toolchain
command -v uv >/dev/null && ok "uv $(uv --version | awk '{print $2}')" || bad "uv missing"
uv python find 3.12 >/dev/null 2>&1 && ok "Python 3.12 available through uv" || bad "Python 3.12 missing (run: uv python install 3.12)"
if command -v node >/dev/null; then
  major=$(node -p 'process.versions.node.split(".")[0]')
  [ "$major" -ge 24 ] && ok "node $(node --version)" || bad "node $(node --version), need 24+"
else
  bad "node missing"
fi
command -v npm >/dev/null && ok "npm $(npm --version)" || bad "npm missing"

# Docker (Postgres 17 for tests/app)
docker info >/dev/null 2>&1 && ok "Docker daemon running" || bad "Docker daemon not running (open Docker Desktop)"

# Browsers for Playwright (chromium/firefox are downloaded by Playwright; msedge needs the real app)
[ -d "/Applications/Microsoft Edge.app" ] && ok "Microsoft Edge installed" || warn "Microsoft Edge missing: needed by the Playwright msedge project from Story 5.8"

# GitHub
if gh auth status -t 2>&1 | grep -q "'workflow'"; then ok "gh logged in with workflow scope"; else bad "gh not logged in with the workflow scope"; fi
if [ -f .github/workflows/ci.yml ]; then
  concl=$(gh run list -w ci.yml -b main -L 1 --json conclusion -q '.[0].conclusion' 2>/dev/null)
  case "$concl" in
    success) ok "last CI run on main: success" ;;
    "")      warn "no finished CI run on main yet (check that GitHub Actions is enabled for the repo)" ;;
    *)       warn "last CI run on main: $concl" ;;
  esac
else
  warn "no .github/workflows/ci.yml yet (Story 1.2 adds it)"
fi

# BMad state
uv run -q .claude/skills/bmad-sprint-planning/scripts/sprint_plan.py validate \
  --status-file .docs/implementation-artifacts/sprint-status.yaml 2>/dev/null | grep -q '"valid": true' \
  && ok "sprint-status.yaml valid" || bad "sprint-status.yaml invalid (run sprint planning: fix)"
[ -f _bmad/custom/bmad-build-auto.toml ] && ok "build-auto project facts present" || bad "_bmad/custom/bmad-build-auto.toml missing"
[ -f .claude/settings.json ] && ok "project permissions present" || bad ".claude/settings.json missing"

# Disk
free_gb=$(df -g . | awk 'NR==2 {print $4}')
[ "${free_gb:-0}" -ge 10 ] && ok "${free_gb} GB free disk" || warn "only ${free_gb} GB free disk"

[ $fail -eq 0 ] && echo "PREFLIGHT: READY" || echo "PREFLIGHT: NOT READY"
exit $fail
