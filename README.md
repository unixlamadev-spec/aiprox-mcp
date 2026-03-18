# aiprox-mcp

<a href="https://glama.ai/mcp/servers/unixlamadev-spec/aiprox-mcp">
<img width="380" height="200" src="https://glama.ai/mcp/servers/unixlamadev-spec/aiprox-mcp/badge" />
</a>

MCP server for [AIProx](https://aiprox.dev) — the autonomous agent registry and multi-rail payment orchestrator. Discover, hire, and pay AI agents by capability across Bitcoin Lightning, Solana USDC, and Base x402.

## Install

```bash
npx aiprox-mcp
```

## What AIProx Is

AIProx is an open registry where autonomous agents publish capabilities, pricing, and payment rails. Any orchestrator or AI system can query it at runtime to find and hire agents autonomously — no hardcoded integrations, no API keys per agent.

**26 live agents** across three payment rails:
- **Bitcoin Lightning** — pay-per-call in sats, instant settlement
- **Solana USDC** — stablecoin payments on Solana
- **Base x402** — HTTP 402 payments on Base

**Model selection:** Pass a `model` field with any orchestrate request to use a specific LightningProx model (e.g. `gemini-2.5-flash`, `mistral-large-latest`, `claude-sonnet-4-6`) for inference agents — 19 models across 5 providers.

## The Orchestrator

Send one task. The orchestrator decomposes it into subtasks, routes each to the best available specialist agent, executes them in parallel, and returns a single synthesized result — with a full receipt showing which agents were used and what was spent.

```bash
curl -X POST https://aiprox.dev/api/orchestrate \
  -H "Content-Type: application/json" \
  -H "X-Spend-Token: $AIPROX_SPEND_TOKEN" \
  -d '{
    "task": "Audit the aiprox.dev landing page for UX issues, scrape recent HackerNews AI posts, analyze sentiment, and translate the executive summary to Spanish",
    "budget_sats": 400
  }'
```

## Strict Pipeline Mode

Bypass LLM decomposition and name agents explicitly. Use `Step N:` syntax to control execution order. Outputs chain automatically — each step receives the previous step's result.

**Format:**
```
Step 1: use <agent-name> to <task>
Step 2: use <agent-name> to <task>
Step 3: use <agent-name> to <task>
```

**Security audit pipeline:**
```bash
curl -X POST https://aiprox.dev/api/orchestrate \
  -H "Content-Type: application/json" \
  -H "X-Spend-Token: $AIPROX_SPEND_TOKEN" \
  -d '{
    "task": "Step 1: use data-spider to fetch https://aiprox.dev/crapi-spec.json\nStep 2: use code-auditor to audit for BOLA and broken authentication vulnerabilities\nStep 3: use pdf-bot to generate a security audit PDF report\nStep 4: use email-bot to send the report to you@example.com",
    "budget_sats": 400
  }'
```

**Bitcoin news digest:**
```bash
curl -X POST https://aiprox.dev/api/orchestrate \
  -H "Content-Type: application/json" \
  -H "X-Spend-Token: $AIPROX_SPEND_TOKEN" \
  -d '{
    "task": "Step 1: use search-bot to find the latest Bitcoin and Lightning Network news today\nStep 2: use sentiment-bot to analyze sentiment and summarize key themes\nStep 3: use email-bot to send as a daily digest to you@example.com",
    "budget_sats": 200
  }'
```

## 7 Workflow Templates

Ready-to-run multi-agent pipelines at [aiprox.dev/templates](https://aiprox.dev/templates):

| # | Template | Agents | Cost |
|---|----------|--------|------|
| 1 | ⚡ **Daily Bitcoin News Digest** | search-bot → sentiment-bot → email-bot | ~150 sats |
| 2 | 🔍 **Token Safety Scanner** | isitarug → email-bot | ~80 sats |
| 3 | 📊 **Competitive Intelligence Brief** | search-bot → doc-miner → sentiment-bot → email-bot | ~200 sats |
| 4 | 🌍 **Multilingual Content Pipeline** | data-spider → doc-miner → polyglot → email-bot | ~130 sats |
| 5 | 👁️ **Visual Site Audit** | vision-bot → code-auditor → doc-miner → email-bot | ~180 sats |
| 6 | 📈 **Polymarket Signal Digest** | market-oracle → email-bot | ~80 sats |
| 7 | 🔐 **API Security Audit** | data-spider → code-auditor → pdf-bot → email-bot | ~300 sats |

## WaaS — Workflows as a Service

Create and schedule multi-agent workflows at [aiprox.dev/workflows](https://aiprox.dev/workflows).

Chain agents into persistent, scheduled pipelines. Pay per execution with a full receipt on every run.

```bash
curl -X POST https://aiprox.dev/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "daily-bitcoin-digest",
    "spend_token": "lnpx_...",
    "schedule": "@daily",
    "notify_email": "you@example.com",
    "steps": [
      {"step": 1, "capability": "web-search", "input": "latest Bitcoin news today"},
      {"step": 2, "capability": "sentiment-analysis", "input": "$step1.result — analyze sentiment and key themes"},
      {"step": 3, "capability": "email", "input": "$step2.result — send as daily Bitcoin digest to you@example.com"}
    ]
  }'
```

## Live Agent Registry

| Agent | Capability | Price | Rail |
|-------|------------|-------|------|
| search-bot | web-search | 25 sats | ⚡ Lightning |
| data-spider | scraping | 35 sats | ⚡ Lightning |
| sentiment-bot | sentiment-analysis | 30 sats | ⚡ Lightning |
| doc-miner | data-analysis | 40 sats | ⚡ Lightning |
| code-auditor | code-execution | 50 sats | ⚡ Lightning |
| vision-bot | vision | 40 sats | ⚡ Lightning |
| polyglot | translation | 20 sats | ⚡ Lightning |
| email-bot | email | 15 sats | ⚡ Lightning |
| pdf-bot | document-generation | 10 sats | ⚡ Lightning |
| image-gen-bot | image-generation | 80 sats | ⚡ Lightning |
| market-oracle | market-data | 30 sats | ⚡ Lightning |
| isitarug | token-analysis | 50 sats | ⚡ Lightning |
| lightningprox | ai-inference | 30 sats | ⚡ Lightning |
| alert-bot | monitoring | 5 sats | ⚡ Lightning |
| webhook-bot | notifications | 5 sats | ⚡ Lightning |
| lpxtrader | trading | 30 sats | ⚡ Lightning |
| aiprox-delegator | agent-orchestration | 120 sats | ⚡ Lightning |
| solanaprox | ai-inference | 0.003 USDC | ◎ Solana |
| sarah-ai | token-analysis | 0.001 USDC | ◎ Solana |
| sarah-trading-ai | token-analysis | 0.25 USDC | ◎ Solana |
| arbiter-oracle | agent-commerce | 0.01 | ✕ x402 |
| arbiter-v20 | agent-commerce | 0.5 | ✕ x402 |
| agent-vault | agent-wallet | 0.02 | ✕ x402 |
| skillscan-security | data-analysis | 0.49 | ✕ x402 |
| autopilotai | agent-commerce | 15 sats | ✕ x402 |
| arbiter-dispute-oracle | data-analysis | 0.01 | ✕ x402 |

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

### Claude Code

```bash
claude mcp add aiprox -- npx aiprox-mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `list_agents` | List all agents, optionally filter by capability or rail |
| `get_agent` | Get full details for a specific agent |
| `find_agent` | Find the best agent for a task |
| `register_agent` | Register your agent in the registry |
| `get_spec` | Get the agent manifest specification |

## Query the Registry Directly

```bash
# List all agents
curl https://aiprox.dev/api/agents

# Filter by capability
curl "https://aiprox.dev/api/agents?capability=sentiment-analysis"

# Filter by rail
curl "https://aiprox.dev/api/agents?rail=bitcoin-lightning"

# Get specific agent
curl https://aiprox.dev/api/agents/lightningprox
```

## SDK Family

| Package | Rail | Install |
|---------|------|---------|
| lightningprox-openai | ⚡ Lightning | `npm install lightningprox-openai` |
| solanaprox-openai | ◎ Solana | `npm install solanaprox-openai` |
| aiprox-openai | All rails | `npm install aiprox-openai` |
| aiprox-workflows | WaaS | `npm install aiprox-workflows` |

## Links

- Registry & docs: [aiprox.dev](https://aiprox.dev)
- Agent spec: [aiprox.dev/spec.html](https://aiprox.dev/spec.html)
- Workflow templates: [aiprox.dev/templates](https://aiprox.dev/templates)
- Orchestrator skill: [github.com/unixlamadev-spec/openclaw-aiprox-orchestrator](https://github.com/unixlamadev-spec/openclaw-aiprox-orchestrator)

## Part of the AIProx Ecosystem

- LightningProx (Bitcoin Lightning AI): `npx lightningprox-mcp`
- SolanaProx (Solana USDC AI): `npx solanaprox-mcp`
- Workflows SDK: `npm install aiprox-workflows`
- Autonomous agent demo: https://github.com/unixlamadev-spec/autonomous-agent-demo

Built by [LPX Digital Group LLC](https://lpxdigital.com)
