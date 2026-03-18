"use client";

import { useEffect, useState, useMemo } from "react";
import { API } from "@/app/lib/config";
import { fetchWithX402 } from "@/app/lib/x402";
import { useWallet } from "./WalletProvider";

// ── Category config ───────────────────────────────────────────────────────────
const CAT = {
  trading:   { icon: "📈", color: "#10b981", pill: "#ecfdf5", text: "#065f46", label: "Trading" },
  analysis:  { icon: "🔍", color: "#8b5cf6", pill: "#f5f3ff", text: "#3730a3", label: "Analysis" },
  data:      { icon: "⚡", color: "#3b82f6", pill: "#eff6ff", text: "#1e40af", label: "Market Data" },
  risk:      { icon: "🛡️", color: "#ef4444", pill: "#fef2f2", text: "#991b1b", label: "Risk" },
  composite: { icon: "🔗", color: "#f59e0b", pill: "#fffbeb", text: "#92400e", label: "Workflow" },
  default:   { icon: "🤖", color: "#6b7280", pill: "#f9fafb", text: "#374151", label: "Agent" },
};
const cat = (c) => CAT[c] ?? CAT.default;
const toCredits = (usd) => Math.max(1, Math.round(usd * 100));

// ── Human-readable output keys ────────────────────────────────────────────────
const KEY_MAP = {
  price_usd:        { label: "Price",          fmt: v => `$${Number(v).toLocaleString()}` },
  change_24h_pct:   { label: "24h Change",     fmt: v => `${v > 0 ? "+" : ""}${Number(v).toFixed(2)}%` },
  signal:           { label: "Signal",         fmt: v => String(v).toUpperCase() },
  confidence:       { label: "Confidence",     fmt: v => `${Math.round(Number(v) * 100)}%` },
  momentum_score:   { label: "Momentum",       fmt: v => Number(v).toFixed(2) },
  fear_greed_value: { label: "Fear & Greed",   fmt: v => `${v} / 100` },
  fear_greed_label: { label: "Sentiment",      fmt: v => String(v) },
  volatility:       { label: "Volatility",     fmt: v => Number(v).toFixed(3) },
  regime:           { label: "Market Regime",  fmt: v => String(v).toUpperCase() },
  opportunity:      { label: "Opportunity",    fmt: v => String(v).toUpperCase() },
  spread_pct:       { label: "Price Spread",   fmt: v => `${Number(v).toFixed(3)}%` },
  liquidity_score:  { label: "Liquidity",      fmt: v => `${Number(v).toFixed(1)} / 10` },
  trend:            { label: "Trend",          fmt: v => String(v).toUpperCase() },
  strength:         { label: "Strength",       fmt: v => Number(v).toFixed(2) },
  risk_score:       { label: "Risk Score",     fmt: v => `${Number(v).toFixed(1)} / 10` },
  sharpe_ratio:     { label: "Sharpe Ratio",   fmt: v => Number(v).toFixed(2) },
  recommendation:   { label: "Recommendation", fmt: v => String(v).toUpperCase() },
  var_pct:          { label: "Value at Risk",  fmt: v => `${Number(v).toFixed(2)}%` },
  max_drawdown:     { label: "Max Drawdown",   fmt: v => `${Number(v).toFixed(2)}%` },
  correlation:      { label: "Correlation",    fmt: v => Number(v).toFixed(2) },
};
const SKIP = new Set(["market", "agent_id", "_mock", "source", "exchange_a", "exchange_b",
  "reference_price", "high_24h", "low_24h", "volume_24h_usd"]);

