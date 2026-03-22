"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "https://agentverse-production.up.railway.app";

const CAT_COLOR = {
  trading:      "#6BCF8B", analysis: "#B59CE6", data:      "#6BB6E6",
  risk:         "#E67B7B", composite: "#E6C36B", productivity: "#a78bfa",
  automation:   "#f472b6", creative:  "#fb923c", research:  "#38bdf8",
  web:          "#4ade80", experimental: "#FF6B35",
};
const catColor = (c) => CAT_COLOR[c] || "#9aabb8";

const REP_TIER = (r) =>
  r >= 4.5 ? { label: "Elite",  color: "#f59e0b" } :
  r >= 3.5 ? { label: "Pro",    color: "#818cf8" } :
  r >= 2.5 ? { label: "Active", color: "#34d399" } :
             { label: "New",    color: "#9aabb8" };

const LANGS = ["curl", "python", "javascript", "node"];

function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: "relative", background: "#0d1117", borderRadius: 10, border: "1px solid #21262d" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid #21262d" }}>
        <span style={{ color: "#8b949e", fontSize: 11, fontFamily: "monospace" }}>{lang}</span>
        <button onClick={copy} style={{ background: copied ? "#238636" : "#21262d", color: copied ? "#fff" : "#8b949e", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "14px 16px", fontSize: 12, color: "#e6edf3", overflowX: "auto", fontFamily: "monospace", lineHeight: 1.7, WebkitOverflowScrolling: "touch" }}>{code}</pre>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 10, padding: "12px 18px", textAlign: "center", flex: 1, minWidth: 80 }}>
      <div style={{ color: color || "#e6edf3", fontWeight: 800, fontSize: 20 }}>{value}</div>
      <div style={{ color: "#8b949e", fontSize: 10, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
    </div>
  );
}

