#!/usr/bin/env node
// Live smoke test against production over real MCP stdio, free calls only:
// no spend token is set; orchestrate is called as a dry run and once unpaid
// (expects the 50-sat invoice); register_agent only validates (dry_run).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const bin = fileURLToPath(new URL("../bin/aiprox-mcp.js", import.meta.url));
const env = { ...process.env, AIPROX_SPEND_TOKEN: "", AIPROX_URL: process.env.AIPROX_URL || "https://aiprox.dev" };
const transport = new StdioClientTransport({ command: process.execPath, args: [bin], env, stderr: "pipe" });
const mcp = new Client({ name: "aiprox-mcp-smoke", version: "1" });
await mcp.connect(transport);

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  - " + detail : ""}`);
  if (!ok) failed++;
};
const call = async (name, args) => {
  const r = await mcp.callTool({ name, arguments: args });
  return { err: Boolean(r.isError), t: r.content.map((c) => c.text).join("\n") };
};

const v = mcp.getServerVersion();
check("initialize", v.name === "aiprox" && v.version === "1.6.1", JSON.stringify(v));
const { tools } = await mcp.listTools();
check("tools/list", tools.length === 7, tools.map((t) => t.name).join(", "));

let r = await call("list_agents", {});
check("list_agents", !r.err && /AIProx bots/.test(r.t) && /- search-bot \(web-search\)/.test(r.t), `${(r.t.match(/^- /gm) || []).length} entries`);
r = await call("list_agents", { capability: "translation" });
check("list_agents capability filter", !r.err && /- polyglot \(translation\)/.test(r.t));
r = await call("get_agent", { name: "search-bot" });
check("get_agent", !r.err && /an AIProx bot/.test(r.t));
r = await call("find_agent", { task: "translate a paragraph into Japanese" });
check("find_agent", !r.err && /capability translation/.test(r.t), r.t.split("\n")[0]);
r = await call("orchestrate", { task: "latest lightning network news", capability: "web-search", dry_run: true });
check("orchestrate dry_run", !r.err && /mode single-agent, bot search-bot/.test(r.t), r.t.split("\n")[0]);
r = await call("orchestrate", { task: "Step 1: use search-bot to find lightning news\nStep 2: use sentiment-bot to analyze the sentiment", dry_run: true });
check("orchestrate dry_run strict pipeline", !r.err && /strict-pipeline, bots search-bot -> sentiment-bot/.test(r.t));
r = await call("orchestrate", { task: "latest lightning network news", capability: "web-search" });
check("orchestrate unpaid -> 50-sat invoice", !r.err && /Payment required: 50 sats/.test(r.t) && /Invoice \(BOLT11\): lnbc/.test(r.t));
r = await call("get_job_status", { job_id: "00000000-0000-0000-0000-000000000000" });
check("get_job_status (unknown id -> not found)", r.err && /not found/.test(r.t));
r = await call("get_spec", {});
check("get_spec", !r.err && /listing_policy/.test(r.t));
r = await call("register_agent", { name: "weather-summary-agent", capability: "data-analysis", endpoint: "https://api.open-meteo.com/v1/forecast", description: "Daily weather summaries" });
check("register_agent dry run (nothing stored)", !r.err && /Valid \(dry run, nothing stored\)/.test(r.t), r.t.split("\n")[0].slice(0, 80));

await mcp.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall live checks passed");
process.exit(failed ? 1 : 0);
