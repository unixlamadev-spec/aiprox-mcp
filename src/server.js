// AIProx MCP server over stdio. Configuration from the environment:
// AIPROX_SPEND_TOKEN (optional LightningProx spend token) and AIPROX_URL.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createClient, DEFAULT_URL, VERSION } from "./client.js";
import { callTool, toolDefinitions } from "./tools.js";

export { VERSION };

export function createServer({ env = process.env, fetchImpl } = {}) {
  const token = (env.AIPROX_SPEND_TOKEN || "").trim() || undefined;
  const client = createClient({ baseUrl: env.AIPROX_URL || DEFAULT_URL, token, fetchImpl });
  const server = new Server({ name: "aiprox", version: VERSION }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => callTool(client, req.params.name, req.params.arguments || {}));
  return { server, client };
}

export async function main() {
  const { server, client } = createServer();
  await server.connect(new StdioServerTransport());
  // stdout is the MCP channel; diagnostics go to stderr. Never log the token.
  console.error(`aiprox-mcp ${VERSION} ready on stdio (${client.base}; spend token ${client.hasToken ? "configured" : "not set"})`);
}