export default function AgentPage() {
  const { id } = useParams();
  const [agent,   setAgent]   = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Try-it state
  const [lang,       setLang]       = useState("curl");
  const [input,      setInput]      = useState("");
  const [running,    setRunning]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [runErr,     setRunErr]     = useState(null);
  const [runLatency, setRunLatency] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`${API}/agents/${id}`).then(r => r.ok ? r.json() : null),
      fetch(`${API}/agents/${id}/metrics`).then(r => r.ok ? r.json() : null),
    ]).then(([a, m]) => {
      if (!a) { setNotFound(true); }
      else { setAgent(a); setMetrics(m); }
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  const runAgent = async () => {
    if (running) return;
    setRunning(true); setResult(null); setRunErr(null); setRunLatency(null);
    const t0 = Date.now();
    try {
      let payload = {};
      try { payload = input.trim() ? JSON.parse(input) : {}; }
      catch { payload = { input: input.trim() }; }
      const r = await fetch(`${API}/call-agent/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      setRunLatency(Date.now() - t0);
      if (!r.ok) { setRunErr(d.detail || "Agent returned an error"); }
      else { setResult(d); }
    } catch (e) {
      setRunErr(e.message);
    } finally { setRunning(false); }
  };

  const buildSnippet = (a) => {
    const url = `${API}/call-agent/${a.id}`;
    const body = input.trim() ? input.trim() : '{"input": "your input here"}';
    if (lang === "curl") return `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '${body}'`;
    if (lang === "python") return `import requests

response = requests.post(
    "${url}",
    json=${body},
)
print(response.json())`;
    if (lang === "javascript") return `const response = await fetch("${url}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${body}),
});
const data = await response.json();
console.log(data);`;
    if (lang === "node") return `const fetch = require("node-fetch");

fetch("${url}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${body}),
}).then(r => r.json()).then(console.log);`;
    return "";
  };

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#8b949e", fontSize: 14, fontFamily: "monospace" }}>Loading…</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100dvh", background: "#0d1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 48 }}>404</div>
      <div style={{ color: "#8b949e", fontSize: 16 }}>Agent not found</div>
      <a href="/" style={{ color: "#58a6ff", fontSize: 13, textDecoration: "none" }}>← Back to AgentVerse</a>
    </div>
  );

  const c = catColor(agent.category);
  const tier = REP_TIER(agent.reputation || 0);
  const isX402 = agent.owner_wallet?.startsWith("0x") && agent.owner_wallet?.length === 42;
  const m = metrics || {};

  return (
    <div style={{ minHeight: "100dvh", background: "#0d1117", color: "#e6edf3", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #21262d", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#161b22" }}>
        <a href="/" style={{ color: "#8b949e", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ background: "linear-gradient(135deg, #818cf8, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 800, fontSize: 14 }}>AgentVerse</span>
          <span style={{ color: "#30363d" }}>/</span>
          <span>agents</span>
          <span style={{ color: "#30363d" }}>/</span>
          <span style={{ color: "#e6edf3" }}>{agent.name}</span>
        </a>
        <a href="/" style={{ background: "#238636", color: "#fff", textDecoration: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 700 }}>
          Open in AgentVerse →
        </a>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(20px, 4vw, 40px) clamp(16px, 4vw, 24px) 80px" }}>

        {/* Hero */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: `${c}22`, border: `2px solid ${c}50`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>
            {agent.category === "trading" ? "📊" : agent.category === "research" ? "🔍" : agent.category === "creative" ? "✨" : agent.category === "productivity" ? "⚡" : agent.category === "automation" ? "⚙️" : agent.category === "web" ? "🌐" : agent.category === "data" ? "≋" : agent.category === "risk" ? "🛡️" : "🤖"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: "clamp(20px, 4vw, 26px)", fontWeight: 800, color: "#e6edf3" }}>{agent.name}</h1>
              <span style={{ padding: "2px 10px", borderRadius: 20, background: `${c}20`, color: c, fontSize: 11, fontWeight: 700, border: `1px solid ${c}40` }}>{agent.category}</span>
              <span style={{ padding: "2px 10px", borderRadius: 20, background: `${tier.color}20`, color: tier.color, fontSize: 11, fontWeight: 700, border: `1px solid ${tier.color}40` }}>{tier.label}</span>
              <span style={{ padding: "2px 10px", borderRadius: 20, background: agent.status === "active" ? "#23863620" : "#450a0a20", color: agent.status === "active" ? "#3fb950" : "#f85149", fontSize: 11, fontWeight: 700, border: `1px solid ${agent.status === "active" ? "#23863640" : "#f8514940"}` }}>
                {agent.status === "active" ? "● Online" : "○ Offline"}
              </span>
            </div>
            <p style={{ margin: 0, color: "#8b949e", fontSize: 14, lineHeight: 1.6 }}>{agent.description || "No description provided."}</p>
            <div style={{ marginTop: 8, color: "#8b949e", fontSize: 12 }}>
              by <span style={{ color: "#58a6ff" }}>@{agent.developer_name || "AgentVerse"}</span>
              {" · "}
              <span style={{ color: "#f0883e", fontWeight: 700 }}>${agent.price_per_request} / call</span>
              {" · "}
              <span>{(agent.reputation || 0).toFixed(1)}★ reputation</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          <StatPill label="Total Calls"   value={(m.requests || 0).toLocaleString()} color="#58a6ff" />
          <StatPill label="Earned"        value={`$${(m.earnings || 0).toFixed(2)}`} color="#3fb950" />
          <StatPill label="Avg Latency"   value={m.avg_latency_ms ? `${m.avg_latency_ms}ms` : "—"} color="#d2a8ff" />
          <StatPill label="Success Rate"  value={m.success_rate != null ? `${(m.success_rate * 100).toFixed(0)}%` : "—"} color="#f0883e" />
        </div>

        {/* Payment method */}
        <div style={{ background: isX402 ? "#2e106520" : "#1e3a5f20", border: `1px solid ${isX402 ? "#7c3aed40" : "#1e40af40"}`, borderRadius: 10, padding: "10px 16px", marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{isX402 ? "⚡" : "💳"}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: isX402 ? "#c084fc" : "#60a5fa" }}>
              {isX402 ? "x402 on-chain payments (USDC)" : "Credit-based billing"}
            </div>
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 1 }}>
              {isX402
                ? `Pay $${agent.price_per_request} USDC per call on World Chain / Base. Include X-Payment header.`
                : `$${agent.price_per_request} credits per call. Sign in to AgentVerse to top up.`}
            </div>
          </div>
        </div>

        {/* Try it */}
        <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 14, marginBottom: 28, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3fb950" }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: "#e6edf3" }}>Try it live</span>
            <span style={{ fontSize: 11, color: "#8b949e", marginLeft: "auto" }}>calls the real agent · billed at ${agent.price_per_request}</span>
          </div>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ color: "#8b949e", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 6 }}>Input payload (JSON or plain text)</label>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={'{"input": "your input here"}'}
                rows={3}
                style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#e6edf3", fontFamily: "monospace", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
              />
            </div>
            <button
              onClick={runAgent}
              disabled={running}
              style={{ background: running ? "#21262d" : "#238636", color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 13, fontWeight: 700, cursor: running ? "default" : "pointer", fontFamily: "inherit", transition: "background 0.15s" }}
            >
              {running ? "Running…" : "▶ Run Agent"}
            </button>

            {(result || runErr) && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: runErr ? "#f85149" : "#3fb950" }} />
                  <span style={{ fontSize: 11, color: runErr ? "#f85149" : "#3fb950", fontWeight: 700 }}>
                    {runErr ? "Error" : `Response · ${runLatency}ms`}
                  </span>
                  {result?._mock && <span style={{ fontSize: 10, color: "#8b949e", background: "#21262d", borderRadius: 4, padding: "1px 6px" }}>mock</span>}
                </div>
                <pre style={{ margin: 0, background: "#0d1117", border: `1px solid ${runErr ? "#f8514940" : "#23863640"}`, borderRadius: 8, padding: "12px 14px", fontSize: 12, color: runErr ? "#f85149" : "#e6edf3", overflowX: "auto", fontFamily: "monospace", lineHeight: 1.6, WebkitOverflowScrolling: "touch" }}>
                  {runErr || JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Code snippets */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e6edf3" }}>Use from anywhere</h2>
            <div style={{ display: "flex", gap: 4 }}>
              {LANGS.map(l => (
                <button key={l} onClick={() => setLang(l)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid", borderColor: lang === l ? "#58a6ff" : "#30363d", background: lang === l ? "#58a6ff20" : "transparent", color: lang === l ? "#58a6ff" : "#8b949e", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <CodeBlock code={buildSnippet(agent)} lang={lang} />
        </div>

        {/* Response shape */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#e6edf3" }}>Response format</h2>
          <CodeBlock lang="json" code={`{
  // Agent-specific output fields
  "result":   "...",          // main output (varies by agent)

  // Platform metadata
  "_tx": {
    "amount":     ${agent.price_per_request},   // credits charged
    "agent_id":   "${agent.id}"
  }
}`} />
        </div>

        {/* Endpoint info */}
        <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "16px 20px", marginBottom: 28 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#e6edf3" }}>Endpoint</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["POST", `${API}/call-agent/${agent.id}`, "Run the agent"],
              ["GET",  `${API}/agents/${agent.id}`,      "Agent metadata"],
              ["GET",  `${API}/agents/${agent.id}/metrics`, "Usage stats"],
            ].map(([method, url, desc]) => (
              <div key={url} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 800, fontFamily: "monospace", background: method === "POST" ? "#1a3a1a" : "#1a2a3a", color: method === "POST" ? "#3fb950" : "#58a6ff", flexShrink: 0 }}>{method}</span>
                <code style={{ fontSize: 12, color: "#e6edf3", fontFamily: "monospace", wordBreak: "break-all" }}>{url}</code>
                <span style={{ color: "#8b949e", fontSize: 11 }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ textAlign: "center", padding: "32px 20px", background: "linear-gradient(135deg, #161b22, #0d1117)", border: "1px solid #21262d", borderRadius: 16 }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>🚀</div>
          <div style={{ color: "#e6edf3", fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Build your own agent</div>
          <div style={{ color: "#8b949e", fontSize: 13, marginBottom: 20 }}>
            Any HTTP endpoint becomes a monetizable agent in 60 seconds.
          </div>
          <a href="/" style={{ background: "linear-gradient(135deg, #818cf8, #34d399)", color: "#fff", textDecoration: "none", borderRadius: 10, padding: "10px 28px", fontSize: 14, fontWeight: 800, display: "inline-block" }}>
            Deploy on AgentVerse →
          </a>
        </div>

      </div>
    </div>
  );
}
