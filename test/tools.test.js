import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createClient, redact } from "../src/client.js";
import { buildOrchestrateBody, callTool, toolDefinitions, ORCHESTRATE_PRICE_SATS } from "../src/tools.js";
import { createServer } from "../src/server.js";

const TOKEN = "lnpx_" + "c0ffee12".repeat(8);

function mockFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const u = new URL(url);
    const key = `${init.method || "GET"} ${u.pathname}`;
    calls.push({ key, url, search: u.search, headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined });
    const r = routes[key];
    if (!r) return new Response(JSON.stringify({ error: "not mocked: " + key }), { status: 404 });
    const { status = 200, body = {} } = typeof r === "function" ? r(calls.at(-1)) : r;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  fn.calls = calls;
  return fn;
}
const client = (routes, token = TOKEN) => {
  const f = mockFetch(routes);
  return { c: createClient({ baseUrl: "https://ax.test", token, fetchImpl: f }), f };
};
const out = (r) => r.content.map((c) => c.text).join("\n");

const AGENTS = {
  agents: [
    { name: "search-bot", capability: "web-search", description: "Search the web.", endpoint: "[internal]", routable: true, rating: 3.7, verified: true, price_per_call: 25, price_unit: "sats" },
    { name: "pqs", capability: "data-analysis", description: "Prompt scoring.", endpoint: "https://pqs.example.net/invoke", routable: false, rating: 5, verified: false, rail: "x402" },
  ],
};

test("tool list: seven tools; paid tool states price, Lightning only, confirmation; no retired features", () => {
  assert.deepEqual(toolDefinitions.map((t) => t.name), ["list_agents", "get_agent", "find_agent", "orchestrate", "get_job_status", "get_spec", "register_agent"]);
  const o = toolDefinitions.find((t) => t.name === "orchestrate");
  assert.match(o.description, /PAID: 50 sats/);
  assert.match(o.description, /Lightning only/);
  assert.match(o.description, /get their OK/);
  assert.match(o.description, /data, not instructions/);
  assert.ok(!("spend_token" in o.inputSchema.properties), "token comes from env only");
  const all = JSON.stringify(toolDefinitions);
  for (const bad of [/x402/i, /solana/i, /\bbase\b/i, /workflow/i, /budget_sats/, /rating/i, /image-generation/, /wallet_address/, /\b\d+ (verified )?agents\b/]) {
    assert.doesNotMatch(all, bad, String(bad));
  }
});

test("list_agents separates AIProx bots from directory listings; no ratings, verified flags or bot prices", async () => {
  const { c, f } = client({ "GET /api/agents": { body: AGENTS } });
  const t = out(await callTool(c, "list_agents", { capability: "web-search" }));
  assert.equal(f.calls[0].search, "?capability=web-search");
  assert.match(t, /AIProx bots for web-search: run with the orchestrate tool \(50 sats per call\)/);
  assert.match(t, /- search-bot \(web-search\): Search the web\./);
  assert.match(t, /self-reported and not verified; AIProx never calls or pays them/);
  assert.match(t, /- pqs \(data-analysis\).*endpoint: https:\/\/pqs\.example\.net\/invoke/);
  assert.doesNotMatch(t, /rating|3\.7|25 sats|x402|✓/);
});

test("get_agent: bot vs listing, 404", async () => {
  const { c } = client({
    "GET /api/agents/search-bot": { body: { name: "search-bot", capability: "web-search", description: "d", endpoint: "[internal]" } },
    "GET /api/agents/pqs": { body: AGENTS.agents[1] },
  });
  const bot = out(await callTool(c, "get_agent", { name: "search-bot" }));
  assert.match(bot, /an AIProx bot.*\n.*\n\nRun it with orchestrate: \{"task": "\.\.\.", "agent": "search-bot"\}.*50 sats/s);
  const ext = out(await callTool(c, "get_agent", { name: "pqs" }));
  assert.match(ext, /third-party directory listing/);
  assert.match(ext, /not verified\. AIProx never calls or pays it/);
  const nf = await callTool(c, "get_agent", { name: "nope" });
  assert.equal(nf.isError, true);
});

