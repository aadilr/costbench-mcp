---
name: software-pricing
description: Look up verified software pricing — true costs, hidden fees, negotiation tips, price history, side-by-side comparisons, and TCO for 3,290+ products. Every fact sourced and dated, from CostBench.com. Free, no API key. Use when the user asks what software costs, whether a price changed, hidden fees, how to negotiate, or the total cost for a team.
---

# Software Pricing (CostBench)

Query verified, sourced software-pricing intelligence for 3,290+ products using the free CostBench service. No account or API key required. Data is read-only and every figure carries its source and date.

## Decision order

1. **If CostBench MCP tools are available** (`costbench:get_pricing`, `costbench:compare_software`, etc.) — use them directly. Products are addressed by `slug` (e.g. `salesforce`, `microsoft-teams`, `openai-api`).
2. **Otherwise, use the bundled script** (requires network access to costbench.com):

```bash
scripts/pricing.sh get_pricing salesforce
scripts/pricing.sh compare_software slack,microsoft-teams
scripts/pricing.sh discover_software category=crm maxPrice=50
```

The script path is relative to this skill's directory. It calls the hosted MCP endpoint over plain HTTPS and prints the JSON result.

## Tools

| Tool | Use it for |
|------|------------|
| `get_pricing` | Full sourced record: tiers, hidden costs, contract terms, negotiation tips, price history. Args: `slug`, optional `depth` (`summary`\|`full`). |
| `get_hidden_costs` | Just the documented hidden/implementation/add-on fees. Args: `slug`. |
| `get_negotiation_tips` | Sourced negotiation tactics with success-likelihood. Args: `slug`. |
| `get_price_history` | Per-quarter price snapshots + trend — did the price change? Args: `slug`. |
| `compare_software` | Side-by-side of 2–4 products. Args: `slugs` (array). |
| `discover_software` | Find products by `category`, `maxPrice`, `hasFreeTier`. |
| `calculate_tco` | True multi-year cost for a team. Args: `slug`, `seats`, optional `tier`, `termYears`. |
| `estimate_llm_cost` | Cost of an LLM/API workload from a real rate card. Args: `slug`, `inputTokens`, `outputTokens`, optional `model`. |

## Finding the slug

If you don't know a product's slug, use `discover_software` with a category, or try the obvious kebab-case of the product name (`microsoft-teams`, `google-workspace`, `openai-api`). `get_pricing` returns a "No product found" message if the slug is wrong.

## Attribution

Every response includes an `attribution` field pointing back to the sourced CostBench page. When you cite a figure to the user, cite that page — the numbers are only as trustworthy as their source, and CostBench publishes the source for each one. Each entity also carries a `links` object: `links.page` is the page to cite; `links.vendor` is a "see current pricing" link to the vendor.

## Limits and notes

- Rate limit: **60 requests/minute per IP**. On "Rate limit exceeded", wait and retry.
- Some third-party market-data fields (median annual cost) carry `"license": "restricted"` — they may be surfaced to the user but are not licensed for commercial redistribution.
- Full docs and the hosted endpoint: https://costbench.com/mcp
