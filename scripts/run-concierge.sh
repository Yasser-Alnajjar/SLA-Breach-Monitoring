#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEFAULT_RESOLUTION="urgent=4h,high=8h,default=24h"

# Prompt with a default shown in brackets; Enter keeps the default.
ask() {
  local prompt="$1" default="${2:-}" answer
  if [[ -n "$default" ]]; then
    read -r -p "$prompt [$default]: " answer
  else
    read -r -p "$prompt: " answer
  fi
  answer="${answer:-$default}"
  # Drop stray control/non-printable bytes (e.g. from arrow keys) and trim spaces.
  answer="$(printf '%s' "$answer" | LC_ALL=C tr -cd '[:print:]' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  printf '%s' "$answer"
}

echo ""
echo "======================================"
echo "       SLA Concierge Analyzer"
echo "======================================"
echo ""

DATA_DIR="$(ask "Data folder path" "apps/concierge/data/acme")"
DATA_DIR="${DATA_DIR/#\~/$HOME}"
# The CLI runs from apps/concierge, so relative paths must be resolved against the repo root first.
[[ "$DATA_DIR" != /* ]] && DATA_DIR="$REPO_ROOT/$DATA_DIR"

if [[ ! -d "$DATA_DIR" ]]; then
  echo ""
  echo "Error: Directory does not exist:"
  echo "$DATA_DIR"
  exit 1
fi
DATA_DIR="$(cd "$DATA_DIR" && pwd)"

echo ""

ZENDESK_TICKETS="$(ask "Zendesk tickets CSV filename" "zendesk-tickets.csv")"
ZENDESK_AUDITS="$(ask "Zendesk audits CSV filename" "zendesk-audits.csv")"
JIRA_ISSUES="$(ask "Jira issues CSV filename" "jira-issues.csv")"
JIRA_CHANGELOG="$(ask "Jira changelog CSV filename" "jira-changelog.csv")"

echo ""

ZENDESK_TICKETS_PATH="$DATA_DIR/$ZENDESK_TICKETS"
ZENDESK_AUDITS_PATH="$DATA_DIR/$ZENDESK_AUDITS"
JIRA_ISSUES_PATH="$DATA_DIR/$JIRA_ISSUES"
JIRA_CHANGELOG_PATH="$DATA_DIR/$JIRA_CHANGELOG"

for file in \
  "$ZENDESK_TICKETS_PATH" \
  "$ZENDESK_AUDITS_PATH" \
  "$JIRA_ISSUES_PATH" \
  "$JIRA_CHANGELOG_PATH"
do
  if [[ ! -f "$file" ]]; then
    echo ""
    echo "Error: File does not exist:"
    echo "$file"
    exit 1
  fi
done

# The Zendesk export's metadata.json knows the subdomain; offer it as the default.
DEFAULT_SUBDOMAIN=""
if [[ -f "$DATA_DIR/metadata.json" ]]; then
  DEFAULT_SUBDOMAIN="$(sed -n 's/.*"subdomain": *"\([^"]*\)".*/\1/p' "$DATA_DIR/metadata.json" | head -1)"
fi

RESOLUTION="$(ask "Resolution targets" "$DEFAULT_RESOLUTION")"
BUSINESS_HOURS="$(ask "Business hours, e.g. mon-fri 09:00-17:00 (blank = 24/7)")"
TIMEZONE="$(ask "Time zone" "UTC")"
ZENDESK_SUBDOMAIN="$(ask "Zendesk subdomain" "$DEFAULT_SUBDOMAIN")"
COMPANY="$(ask "Company name")"
AS_OF="$(ask "As-of timestamp, e.g. 2026-09-17T00:00:00Z (blank = now)")"

if [[ -z "$ZENDESK_SUBDOMAIN" ]]; then
  echo ""
  echo "Warning: no Zendesk subdomain. Jira links to Zendesk tickets won't be recognised."
fi

# All three formats must use the same evaluation time, or their numbers drift apart.
AS_OF="${AS_OF:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

echo ""
echo "--------------------------------------"
echo "Configuration"
echo "--------------------------------------"
echo "Data folder:       $DATA_DIR"
echo "Zendesk tickets:   $ZENDESK_TICKETS_PATH"
echo "Zendesk audits:    $ZENDESK_AUDITS_PATH"
echo "Jira issues:       $JIRA_ISSUES_PATH"
echo "Jira changelog:    $JIRA_CHANGELOG_PATH"
echo "Resolution:        $RESOLUTION"
echo "Business hours:    ${BUSINESS_HOURS:-24/7}"
echo "Time zone:         $TIMEZONE"
echo "Zendesk subdomain: ${ZENDESK_SUBDOMAIN:-(none)}"
echo "Company:           ${COMPANY:-(none)}"
echo "As-of:             $AS_OF"
echo "--------------------------------------"
echo ""

read -r -p "Run analysis? [Y/n]: " CONFIRM
CONFIRM="${CONFIRM:-Y}"

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

ARGS=(
  --zendesk-tickets "$ZENDESK_TICKETS_PATH"
  --zendesk-audits "$ZENDESK_AUDITS_PATH"
  --jira-issues "$JIRA_ISSUES_PATH"
  --jira-changelog "$JIRA_CHANGELOG_PATH"
  --resolution "$RESOLUTION"
  --timezone "$TIMEZONE"
  --as-of "$AS_OF"
)
[[ -n "$BUSINESS_HOURS" ]] && ARGS+=(--business-hours "$BUSINESS_HOURS")
[[ -n "$ZENDESK_SUBDOMAIN" ]] && ARGS+=(--zendesk-subdomain "$ZENDESK_SUBDOMAIN")
[[ -n "$COMPANY" ]] && ARGS+=(--company "$COMPANY")

echo ""
echo "Running Concierge analysis..."
echo ""

cd "$REPO_ROOT"

for FORMAT in html md json; do
  echo "→ Generating findings.$FORMAT"

  pnpm --silent --filter @sla/concierge analyze -- "${ARGS[@]}" --out "$DATA_DIR/findings.$FORMAT"

  echo "✓ findings.$FORMAT"
  echo ""
done

echo "======================================"
echo "Analysis complete"
echo "======================================"
echo ""
echo "Output:"
echo "  $DATA_DIR/findings.html"
echo "  $DATA_DIR/findings.md"
echo "  $DATA_DIR/findings.json"
echo ""
