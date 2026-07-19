#!/usr/bin/env node
/**
 * CostBench MCP Server (stdio)
 *
 * Verified software-pricing intelligence for AI agents: true costs, hidden
 * fees, negotiation data, price history, TCO, and LLM-cost estimates for
 * 3,290+ products — every fact sourced and dated. Read-only.
 *
 * This is a thin stdio client for the hosted CostBench MCP endpoint
 * (https://costbench.com/mcp, streamable HTTP). Tool discovery is answered
 * locally; tool calls are forwarded to the hosted service, which runs the
 * queries against the CostBench pricing database and returns sourced results.
 *
 * If your MCP client supports streamable HTTP transport, you can skip this
 * package entirely and connect directly to https://costbench.com/mcp.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const ENDPOINT = process.env.COSTBENCH_MCP_URL || 'https://costbench.com/mcp';
const SERVER_VERSION = '1.0.0';

// Tool definitions mirror the hosted server (https://costbench.com/mcp
// method tools/list) so discovery works offline. All tools are read-only.
const TOOLS = [
  {
    name: 'get_pricing',
    description:
      'Full sourced pricing record for a software product: tiers, hidden costs, contract terms, market data, sentiment, negotiation tips, TCO scenarios, price history — every claim with its sources + a confidence/verification envelope.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Product slug, e.g. "salesforce"' },
        depth: { type: 'string', enum: ['summary', 'full'], description: 'summary = numbers+sources only' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'get_hidden_costs',
    description:
      'The documented hidden/implementation/add-on costs of a product (uplifts, onboarding fees, overages), each with a sourced quote + date. The "what they don\'t tell you" answer.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
  },
  {
    name: 'get_negotiation_tips',
    description: 'Sourced negotiation tactics for a product with success-likelihood (how to get a discount).',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
  },
  {
    name: 'get_price_history',
    description: 'Per-quarter price snapshots + trend for a product — has its price changed?',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
  },
  {
    name: 'compare_software',
    description:
      'Side-by-side pricing comparison of 2–4 products (starting price, enterprise tier, median annual cost, free tier, ratings).',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: { slugs: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 } },
      required: ['slugs'],
    },
  },
  {
    name: 'discover_software',
    description:
      'Find software products by criteria (category, max price, free tier). Returns matching slugs to look up.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        maxPrice: { type: 'number' },
        hasFreeTier: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'calculate_tco',
    description:
      'Total cost of ownership for a product and team size: sourced line items (licenses with price escalation, benchmark implementation), year-one + multi-year totals, effective per-seat cost. The defensible "true cost for an N-person team" answer.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        seats: { type: 'number' },
        tier: { type: 'string' },
        termYears: { type: 'number' },
      },
      required: ['slug', 'seats'],
    },
  },
  {
    name: 'estimate_llm_cost',
    description:
      'Estimate the cost of an LLM/API workload (input + output tokens) for a usage-priced provider (OpenAI, Anthropic, AWS Bedrock…) from its real rate card.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        model: { type: 'string' },
        inputTokens: {
          type: 'number',
          description: 'Input tokens for the workload (e.g. per month). At least one of inputTokens/outputTokens must be > 0.',
        },
        outputTokens: {
          type: 'number',
          description: 'Output tokens for the workload. At least one of inputTokens/outputTokens must be > 0.',
        },
      },
      required: ['slug'],
    },
  },
];

async function forwardToolCall(name, args) {
  let resp;
  try {
    resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args || {} },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Could not reach the CostBench pricing service: ${err.message}` }],
    };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return {
      isError: true,
      content: [{ type: 'text', text: `Pricing service returned HTTP ${resp.status}: ${text.slice(0, 500)}` }],
    };
  }

  const body = await resp.json().catch(() => null);
  if (!body || (body.error == null && body.result == null)) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Pricing service returned an invalid response' }],
    };
  }
  if (body.error) {
    return {
      isError: true,
      content: [{ type: 'text', text: `${body.error.message}${body.error.data ? `: ${body.error.data}` : ''}` }],
    };
  }
  return body.result;
}

const server = new Server(
  { name: 'costbench', version: SERVER_VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (!TOOLS.some((t) => t.name === name)) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    };
  }
  return forwardToolCall(name, args);
});

const transport = new StdioServerTransport();
await server.connect(transport);
