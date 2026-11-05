// AIProx HTTP client: requests, error mapping and token redaction.
// The spend token is sent only as the X-Spend-Token header and is redacted
// from every string this module returns.

export const DEFAULT_URL = "https://aiprox.dev";
export const VERSION = "1.6.0";
const USER_AGENT = `aiprox-mcp/${VERSION}`;
const TIMEOUT_MS = 120_000; // orchestrate answers within 85 s

export class AIProxError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "AIProxError";
    this.status = status;
    this.code = code;
  }
}

/** Replace any lnpx_ spend token in s with a redacted marker. */
export function redact(s, token) {
  if (typeof s !== "string") return s;
  let out = s;
  if (token) out = out.split(token).join("lnpx_…(redacted)");
  return out.replace(/lnpx_[A-Za-z0-9]{8,}/g, "lnpx_…(redacted)");
}

export function createClient({ baseUrl, token, fetchImpl } = {}) {
  const base = (baseUrl || DEFAULT_URL).replace(/\/+$/, "");
  const doFetch = fetchImpl || globalThis.fetch;
  if (typeof doFetch !== "function") {
    throw new Error("global fetch is not available: Node.js 18 or newer is required");
  }

  async function request(method, path, { body, headers = {}, auth = false } = {}) {
    const h = { "User-Agent": USER_AGENT, Accept: "application/json", ...headers };
    if (body !== undefined) h["Content-Type"] = "application/json";
    if (auth && token) h["X-Spend-Token"] = token;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await doFetch(base + path, {
        method,
        headers: h,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (err) {
      const why = err && err.name === "AbortError" ? `timed out after ${TIMEOUT_MS / 1000}s` : String(err && err.message ? err.message : err);
      throw new AIProxError(redact(`Could not reach AIProx at ${base}: ${why}`, token), { code: "network_error" });
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, headers: res.headers, json, text };
  }

  return { base, hasToken: Boolean(token), token, request };
}

/** A non-2xx AIProx response as a clear, redacted message. */
export function describeError(res, { token } = {}) {
  const b = (res.json && typeof res.json === "object" && res.json) || {};
  const code = typeof b.error === "string" ? b.error : typeof b.code === "string" ? b.code : undefined;
  const detail = [b.message, b.detail, b.hint].filter((x) => typeof x === "string" && x).join(" ");
  const serverMsg = detail || (typeof b.error === "string" ? b.error : (res.text || "").slice(0, 300));
  const refund = b.refund && typeof b.refund === "object" ? ` Payment restored (${b.refund.status || "refunded"}).` : "";
  let msg;
  switch (true) {
    case code === "insufficient_balance":
      msg = `Spend token balance too low (${b.balance_sats ?? "?"} sats; needs ${b.required_sats ?? "?"}). Top up at https://lightningprox.com/topup. Nothing was charged.`;
      break;
    case code === "invalid_spend_token":
    case code === "wrong_token_type":
      msg = `AIProx rejected the spend token (${code}). Set a valid lnpx_ token in AIPROX_SPEND_TOKEN. Nothing was charged.`;
      break;
    case code === "invalid_l402_token":
      msg = `The L402 credential was rejected: the preimage does not match a paid invoice. Nothing was charged.`;
      break;
    case code === "unsupported_payment_method":
      msg = `AIProx accepts Lightning only (L402 or an lnpx_ spend token). Nothing was charged.`;
      break;
    case code === "agent_not_found":
    case code === "no_agent_available":
    case code === "external_agent_not_routable":
      msg = `${serverMsg || code} Use list_agents to see AIProx's own bots (routable). Nothing was charged.`;
      break;
    case code === "orchestration_failed":
      msg = `No step produced a usable result.${refund || " The payment is restored."}`;
      break;
    case code === "request_blocked":
      msg = `AIProx refused the task (it matched prompt-injection patterns). Nothing was charged.`;
      break;
    case res.status === 429:
      msg = `Rate limited by AIProx${b.retry_after_secs ? `; retry in ${b.retry_after_secs} seconds` : ""}. ${serverMsg}`;
      break;
    case res.status === 413:
      msg = `Request too large (orchestrate bodies are limited to 10 KB). Nothing was charged.`;
      break;
    case res.status === 400:
      msg = `AIProx rejected the request (${code || "400"}): ${serverMsg} Nothing was charged.`;
      break;
    default:
      msg = `AIProx error ${res.status}${code ? ` (${code})` : ""}: ${serverMsg}${refund}`;
  }
  return new AIProxError(redact(msg, token), { status: res.status, code });
}
