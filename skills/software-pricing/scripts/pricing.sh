#!/usr/bin/env bash
# Query verified software pricing via the free CostBench MCP endpoint (no API key).
#
# Usage:
#   pricing.sh <tool> <arg>
#   pricing.sh get_pricing salesforce
#   pricing.sh get_pricing salesforce depth=full
#   pricing.sh compare_software slack,microsoft-teams
#   pricing.sh discover_software category=crm maxPrice=50
#   pricing.sh calculate_tco salesforce seats=25
#
# Prints the tool's JSON result. Non-zero exit + stderr on failure.
set -euo pipefail

ENDPOINT="${COSTBENCH_MCP_URL:-https://costbench.com/mcp}"

TOOL="${1:-}"
if [ -z "$TOOL" ]; then
  echo "usage: pricing.sh <tool> <args...>  (tools: get_pricing get_hidden_costs get_negotiation_tips get_price_history compare_software discover_software calculate_tco estimate_llm_cost)" >&2
  exit 2
fi
shift

# Build the arguments object from the remaining args.
# - a bare token with no '=' becomes {"slug": token} (or {"slugs": [..]} for compare_software)
# - key=value tokens are typed: numbers stay numeric, true/false stay boolean, else string
ARGS="{}"
python_build() {
  python3 - "$TOOL" "$@" <<'PY'
import json, sys
tool = sys.argv[1]
toks = sys.argv[2:]
args = {}
for t in toks:
    if "=" in t:
        k, v = t.split("=", 1)
        if v in ("true", "false"):
            args[k] = (v == "true")
        else:
            try:
                args[k] = int(v)
            except ValueError:
                try:
                    args[k] = float(v)
                except ValueError:
                    args[k] = v
    else:
        if tool == "compare_software":
            args["slugs"] = [s for s in t.split(",") if s]
        else:
            args["slug"] = t
print(json.dumps(args))
PY
}
ARGS=$(python_build "$@")

REQ=$(python3 - "$TOOL" "$ARGS" <<'PY'
import json, sys
print(json.dumps({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":sys.argv[1],"arguments":json.loads(sys.argv[2])}}))
PY
)

RESP=$(mktemp); trap 'rm -f "$RESP"' EXIT
HTTP_CODE=$(curl -sS --max-time 60 -o "$RESP" -w "%{http_code}" \
  -X POST "$ENDPOINT" -H "Content-Type: application/json" --data-binary "$REQ")

if [ "$HTTP_CODE" != "200" ]; then
  echo "error: pricing service returned HTTP $HTTP_CODE: $(head -c 300 "$RESP")" >&2
  exit 4
fi

# Extract and pretty-print the tool result text (JSON string inside content[0].text).
python3 - "$RESP" <<'PY'
import json, sys
body = json.load(open(sys.argv[1]))
if body.get("error"):
    sys.stderr.write("error: %s\n" % body["error"].get("message", body["error"]))
    sys.exit(5)
res = body.get("result", {})
content = res.get("content", [])
text = content[0]["text"] if content else json.dumps(res)
try:
    print(json.dumps(json.loads(text), indent=2))
except Exception:
    print(text)
PY