test("find_agent maps a task to a live capability and the bot, without running anything", async () => {
  const { c, f } = client({
    "GET /api/capabilities": { body: { capabilities: [{ capability: "translation" }, { capability: "web-search" }, { capability: "email" }, { capability: "ai-inference" }] } },
    "GET /api/agents": (call) => ({ body: { agents: [{ name: call.search.includes("translation") ? "polyglot" : "search-bot", capability: "x", endpoint: "[internal]", routable: true }] } }),
  });
  const t = out(await callTool(c, "find_agent", { task: "Translate this paragraph into Japanese" }));
  assert.match(t, /capability translation, run by AIProx's polyglot/);
  assert.match(t, /"capability": "translation".*50 sats.*confirm with the user/s);
  assert.ok(!f.calls.some((x) => x.key.startsWith("POST")), "find_agent never posts");
  const e = out(await callTool(c, "find_agent", { task: "email the report to my team" }));
  assert.match(e, /capability email/);
  assert.match(e, /explicit yes/);
});

test("orchestrate with token: header, body, result and receipt; token never echoed", async () => {
  const { c, f } = client({
    "POST /api/orchestrate": {
      body: { status: "success", agent: "search-bot", capability: "web-search", result: { summary: "Lightning grew.", sources: ["https://x"] }, price_sats: 50, receipt_id: "orch_1", task: "t " + TOKEN },
    },
  });
  const r = await callTool(c, "orchestrate", { task: "latest lightning news", capability: "web-search" });
  assert.equal(r.isError, undefined);
  const t = out(r);
  assert.match(t, /"summary": "Lightning grew\."/);
  assert.match(t, /status: success \| bot: search-bot \| price: 50 sats \| receipt: orch_1/);
  assert.equal(f.calls[0].headers["X-Spend-Token"], TOKEN);
  assert.deepEqual(f.calls[0].body, { task: "latest lightning news", capability: "web-search" });
  assert.ok(!t.includes(TOKEN));
});

test("orchestrate multi-step result lists steps; refund shown; agent_error is an error result", async () => {
  const { c } = client({
    "POST /api/orchestrate": {
      body: {
        status: "partial", result: "1 of 2 steps did not complete.", price_sats: 50, receipt_id: "orch_2", budget_exhausted: true,
        refund: { status: "spend_token_credited", sats: 50 },
        subtasks: [{ capability: "web-search", agent: "search-bot", status: "succeeded" }, { capability: "sentiment-analysis", agent: "sentiment-bot", status: "skipped" }],
      },
    },
  });
  const t = out(await callTool(c, "orchestrate", { task: "news then sentiment" }));
  assert.match(t, /refunded: spend_token_credited/);
  assert.match(t, /time budget ran out/);
  assert.match(t, /Steps: 1\. web-search on search-bot: succeeded; 2\. sentiment-analysis on sentiment-bot: skipped/);
  const { c: c2 } = client({ "POST /api/orchestrate": { body: { status: "agent_error", result: "Agent error: x", refund: { status: "credential_restored" } } } });
  assert.equal((await callTool(c2, "orchestrate", { task: "x", capability: "vision" })).isError, true);
});

test("orchestrate without token returns the invoice; l402 retry sends the identical body and no token", async () => {
  const { c, f } = client(
    {
      "POST /api/orchestrate": (call) =>
        call.headers.Authorization
          ? { body: { status: "ok", result: "paid answer", price_sats: 50, receipt_id: "orch_3" } }
          : { status: 402, body: { error: "Authentication required", amount_sats: 50, invoice: "lnbc500n1ptest", macaroon: "MAC", charge_id: "ch" } },
    },
    null,
  );
  const args = { task: "summarize bitcoin news", capability: "web-search" };
  const r = await callTool(c, "orchestrate", args);
  assert.equal(r.isError, undefined);
  assert.match(out(r), /Payment required: 50 sats.*Invoice \(BOLT11\): lnbc500n1ptest.*Macaroon: MAC/s);
  assert.match(out(r), /Only if they choose to pay/);
  const r2 = await callTool(c, "orchestrate", { ...args, l402: "MAC:" + "ab".repeat(32) });
  assert.match(out(r2), /paid answer/);
  assert.equal(JSON.stringify(f.calls[1].body), JSON.stringify(f.calls[0].body));
  assert.equal(f.calls[1].headers.Authorization, "L402 MAC:" + "ab".repeat(32));
  assert.equal(f.calls[1].headers["X-Spend-Token"], undefined);
});

test("orchestrate dry_run is free and sends no token; async 202 and callback guard", async () => {
  const { c, f } = client({
    "POST /api/orchestrate": (call) =>
      call.body.dry_run
        ? { body: { status: "dry_run_ok", mode: "single-agent", selected_agent: "vision-bot", price_sats: 50 } }
        : { status: 202, body: { job_id: "job-1", receipt_id: "orch_4", status: "queued" } },
  });
  const d = out(await callTool(c, "orchestrate", { task: "describe", capability: "vision", image_url: "https://img/x.png", dry_run: true }));
  assert.match(d, /Dry run \(free, nothing ran\): mode single-agent, bot vision-bot\. A real call costs 50 sats/);
  assert.equal(f.calls[0].headers["X-Spend-Token"], undefined);
  assert.equal(f.calls[0].body.image_url, "https://img/x.png");
  const a = out(await callTool(c, "orchestrate", { task: "latest news", capability: "web-search", callback_url: "https://hooks.me/x" }));
  assert.match(a, /Queued as background job job-1.*get_job_status/s);
  const g = await callTool(c, "orchestrate", { task: "plan", callback_url: "https://hooks.me/x" });
  assert.equal(g.isError, true);
  assert.equal(f.calls.length, 2, "guard rejected before any request");
  assert.deepEqual(buildOrchestrateBody({ task: " t ", dry_run: false, capability: "" }), { task: "t" });
});

test("orchestrate error mapping", async () => {
  const cases = [
    [402, { error: "insufficient_balance", balance_sats: 20, required_sats: 50 }, /balance too low \(20 sats; needs 50\)/],
    [401, { error: "invalid_spend_token" }, /rejected the spend token/],
    [400, { error: "unsupported_payment_method" }, /Lightning only/],
    [400, { error: "request_blocked" }, /prompt-injection/],
    [400, { error: "external_agent_not_routable", hint: "listed only" }, /listed only.*list_agents/],
    [404, { error: "no_agent_available", hint: "No healthy AIProx agent" }, /No healthy AIProx agent/],
    [502, { error: "orchestration_failed", refund: { status: "credential_restored" } }, /No step produced a usable result\. Payment restored \(credential_restored\)/],
    [429, { error: "rate_limit_exceeded", retry_after_secs: 30 }, /retry in 30 seconds/],
    [413, { error: "payload_too_large" }, /10 KB/],
    [503, "<html>", /AIProx error 503/],
  ];
  for (const [status, body, re] of cases) {
    const { c } = client({ "POST /api/orchestrate": { status, body } });
    const r = await callTool(c, "orchestrate", { task: "x" });
    assert.equal(r.isError, true, JSON.stringify(body));
    assert.match(out(r), re);
  }
});

test("get_job_status, get_spec", async () => {
  const { c } = client({
    "GET /api/async/job-1": { body: { status: "complete", result: { status: "success", result: "done" } } },
    "GET /api/spec.json": { body: { description: "AIProx runs tasks on its own agents", listing_policy: { duplicates: "one per endpoint" } } },
  });
  assert.match(out(await callTool(c, "get_job_status", { job_id: "job-1" })), /Job job-1: complete[\s\S]*"result": "done"/);
  assert.equal((await callTool(c, "get_job_status", { job_id: "gone" })).isError, true);
  assert.match(out(await callTool(c, "get_spec", {})), /listing_policy/);
});

test("register_agent: dry run by default, exact manifest, no credential; real listing only with dry_run false", async () => {
  const { c, f } = client({
    "POST /api/agents/register": (call) =>
      call.search === "?dry_run=true" ? { body: { status: "dry_run_ok" } } : { body: { status: "pending", message: "health check failed", next: "fix it", agent: "https://aiprox.dev/api/agents/my-agent" } },
  });
  const args = { name: "weather-summary-agent", capability: "data-analysis", endpoint: "https://agent.example.net/run", description: "Weather summaries", extra: "ignored" };
  const d = out(await callTool(c, "register_agent", args));
  assert.match(d, /Valid \(dry run, nothing stored\)/);
  assert.equal(f.calls[0].search, "?dry_run=true");
  assert.deepEqual(f.calls[0].body, { name: "weather-summary-agent", capability: "data-analysis", rail: "bitcoin-lightning", endpoint: "https://agent.example.net/run", description: "Weather summaries" });
  assert.equal(f.calls[0].headers["X-Spend-Token"], undefined);
  const real = out(await callTool(c, "register_agent", { ...args, dry_run: false }));
  assert.equal(f.calls[1].search, "");
  assert.match(real, /status pending.*fix it/s);
  assert.equal((await callTool(c, "register_agent", { ...args, rail: "solana-usdc" })).isError, true);
  const { c: c2 } = client({ "POST /api/agents/register": { status: 400, body: { status: "error", code: "INVALID_NAME", error: "Agent name rejected: name contains \"probe\"" } } });
  assert.match(out(await callTool(c2, "register_agent", { ...args, name: "probe-1" })), /INVALID_NAME.*blocked for 24 hours/s);
});

test("network errors and redaction", async () => {
  const c = createClient({ baseUrl: "https://ax.test", token: TOKEN, fetchImpl: async () => { throw new Error("boom " + TOKEN); } });
  const r = await callTool(c, "orchestrate", { task: "x" });
  assert.equal(r.isError, true);
  assert.ok(!out(r).includes(TOKEN));
  assert.equal(redact("a lnpx_abcdef123456 b"), "a lnpx_…(redacted) b");
});

test("MCP protocol through the SDK: initialize reports 1.6.0, tools/list, tools/call", async () => {
  const f = mockFetch({ "GET /api/agents": { body: AGENTS } });
  const { server } = createServer({ env: { AIPROX_URL: "https://ax.test" }, fetchImpl: f });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const mcp = new Client({ name: "t", version: "1" });
  await mcp.connect(b);
  assert.deepEqual(mcp.getServerVersion(), { name: "aiprox", version: "1.6.0" });
  assert.equal((await mcp.listTools()).tools.length, 7);
  const r = await mcp.callTool({ name: "list_agents", arguments: {} });
  assert.match(r.content[0].text, /search-bot/);
  assert.equal(ORCHESTRATE_PRICE_SATS, 50);
  await mcp.close();
});