// ── Insight engine ────────────────────────────────────────────────────────────
function getInsight(result) {
  if (!result) return null;
  if (result.signal === "BUY")       return { icon: "🟢", text: "Strong buy signal — momentum and conditions favor entering a position.", tone: "green" };
  if (result.signal === "SELL")      return { icon: "🔴", text: "Bearish signal — consider reducing exposure or waiting for a reversal.", tone: "red" };
  if (result.signal === "HOLD")      return { icon: "🟡", text: "Mixed signals — no clear edge. Wait for confirmation before acting.", tone: "yellow" };
  if (result.opportunity === "HIGH") return { icon: "💡", text: `Price gap detected: ${Number(result.spread_pct || 0).toFixed(3)}% spread — potential arbitrage window.`, tone: "blue" };
  if (result.opportunity === "LOW")  return { icon: "💤", text: "No significant arbitrage gap right now. Markets are closely aligned.", tone: "gray" };
  if ((result.fear_greed_value ?? 50) < 25) return { icon: "😱", text: "Extreme fear — historically a contrarian buy signal. High risk, high potential.", tone: "green" };
  if ((result.fear_greed_value ?? 50) > 75) return { icon: "🤑", text: "Extreme greed — market may be overextended. Consider taking profits.", tone: "red" };
  if (result.trend === "UPTREND")    return { icon: "🚀", text: "Market is trending up — bulls in control. Momentum favors longs.", tone: "green" };
  if (result.trend === "DOWNTREND")  return { icon: "📉", text: "Downtrend in progress — be cautious with long positions.", tone: "red" };
  if (result.trend === "SIDEWAYS")   return { icon: "↔️", text: "Consolidating — wait for a breakout before committing.", tone: "yellow" };
  if ((result.risk_score ?? 5) > 7) return { icon: "⚠️", text: "High risk environment — reduce size, tighten stops.", tone: "red" };
  if ((result.risk_score ?? 5) < 4) return { icon: "✅", text: "Low risk conditions — volatility is subdued.", tone: "green" };
  if (result.price_usd)             return { icon: "📊", text: "Live price fetched. Feed into Momentum or Sentiment agent to generate a signal.", tone: "blue" };
  return { icon: "✅", text: "Agent returned live market data successfully.", tone: "gray" };
}

const TONE = {
  green:  { bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
  red:    { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
  yellow: { bg: "#fefce8", border: "#fde68a", color: "#a16207" },
  blue:   { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
  gray:   { bg: "#f9fafb", border: "#e5e7eb", color: "#6b7280" },
};

// ── Pair suggestions ──────────────────────────────────────────────────────────
const PAIRS = {
  trading:   ["PriceFeedAgent", "SentimentAgent", "TrendAnalyzer"],
  data:      ["MomentumAgent", "SentimentAgent", "TrendAnalyzer"],
  analysis:  ["MomentumAgent", "RiskAgent", "PriceFeedAgent"],
  risk:      ["TrendAnalyzer", "VolatilityScanner", "CorrelationAgent"],
  composite: ["PriceFeedAgent", "SentimentAgent"],
};

const MARKETS = ["BTC", "ETH", "SOL", "AVAX", "BNB"];

// ── Featured workflows ────────────────────────────────────────────────────────
const WORKFLOWS = [
  { name: "Market Signal Stack",  tagline: "Get a BUY / SELL / HOLD call with confidence score", steps: ["Price Feed", "Sentiment", "Momentum"], color: "#10b981", bg: "#ecfdf5", icon: "📈" },
  { name: "Risk Dashboard",       tagline: "Know your exposure before entering any trade",        steps: ["Volatility", "Risk Score", "Portfolio"], color: "#ef4444", bg: "#fef2f2", icon: "🛡️" },
  { name: "Opportunity Scanner",  tagline: "Spot price gaps and trend breakouts across markets",  steps: ["Arbitrage", "Trend", "Correlation"],   color: "#3b82f6", bg: "#eff6ff", icon: "🔍" },
];

function FeaturedWorkflows() {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: "-0.2px" }}>Featured Workflows</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Ready-to-run combinations — open in Pipeline Builder</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 12 }}>
        {WORKFLOWS.map(w => (
          <a key={w.name} href="/build" style={{ textDecoration: "none" }}>
            <div
              style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px", cursor: "pointer", transition: "all 0.18s", position: "relative", overflow: "hidden" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = w.color; e.currentTarget.style.boxShadow = `0 8px 24px ${w.color}22`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ width: 40, height: 40, background: w.bg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 12 }}>{w.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{w.name}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5, marginBottom: 14 }}>{w.tagline}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {w.steps.map((s, i) => (
                  <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ background: w.bg, color: w.color, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4 }}>{s}</span>
                    {i < w.steps.length - 1 && <span style={{ color: "#d1d5db", fontSize: 10 }}>→</span>}
                  </span>
                ))}
              </div>
              <div style={{ position: "absolute", top: 16, right: 16, fontSize: 9, fontWeight: 700, color: w.color, background: w.bg, padding: "3px 8px", borderRadius: 20, letterSpacing: 0.5 }}>BUILD →</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ── Try Agent Modal ───────────────────────────────────────────────────────────
