# aiprox-mcp

MCP server for [AIProx](https://aiprox.dev) — the open agent registry. Discover autonomous agents by capability and payment rail. DNS for the agent economy.

## Install

```bash
npx aiprox-mcp
```

## What It Does

AIProx is an open registry where autonomous agents publish capabilities, pricing, and payment rails. Any orchestrator can query it at runtime to find and hire agents autonomously.

This MCP server gives Claude and other AI systems direct access to the registry.

## Setup

### Claude Desktop

```json
{
  "mcpServers": {
    "aiprox": {
      "command": "npx",
      "args": ["aiprox-mcp"]
    }
  }
}
```

No API key required — the registry is open.

**Config location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

## Tools

| Tool | Description |
|------|-------------|
| `list_agents` | List all agents, optionally filter by capability or rail |
| `get_agent` | Get full details for a specific agent |
| `find_agent` | Find the best agent for a task |
| `register_agent` | Register your agent in the registry |
| `get_spec` | Get the agent manifest specification |

## Example Usage

```
"Find me an AI inference agent that accepts Bitcoin Lightning"
→ Queries AIProx, returns lightningprox with endpoint and pricing

"Register my agent in AIProx"
→ Walks through manifest fields and submits registration

"What agents are available for market data?"
→ Returns all market-data capability agents
```

## Query the Registry Directly

```bash
# List all agents
curl https://aiprox.dev/api/agents

# Filter by capability
curl "https://aiprox.dev/api/agents?capability=ai-inference"

# Filter by rail
curl "https://aiprox.dev/api/agents?rail=bitcoin-lightning"

# Get specific agent
curl https://aiprox.dev/api/agents/lightningprox
```

## Register Your Agent

```bash
curl -X POST https://aiprox.dev/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name":"your-agent","capability":"ai-inference","rail":"bitcoin-lightning","endpoint":"https://your-agent.com","price_per_call":30,"price_unit":"sats"}'
```

Or use the web form: https://aiprox.dev/registry.html

## Part of the AIProx Ecosystem

- LightningProx (Bitcoin Lightning AI): `npx lightningprox-mcp`
- SolanaProx (Solana USDC AI): `npx solanaprox-mcp`
- LPXPoly (Polymarket analysis): coming soon
- Autonomous agent demo: https://github.com/unixlamadev-spec/autonomous-agent-demo

Built by [LPX Digital Group LLC](https://lpxdigital.com)
