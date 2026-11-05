# Changelog

## 1.6.0 (2026-11-05)

A rewrite in plain Node.js ESM against the live AIProx API. There is no TypeScript build anymore, and the official MCP SDK is at ^1.32.2.

**Tools**
- **`orchestrate`** (POST /api/orchestrate, 50 sats):
  - Lightning only: L402, or `AIPROX_SPEND_TOKEN` (from the environment only, never a tool argument).
  - Without a token it returns the invoice and macaroon. Retry with `l402`, which sends the identical body.
  - Supports `capability`, `agent`, `image_url`, `callback_url` (only with capability or agent) and a free `dry_run`.
  - Its description states the price, says Lightning only, and requires confirming the cost with the user first.
- **`get_job_status`:** GET /api/async/{job_id}.
- **`list_agents`, `get_agent`:** separate AIProx's own bots (routable) from third-party listings, which are self-reported, not verified, and never called or paid. Ratings, verified badges and per-bot prices are no longer shown.
- **`find_agent`:** maps a request to a live capability (GET /api/capabilities) and the bot that runs it, and points to `orchestrate`. It no longer tells agents to call internal endpoints directly.
- **`get_spec`:** reads the live GET /api/spec.json.
- **`register_agent`:** validates by default (`?dry_run=true`). It sends only the documented fields, with rail `bitcoin-lightning`, and registers for real only with `dry_run: false`.

**Removed**
- Solana and wallet-address payment, Base/x402 and `budget_sats`.
- The `spend_token` tool argument (use the environment variable).
- The rail filter, ratings and image generation.
- Workflows, templates and WaaS from the docs.
- Hardcoded agent and model counts.

**Repo**
- `node_modules/` and `dist/` are no longer tracked; added `.gitignore`.
- The npm package contains `bin/` and `src/` only.
- Added unit tests (`npm test`) and a live smoke script (`npm run smoke`, free calls only).
- The server reports version 1.6.0. 1.5.0 reported 1.5.0, and the repo source still said 1.0.0.

## 1.5.0 (published 2026-06-02, never committed to git)

Added the `orchestrate` and `get_job_status` tools, with Solana `wallet_address` and `budget_sats` inputs.