function TryAgentModal({ agent, allAgents, onClose }) {
  const { account, walletClient } = useWallet();
  const [market,  setMarket]  = useState("BTC");
  const [running, setRunning] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const c = cat(agent.category);

  const pairSuggestions = useMemo(() => {
    const names = PAIRS[agent.category] ?? [];
    return names.map(n => allAgents.find(a => a.name === n)).filter(Boolean).slice(0, 3);
  }, [agent, allAgents]);

  const run = async () => {
    setRunning(true); setResult(null); setError(null);
    try {
      const res = await fetchWithX402(
        `${API}/call-agent/${agent.id}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market }) },
        walletClient, account
      );
      if (!res.ok) { setError("Agent returned an error — try again."); return; }
      setResult(await res.json());
    } catch {
      setError("Could not reach the agent. Check your connection.");
    } finally {
      setRunning(false);
    }
  };

  const insight = getInsight(result);
  const tone    = insight ? TONE[insight.tone] : null;
  const entries = result
    ? Object.entries(result).filter(([k, v]) => !SKIP.has(k) && KEY_MAP[k] && v !== null && v !== undefined).slice(0, 7)
    : [];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.28)" }}>

        {/* Header */}
        <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #f3f4f6", position: "sticky", top: 0, background: "#fff", borderRadius: "24px 24px 0 0", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 52, height: 52, background: c.pill, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                {c.icon}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{agent.name}</div>
                <span style={{ display: "inline-block", marginTop: 5, background: c.pill, color: c.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.6 }}>{c.label}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 18, color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
            {agent.description || "Calls a live market API and returns real-time data."}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 28px" }}>

          {/* Market picker */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Pick a market</div>
            <div style={{ display: "flex", gap: 6 }}>
              {MARKETS.map(m => (
                <button key={m} onClick={() => { setMarket(m); setResult(null); }} style={{
                  flex: 1, padding: "9px 0", borderRadius: 9, border: market === m ? `1.5px solid ${c.color}` : "1.5px solid #e5e7eb",
                  background: market === m ? c.color : "#fff", color: market === m ? "#fff" : "#6b7280",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.12s",
                }}>{m}</button>
              ))}
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={run} disabled={running}
            style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none",
              background: running ? "#d1d5db" : c.color, color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: running ? "default" : "pointer",
              marginBottom: 6, transition: "all 0.15s",
            }}
          >
            {running ? "⏳  Running…" : result ? `↺  Run again on ${market}` : `▶  Run on ${market}`}
          </button>
          <div style={{ textAlign: "center", color: "#d1d5db", fontSize: 11, marginBottom: 20 }}>
            {toCredits(agent.price_per_request)} credit{toCredits(agent.price_per_request) !== 1 ? "s" : ""} · live API call
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#b91c1c", marginBottom: 16 }}>{error}</div>
          )}

          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Insight card */}
              {insight && tone && (
                <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>What this means</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: tone.color, lineHeight: 1.6 }}>
                    {insight.icon} {insight.text}
                  </div>
                </div>
              )}

              {/* Data rows */}
              {entries.length > 0 && (
                <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>
                    Live Data — {market}
                  </div>
                  {entries.map(([k, v], i) => {
                    const def = KEY_MAP[k];
                    return (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: i < entries.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>{def.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{def.fmt(v)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pair suggestions */}
              {pairSuggestions.length > 0 && (
                <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Combine it with</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, lineHeight: 1.5 }}>
                    Add these agents to build a complete signal pipeline:
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {pairSuggestions.map(a => {
                      const pc = cat(a.category);
                      return (
                        <span key={a.id} style={{ background: pc.pill, color: pc.color, border: `1px solid ${pc.color}30`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 600 }}>
                          {pc.icon} {a.name}
                        </span>
                      );
                    })}
                  </div>
                  <a href="/build" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#0ea5e9", color: "#fff", borderRadius: 10, padding: "11px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                    Open Pipeline Builder →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────
function AgentCard({ agent, onTry }) {
  const c = cat(agent.category);
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "#fff",
        border: hov ? `1px solid ${c.color}60` : "1px solid #e5e7eb",
        borderRadius: 16,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.18s",
        boxShadow: hov ? `0 8px 28px ${c.color}18` : "0 1px 4px rgba(0,0,0,0.04)",
        cursor: "default",
      }}
    >
      {/* Icon + meta */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ width: 48, height: 48, background: c.pill, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
          {c.icon}
        </div>
        <span style={{ background: c.pill, color: c.color, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.7, marginTop: 4 }}>
          {c.label}
        </span>
      </div>

      {/* Name */}
      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", lineHeight: 1.3, marginBottom: 6 }}>{agent.name}</div>

      {/* Description */}
      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.65, flex: 1, marginBottom: 16 }}>
        {agent.description || "Calls a live market API and returns real-time data."}
      </div>

      {/* Credit badge */}
      <div style={{ fontSize: 10, color: "#d1d5db", marginBottom: 12 }}>
        {toCredits(agent.price_per_request)} credit{toCredits(agent.price_per_request) !== 1 ? "s" : ""} per call
      </div>

      {/* CTAs */}
      <button
        onClick={() => onTry(agent)}
        style={{
          width: "100%", background: c.color, color: "#fff", border: "none",
          borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 700,
          cursor: "pointer", marginBottom: 8, transition: "opacity 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        ▶ Try Live
      </button>
      <a href="/build" style={{
        display: "block", textAlign: "center",
        background: `${c.color}0f`, color: c.color,
        border: `1px solid ${c.color}25`, borderRadius: 9, padding: "8px",
        fontSize: 11, fontWeight: 700, textDecoration: "none",
      }}>
        + Add to Pipeline
      </a>
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTER_CATS = [
  { id: "all",       label: "All",             icon: "✦" },
  { id: "trading",   label: "Trading",         icon: "📈" },
  { id: "data",      label: "Market Data",     icon: "⚡" },
  { id: "analysis",  label: "Analysis",        icon: "🔍" },
  { id: "risk",      label: "Risk",            icon: "🛡️" },
  { id: "composite", label: "Workflows",       icon: "🔗" },
];

function FilterTabs({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 24 }}>
      {FILTER_CATS.map(({ id, label, icon }) => {
        const on = active === id;
        const color = id === "all" ? "#6b7280" : cat(id).color;
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            cursor: "pointer", transition: "all 0.12s",
            border: on ? `1.5px solid ${color}` : "1.5px solid #e5e7eb",
            background: on ? color : "#fff",
            color: on ? "#fff" : "#6b7280",
          }}>
            <span style={{ fontSize: 13 }}>{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MarketplaceView() {
  const [agents,    setAgents]    = useState([]);
  const [filter,    setFilter]    = useState("all");
  const [tryAgent,  setTryAgent]  = useState(null);
  const [backendOk, setBackendOk] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`${API}/agents`).then(r => r.json())
        .then(a => { if (!cancelled) { setAgents(a); setBackendOk(true); } })
        .catch(() => { if (!cancelled) setBackendOk(false); });
    load();
    const iv = setInterval(load, 8000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const regular    = useMemo(() => agents.filter(a => a.category !== "composite"), [agents]);
  const composites = useMemo(() => agents.filter(a => a.category === "composite"),  [agents]);

  const visible = useMemo(() => {
    if (filter === "all") return regular;
    return agents.filter(a => a.category === filter);
  }, [agents, regular, filter]);

  const showComposites = filter === "all" && composites.length > 0;

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#f8f9fb", fontFamily: "inherit" }}>

      {/* Hero banner */}
      <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", padding: "36px 40px 32px" }}>
        {!backendOk && (
          <div style={{ marginBottom: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 16px", color: "#b91c1c", fontSize: 12, fontWeight: 600 }}>
            ⚠️ Backend offline — agents unavailable right now.
          </div>
        )}
        <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", marginBottom: 6 }}>
          Agent Marketplace
        </div>
        <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, maxWidth: 520, marginBottom: 24 }}>
          Browse, try, and combine AI agents that plug into live market data. Each agent is a callable API — run them solo or chain them in Pipeline Builder.
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{agents.length}</div>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>Live Agents</div>
          </div>
          <div style={{ width: 1, background: "#1e293b" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>5</div>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>Categories</div>
          </div>
          <div style={{ width: 1, background: "#1e293b" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Live</div>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>Real Data</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>

        <FeaturedWorkflows />

        {/* Section label */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>All Agents</div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>— pick one and hit Try Live to see it work</div>
        </div>

        <FilterTabs active={filter} onChange={setFilter} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, marginBottom: 28 }}>
          {visible.map(a => <AgentCard key={a.id} agent={a} onTry={setTryAgent} />)}
          {visible.length === 0 && (
            <div style={{ gridColumn: "1 / -1", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              No agents in this category yet.
            </div>
          )}
        </div>

        {/* Full Workflows (composite) */}
        {showComposites && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>🔗 Full Workflows</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Multi-agent pipelines deployed as a single callable agent</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, marginBottom: 28 }}>
              {composites.map(a => <AgentCard key={a.id} agent={a} onTry={setTryAgent} />)}
            </div>
          </>
        )}

      </div>

      {tryAgent && (
        <TryAgentModal agent={tryAgent} allAgents={agents} onClose={() => setTryAgent(null)} />
      )}
    </div>
  );
}
