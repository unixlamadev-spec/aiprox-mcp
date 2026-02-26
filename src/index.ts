#!/usr/bin/env node
/**
 * AIProx MCP Server
 * Query the open agent registry — discover autonomous agents by capability and payment rail
 * DNS for the agent economy
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const AIPROX_URL = process.env.AIPROX_URL || "https://aiprox.dev";

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const tools: Tool[] = [
  {
    name: "list_agents",
    description:
      "List all active agents in the AIProx registry. Optionally filter by capability or payment rail. Returns agent names, capabilities, pricing, endpoints, and payment rails.",
    inputSchema: {
      type: "object",
      properties: {
        capability: {
          type: "string",
          description:
            "Filter by capability (e.g. ai-inference, market-data, image-generation, web-search)",
        },
        rail: {
          type: "string",
          description:
            "Filter by payment rail (e.g. bitcoin-lightning, solana-usdc)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_agent",
    description:
      "Get full details for a specific agent in the AIProx registry by name. Returns endpoint, pricing, payment rail, capabilities, and models.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Agent name (e.g. lightningprox, solanaprox, lpxpoly)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "find_agent",
    description:
      "Find the best agent for a specific task. Describe what you need and AIProx will return the most suitable registered agent with its endpoint and pricing.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description:
            "What you need (e.g. 'AI inference paid with Bitcoin', 'Polymarket analysis', 'image generation')",
        },
        preferred_rail: {
          type: "string",
          description:
            "Preferred payment rail (bitcoin-lightning or solana-usdc). Optional.",
        },
      },
      required: ["task"],
    },
  },
  {
    name: "register_agent",
    description:
      "Register a new agent in the AIProx registry. Free to register. New registrations are pending until verified by the AIProx team.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Unique agent identifier (lowercase, no spaces)",
        },
        description: {
          type: "string",
          description: "What your agent does",
        },
        capability: {
          type: "string",
          description:
            "Primary capability (ai-inference, market-data, image-generation, web-search, etc.)",
        },
        rail: {
          type: "string",
          description: "Payment rail (bitcoin-lightning or solana-usdc)",
        },
        endpoint: {
          type: "string",
          description: "Your agent's API endpoint URL",
        },
        price_per_call: {
          type: "number",
          description: "Price per API call",
        },
        price_unit: {
          type: "string",
          description: "Price unit (sats, usd-cents, etc.)",
        },
        payment_address: {
          type: "string",
          description:
            "Your Lightning address or Solana wallet for receiving payments",
        },
        models: {
          type: "array",
          items: { type: "string" },
          description: "List of models your agent supports (optional)",
        },
      },
      required: [
        "name",
        "capability",
        "rail",
        "endpoint",
        "price_per_call",
        "price_unit",
      ],
    },
  },
  {
    name: "get_spec",
    description:
      "Get the AIProx agent manifest specification. Returns the full spec for registering agents including all required and optional fields.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ============================================================================
// API HELPERS
// ============================================================================

async function listAgents(capability?: string, rail?: string): Promise<any[]> {
  let url = `${AIPROX_URL}/api/agents`;
  const params = new URLSearchParams();
  if (capability) params.append("capability", capability);
  if (rail) params.append("rail", rail);
  if (params.toString()) url += `?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch agents: ${res.statusText}`);
  const data = await res.json() as any;
  return data.agents || data || [];
}

async function getAgent(name: string): Promise<any> {
  const res = await fetch(`${AIPROX_URL}/api/agents/${name}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Agent '${name}' not found in registry`);
    throw new Error(`Failed to fetch agent: ${res.statusText}`);
  }
  return res.json();
}

async function registerAgent(manifest: any): Promise<any> {
  const res = await fetch(`${AIPROX_URL}/api/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(manifest),
  });
  if (!res.ok) {
    const err = await res.json() as any;
    throw new Error(err.error || `Registration failed: ${res.statusText}`);
  }
  return res.json();
}

function formatAgent(agent: any): string {
  return [
    `Name: ${agent.name}`,
    `Description: ${agent.description || "—"}`,
    `Capability: ${agent.capability}`,
    `Rail: ${agent.rail}`,
    `Price: ${agent.price_per_call} ${agent.price_unit}/call`,
    `Endpoint: ${agent.endpoint}`,
    agent.payment_address ? `Payment Address: ${agent.payment_address}` : null,
    agent.models?.length ? `Models: ${agent.models.join(", ")}` : null,
    `Status: ${agent.verified ? "✓ Verified" : "Pending verification"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ============================================================================
// MCP SERVER
// ============================================================================

const server = new Server(
  { name: "aiprox", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_agents": {
        const { capability, rail } = args as any;
        const agents = await listAgents(capability, rail);

        if (!agents.length) {
          return {
            content: [
              {
                type: "text",
                text: `No agents found${capability ? ` with capability: ${capability}` : ""}${rail ? ` on rail: ${rail}` : ""}.\n\nRegister yours at ${AIPROX_URL}/registry.html`,
              },
            ],
          };
        }

        const list = agents
          .map(
            (a: any) =>
              `• ${a.name} — ${a.capability} | ${a.price_per_call} ${a.price_unit}/call | ${a.rail} | ${a.verified ? "✓" : "pending"}`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `🤖 AIProx Registry — ${agents.length} agent${agents.length !== 1 ? "s" : ""} found\n\n${list}\n\nQuery: ${AIPROX_URL}/api/agents`,
            },
          ],
        };
      }

      case "get_agent": {
        const { name: agentName } = args as any;
        const agent = await getAgent(agentName);

        return {
          content: [
            {
              type: "text",
              text: `🤖 Agent: ${agentName}\n\n${formatAgent(agent)}\n\nAPI: curl ${AIPROX_URL}/api/agents/${agentName}`,
            },
          ],
        };
      }

      case "find_agent": {
        const { task, preferred_rail } = args as any;

        // Search by capability keywords
        const capabilityMap: Record<string, string> = {
          "ai inference": "ai-inference",
          "language model": "ai-inference",
          "claude": "ai-inference",
          "gpt": "ai-inference",
          "polymarket": "market-data",
          "prediction market": "market-data",
          "market analysis": "market-data",
          "image": "image-generation",
          "web search": "web-search",
        };

        let capability: string | undefined;
        const taskLower = task.toLowerCase();
        for (const [keyword, cap] of Object.entries(capabilityMap)) {
          if (taskLower.includes(keyword)) {
            capability = cap;
            break;
          }
        }

        const agents = await listAgents(capability, preferred_rail);

        if (!agents.length) {
          return {
            content: [
              {
                type: "text",
                text: `No agents found for: "${task}"\n\nBrowse the full registry: ${AIPROX_URL}/registry.html`,
              },
            ],
          };
        }

        const best = agents[0];
        return {
          content: [
            {
              type: "text",
              text: [
                `🤖 Best match for: "${task}"`,
                ``,
                formatAgent(best),
                ``,
                `To invoke this agent, call its endpoint directly:`,
                `${best.endpoint}`,
              ].join("\n"),
            },
          ],
        };
      }

      case "register_agent": {
        const manifest = args as any;
        const result = await registerAgent(manifest);

        return {
          content: [
            {
              type: "text",
              text: [
                `✅ Agent registered!`,
                `Status: ${result.status}`,
                ``,
                `Your agent is pending verification by the AIProx team.`,
                `Once verified, it will be discoverable at:`,
                `${AIPROX_URL}/api/agents/${manifest.name}`,
                ``,
                `Registry: ${AIPROX_URL}/registry.html`,
              ].join("\n"),
            },
          ],
        };
      }

      case "get_spec": {
        return {
          content: [
            {
              type: "text",
              text: [
                `📋 AIProx Agent Manifest Specification`,
                ``,
                `Required fields:`,
                `  name          — unique identifier (lowercase, no spaces)`,
                `  capability    — what the agent does (ai-inference, market-data, etc.)`,
                `  rail          — payment method (bitcoin-lightning, solana-usdc)`,
                `  endpoint      — your agent's API URL`,
                `  price_per_call — cost per request`,
                `  price_unit    — sats, usd-cents, etc.`,
                ``,
                `Optional fields:`,
                `  description   — human-readable description`,
                `  payment_address — Lightning address or Solana wallet`,
                `  models        — list of supported models`,
                ``,
                `Registration endpoint:`,
                `POST ${AIPROX_URL}/api/agents/register`,
                ``,
                `Full spec: ${AIPROX_URL}/spec.html`,
                `Web form: ${AIPROX_URL}/registry.html`,
              ].join("\n"),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `❌ Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ============================================================================
// START
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`✅ AIProx MCP Server running | Registry: ${AIPROX_URL}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
