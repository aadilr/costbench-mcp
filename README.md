# CostBench MCP Server

Verified software-pricing intelligence for any MCP client — true costs, hidden fees, negotiation data, price history, side-by-side comparisons, and total cost of ownership for **3,290+ products**. Read-only, free, no API key, no signup.

Powered by [CostBench.com](https://costbench.com). Every figure the server returns carries its **source and date** — the data is only as trustworthy as its provenance, so CostBench publishes the provenance with each number. Responses include an `attribution` field and per-entity `links` back to the sourced page.

## Tools

| Tool | Description |
|------|-------------|
| `get_pricing` | Full sourced pricing record for a product: tiers, hidden costs, contract terms, market data, sentiment, negotiation tips, TCO scenarios, and price history — each claim with its sources. Args: `slug`, optional `depth` (`summary`\|`full`). |
| `get_hidden_costs` | The documented hidden / implementation / add-on costs (uplifts, onboarding fees, overages), each with a sourced quote + date. Args: `slug`. |
| `get_negotiation_tips` | Sourced negotiation tactics with success-likelihood. Args: `slug`. |
| `get_price_history` | Per-quarter price snapshots + trend — has the price changed? Args: `slug`. |
| `compare_software` | Side-by-side pricing for 2–4 products (starting price, median annual cost, free tier, ratings). Args: `slugs` (array). |
| `discover_software` | Find products by `category`, `maxPrice`, `hasFreeTier`. Returns matching slugs to look up. |
| `calculate_tco` | Total cost of ownership for a product and team size: sourced line items, year-one + multi-year totals, effective per-seat cost. Args: `slug`, `seats`, optional `tier`, `termYears`. |
| `estimate_llm_cost` | Cost of an LLM/API workload (input + output tokens) for a usage-priced provider, from its real rate card. Args: `slug`, `inputTokens`, `outputTokens`, optional `model`. |

All tools are **read-only** (`readOnlyHint: true`). Products are addressed by `slug` (e.g. `salesforce`, `microsoft-teams`, `openai-api`); use `discover_software` if you don't know one.

## Option 1 — Remote endpoint (recommended, no install)

The server is hosted at `https://costbench.com/mcp` using **streamable HTTP transport** (MCP spec 2025-03-26). If your client supports remote MCP servers, point it straight at the endpoint:

```json
{
  "mcpServers": {
    "costbench": {
      "type": "streamable-http",
      "url": "https://costbench.com/mcp"
    }
  }
}
```

Claude Code:

```bash
claude mcp add --transport http costbench https://costbench.com/mcp
```

## Option 2 — Local stdio server (this package)

For clients that only speak stdio, this package bridges stdio ↔ the hosted endpoint:

```json
{
  "mcpServers": {
    "costbench": {
      "command": "npx",
      "args": ["-y", "github:aadilr/costbench-mcp"]
    }
  }
}
```

Or clone and run directly:

```bash
git clone https://github.com/aadilr/costbench-mcp.git
cd costbench-mcp
npm install
node index.js
```

## Option 3 — Agent Skill / Claude Code plugin

This repo doubles as an Agent Skill and Claude Code plugin.

**Any skills-capable agent** (Claude Code, Codex CLI, Cursor, Gemini CLI, Copilot, and more):

```bash
npx skills add aadilr/costbench-mcp
```

**Claude Code plugin** (bundles the MCP server + the skill):

```
/plugin marketplace add aadilr/costbench-mcp
/plugin install costbench@costbench
```

The `software-pricing` skill prefers the MCP tools when connected and otherwise falls back to a bundled script (`skills/software-pricing/scripts/pricing.sh`) that talks to the hosted endpoint over plain HTTPS — no MCP client required.

## Option 4 — Docker

```bash
docker build -t costbench-mcp .
docker run -i --rm costbench-mcp
```

## Quick test

```bash
# List the tools
curl -X POST https://costbench.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Get pricing for a product
curl -X POST https://costbench.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_pricing","arguments":{"slug":"salesforce","depth":"summary"}}}'
```

The `get_pricing` call above returns a record like:

```json
{
  "slug": "salesforce",
  "name": "Salesforce",
  "category": { "slug": "crm", "name": "CRM" },
  "priceRange": { "low": 0, "median": 100, "high": 550, "currency": "USD" },
  "priceUnit": "user/month",
  "tiers": [
    { "name": "Starter Suite", "priceMonthly": 25, "priceAnnual": 300, "priceUnit": "user/month" },
    { "name": "Pro Suite", "priceMonthly": 100, "priceAnnual": 1200, "priceUnit": "user/month" }
  ],
  "attribution": "Source: CostBench (https://costbench.com) — verified, sourced software pricing intelligence."
}
```

## What's in the data

| | |
|---|---|
| Products | 3,290+ |
| Categories | 255 |
| Comparisons | 5,850+ |
| Coverage | Tiers, hidden costs, contract terms, negotiation data, price history, TCO, LLM rate cards |

Each field carries a `license` marker (`owned` \| `restricted`): CostBench's own sourced research is `owned`; a small number of third-party market-data medians are `restricted` — surfaceable to a user but not licensed for commercial redistribution.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `COSTBENCH_MCP_URL` | `https://costbench.com/mcp` | Override the upstream endpoint |

## Privacy & limits

- No authentication or account required. All tools are read-only — the server never writes anything.
- Per-IP rate limiting: 60 requests/minute.
- Data is sourced and dated; cite the `links.page` URL a response returns, not the bare number.

## License

MIT
