#!/usr/bin/env bash
#
# check-docs-coverage.sh — Ensure API routes, CLI commands, and MCP tools
# are documented in /api/v1/docs (the live docs endpoint).
#
# Runs in CI on PRs that touch API routes, CLI, MCP, or the docs route itself.
# Exits non-zero if new endpoints/commands appear to be undocumented.
#
set -euo pipefail

DOCS_ROUTE="src/app/api/v1/docs/route.ts"
CLI_FILE="cli/ubt"
FAIL=0

echo "=== Docs Coverage Check ==="

# 1. Check API routes are mentioned in the docs
echo ""
echo "--- API endpoint coverage in $DOCS_ROUTE ---"
MISSING_API=""
while IFS= read -r file; do
  api_path=$(echo "$file" | sed 's|src/app/api/v1/||' | sed 's|/route\.ts$||' | sed -E 's/\[([^]]+)\]/:\1/g')
  api_path="/api/v1/$api_path"

  methods=$(grep -oP 'export async function (GET|POST|PUT|PATCH|DELETE)' "$file" 2>/dev/null | awk '{print $4}' | sort | tr '\n' ',' | sed 's/,$//')
  [ -z "$methods" ] && continue

  # Match by the last concrete path segment (e.g. "weather", "collaborators", "items")
  # This handles parameterized paths like /trips/:id/items correctly
  last_segment=$(echo "$api_path" | sed 's|/:[^/]*||g' | awk -F/ '{print $NF}')

  if [ -n "$last_segment" ] && ! grep -q "$last_segment" "$DOCS_ROUTE" 2>/dev/null; then
    MISSING_API="$MISSING_API\n  ❌ $methods $api_path"
  fi
done < <(find src/app/api/v1 -name 'route.ts' | sort)

if [ -n "$MISSING_API" ]; then
  echo -e "Missing from docs:$MISSING_API"
  echo ""
  echo "⚠️  Add these endpoints to $DOCS_ROUTE"
  # Warning only — don't fail for missing API docs (some internal routes are intentionally undocumented)
else
  echo "✅ All API endpoints found in docs"
fi

# 2. Check CLI commands are mentioned in docs
echo ""
echo "--- CLI command coverage in $DOCS_ROUTE ---"
MISSING_CLI=""
# Extract top-level CLI commands from the help output
CLI_COMMANDS=$(grep -oP '^\s+(trips|items|tickets|guides|trains|billing|activation|calendar|image|senders|webhooks|collab|family|notifications|profile)\b' "$CLI_FILE" 2>/dev/null | awk '{print $1}' | sort -u)

for cmd in $CLI_COMMANDS; do
  if ! grep -q "ubt $cmd" "$DOCS_ROUTE" 2>/dev/null; then
    MISSING_CLI="$MISSING_CLI\n  ❌ ubt $cmd"
  fi
done

if [ -n "$MISSING_CLI" ]; then
  echo -e "Missing from docs:$MISSING_CLI"
  echo ""
  echo "⚠️  Add these CLI commands to the CLI Reference section in $DOCS_ROUTE"
  FAIL=1
else
  echo "✅ All CLI command groups found in docs"
fi

# 3. Check MCP tools are mentioned in docs
echo ""
echo "--- MCP tool coverage in $DOCS_ROUTE ---"
MISSING_MCP=""
if [ -d "mcp/src" ]; then
  # Extract tool names from MCP source
  MCP_TOOLS=$(grep -rhoP 'name:\s*["'"'"']([a-z_]+)["'"'"']' mcp/src/ 2>/dev/null | sed -E "s/name:\s*[\"']([^\"']+)[\"']/\1/" | sort -u)
  
  for tool in $MCP_TOOLS; do
    # Convert snake_case to likely API path segment
    search_term=$(echo "$tool" | sed 's/_/ /g' | awk '{print $NF}')
    if ! grep -qi "$search_term" "$DOCS_ROUTE" 2>/dev/null; then
      MISSING_MCP="$MISSING_MCP\n  ⚠️  MCP tool: $tool"
    fi
  done
fi

if [ -n "$MISSING_MCP" ]; then
  echo -e "Possibly missing from docs:$MISSING_MCP"
  echo "(MCP check is best-effort — verify manually)"
else
  echo "✅ MCP tools appear covered in docs"
fi

echo ""
if [ "$FAIL" -ne 0 ]; then
  echo "❌ Docs coverage check failed. Update $DOCS_ROUTE before merging."
  exit 1
fi

echo "✅ Docs coverage check passed."
