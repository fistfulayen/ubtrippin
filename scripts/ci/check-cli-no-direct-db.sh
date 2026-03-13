#!/usr/bin/env bash
# CI check: CLI must not call Supabase REST directly for user-facing operations.
# Only admin commands (tables, profiles) are exempt.
#
# Why: On 2026-03-13, direct DB calls in the CLI caused split-brain behavior —
# different sort order, pagination, and RLS rules from the API. All user-facing
# reads must go through /api/v1/ to stay in sync with MCP and the web app.

set -euo pipefail

CLI_FILE="cli/ubt"

if [ ! -f "$CLI_FILE" ]; then
  echo "⚠️  cli/ubt not found, skipping check"
  exit 0
fi

# Find _curl calls to ${API}/ (direct Supabase REST)
# Exempt: rpc/get_tables, profiles (admin-only commands)
VIOLATIONS=$(grep -n '_curl.*\${API}/' "$CLI_FILE" \
  | grep -v 'rpc/get_tables' \
  | grep -v '/profiles' \
  | grep -v '^#' \
  || true)

if [ -n "$VIOLATIONS" ]; then
  echo "❌ CLI has direct Supabase REST calls on user-facing paths:"
  echo ""
  echo "$VIOLATIONS"
  echo ""
  echo "All user-facing CLI commands must use _api() with \${API_V1}/ (the product API)."
  echo "Direct Supabase access is only allowed for admin commands (tables, profiles)."
  echo ""
  echo "See: 2026-03-13 incident — direct DB calls caused split-brain sort/pagination."
  exit 1
fi

echo "✅ CLI routes all user-facing reads through /api/v1/"
