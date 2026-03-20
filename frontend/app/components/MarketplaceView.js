"use client";

import { useEffect, useState, useMemo } from "react";
import { API } from "@/app/lib/config";

// ── Category config ───────────────────────────────────────────────────────────
const CAT = {
  trading:   { symbol: "↗", color: "#10b981", pill: "#ecfdf5", label: "Trading" },
  analysis:  { symbol: "◎", color: "#8b5cf6", pill: "#f5f3ff", label: "Analysis" },
  data:      { symbol: "≋", color: "#3b82f6", pill: "#eff6ff", label: "Market Data" },
  risk:      { symbol: "◬", color: "#ef4444", pill: "#fef2f2", label: "Risk" },
  composite: { symbol: "⊕", color: "#f59e0b", pill: "#fffbeb", label: "Workflow" },
  default:   { symbol: "·", color: "#6b7280", pill: "#f9fafb", label: "Agent" },
};
const cat = (c) => CAT[c] ?? CAT.default;
const toCredits = (usd) => Math.max(1, Math.round(usd * 100));

// ── Category icon component — colored rounded square with clean symbol ────────
function CatIcon({ category, size = 44 }) {
  const c = cat(category);
  const radius = Math.round(size * 0.22);
  return (
    <div style={{
      width: size, height: size,
      background: c.color,
      borderRadius: radius,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      color: "#fff",
      fontSize: Math.round(size * 0.42),
      fontWeight: 700,
      fontFamily: "system-ui, -apple-system, sans-serif",
      lineHeight: 1,
      userSelect: "none",
    }}>
      {c.symbol}
    </div>
  );
}

// ── Purpose map: what each agent DOES for the user ────────────────────────────
const AGENT_PURPOSE = {
  MomentumAgent:      { displayName: "Trading Signal",        tagline: "Should I buy, sell, or hold right now?",               action: "Get Signal" },
  SentimentAgent:     { displayName: "Sentiment Analyzer",    tagline: "Is the market fearful or greedy right now?",           action: "Check Sentiment" },
  PriceFeedAgent:     { displayName: "Live Price Feed",       tagline: "What's the latest price and 24h change?",              action: "Get Price" },
  TrendAnalyzer:      { displayName: "Trend Detector",        tagline: "Is the market trending up, down, or sideways?",        action: "Detect Trend" },
  RiskAgent:          { displayName: "Risk Scanner",          tagline: "How risky is this market right now?",                  action: "Scan Risk" },
  ArbitrageAgent:     { displayName: "Arbitrage Finder",      tagline: "Are there price gaps between exchanges to exploit?",   action: "Find Gaps" },
  VolatilityScanner:  { displayName: "Volatility Meter",      tagline: "How volatile is this asset right now?",                action: "Measure" },
  CorrelationAgent:   { displayName: "Correlation Tracker",   tagline: "How closely do two assets move together?",             action: "Check Correlation" },
  PortfolioOptimizer: { displayName: "Portfolio Optimizer",   tagline: "What's the ideal allocation for my portfolio?",        action: "Optimize" },
  PatternRecognizer:  { displayName: "Chart Pattern Scanner", tagline: "What technical patterns are forming right now?",       action: "Scan Patterns" },
  LiquidityAnalyzer:  { displayName: "Liquidity Analyzer",    tagline: "How much buying/selling pressure is in this market?",  action: "Check Liquidity" },
  MarketDepthAgent:   { displayName: "Market Depth Agent",    tagline: "What does the order book say about price direction?",  action: "Read Depth" },
};

function agentPurpose(agent) {
  return AGENT_PURPOSE[agent.name] ?? {
    displayName: agent.name,
    tagline: agent.description || "Calls a live market API and returns real-time data.",
    action: "Try It",
  };
}

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
  if (result.signal === "BUY")       return { text: "Strong buy signal — momentum and conditions favor entering a position.", tone: "green" };
  if (result.signal === "SELL")      return { text: "Bearish signal — consider reducing exposure or waiting for a reversal.", tone: "red" };
  if (result.signal === "HOLD")      return { text: "Mixed signals — no clear edge. Wait for confirmation before acting.", tone: "yellow" };
  if (result.opportunity === "HIGH") return { text: `Price gap detected: ${Number(result.spread_pct || 0).toFixed(3)}% spread — potential arbitrage window.`, tone: "blue" };
  if (result.opportunity === "LOW")  return { text: "No significant arbitrage gap right now. Markets are closely aligned.", tone: "gray" };
  if ((result.fear_greed_value ?? 50) < 25) return { text: "Extreme fear in the market — historically a contrarian buy signal.", tone: "green" };
  if ((result.fear_greed_value ?? 50) > 75) return { text: "Extreme greed — market may be overextended. Consider taking profits.", tone: "red" };
  if (result.trend === "UPTREND")    return { text: "Market trending up — bulls in control. Momentum favors longs.", tone: "green" };
  if (result.trend === "DOWNTREND")  return { text: "Downtrend in progress — be cautious with long positions.", tone: "red" };
  if (result.trend === "SIDEWAYS")   return { text: "Consolidating — wait for a breakout before committing.", tone: "yellow" };
  if ((result.risk_score ?? 5) > 7) return { text: "High risk environment — reduce position size, tighten stops.", tone: "red" };
  if ((result.risk_score ?? 5) < 4) return { text: "Low risk conditions — volatility is subdued.", tone: "green" };
  if (result.price_usd)             return { text: "Live price fetched. Combine with Momentum or Sentiment to generate a signal.", tone: "blue" };
  return { text: "Agent returned live market data.", tone: "gray" };
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
  { name: "Market Signal Stack",  tagline: "Get a BUY / SELL / HOLD call with confidence score", steps: ["Price Feed", "Sentiment", "Momentum"], color: "#10b981", category: "trading" },
  { name: "Risk Dashboard",       tagline: "Know your exposure before entering any trade",        steps: ["Volatility", "Risk Score", "Portfolio"], color: "#ef4444", category: "risk" },
  { name: "Opportunity Scanner",  tagline: "Spot price gaps and trend breakouts across markets",  steps: ["Arbitrage", "Trend", "Correlation"],     color: "#3b82f6", category: "data" },
];

function FeaturedWorkflows() {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", fontFamily: "system-ui, -apple-system, sans-serif" }}>Featured Workflows</div>
        <div style={{ fontSize: 12, color: "#9ca3af", fontFamily: "system-ui, -apple-system, sans-serif" }}>combine agents for a complete picture</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>
        {WORKFLOWS.map(w => (
          <a key={w.name} href="/build" style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "#fff",
                borderLeft: `4px solid ${w.color}`,
                borderTop: "1px solid #e5e7eb",
                borderRight: "1px solid #e5e7eb",
                borderBottom: "1px solid #e5e7eb",
                borderRadius: "0 16px 16px 0",
                padding: "20px",
                cursor: "pointer",
                transition: "all 0.18s",
                position: "relative",
                boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 24px ${w.color}22`; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{ position: "absolute", top: 16, right: 16, fontSize: 10, fontWeight: 700, color: w.color, fontFamily: "system-ui, -apple-system, sans-serif" }}>
                Build this →
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4, fontFamily: "system-ui, -apple-system, sans-serif", paddingRight: 60 }}>{w.name}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5, marginBottom: 14, fontFamily: "system-ui, -apple-system, sans-serif" }}>{w.tagline}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                {w.steps.map((s, i) => (
                  <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                      background: `${w.color}15`, color: w.color,
                      fontSize: 10, fontWeight: 600, padding: "2px 8px",
                      borderRadius: 4, fontFamily: "system-ui, -apple-system, sans-serif",
                    }}>{s}</span>
                    {i < w.steps.length - 1 && <span style={{ color: "#d1d5db", fontSize: 10 }}>→</span>}
                  </span>
                ))}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ── Try Agent Modal ───────────────────────────────────────────────────────────
function TryAgentModal({ agent, allAgents, onClose }) {
  const [market,  setMarket]  = useState("BTC");
  const [running, setRunning] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const c = cat(agent.category);
  const purpose = agentPurpose(agent);

  const pairSuggestions = useMemo(() => {
    const names = PAIRS[agent.category] ?? [];
    return names.map(n => allAgents.find(a => a.name === n)).filter(Boolean).slice(0, 3);
  }, [agent, allAgents]);

  const run = async () => {
    setRunning(true); setResult(null); setError(null);
    try {
      const res = await fetch(
        `${API}/call-agent/${agent.id}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market }) },
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
      style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480,
        maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 32px 80px rgba(0,0,0,0.28)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>

        {/* Header */}
        <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #f3f4f6", position: "sticky", top: 0, background: "#fff", borderRadius: "20px 20px 0 0", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <CatIcon category={agent.category} size={44} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>{purpose.displayName}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{purpose.tagline}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 18, color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 28px" }}>

          {/* Market picker */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Which market?</div>
            <div style={{ display: "flex", gap: 6 }}>
              {MARKETS.map(m => (
                <button key={m} onClick={() => { setMarket(m); setResult(null); }} style={{
                  flex: 1, padding: "10px 0", borderRadius: 9,
                  border: market === m ? `2px solid ${c.color}` : "2px solid #e5e7eb",
                  background: market === m ? c.color : "#fff",
                  color: market === m ? "#fff" : "#6b7280",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.12s",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}>{m}</button>
              ))}
            </div>
          </div>

          {/* Context line */}
          {!result && !running && (
            <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
              You'll get a <strong style={{ color: "#374151" }}>{purpose.displayName.toLowerCase()}</strong> result for <strong style={{ color: "#374151" }}>{market}</strong> from a live market API. No setup needed.
            </div>
          )}

          {/* Run button */}
          <button
            onClick={run} disabled={running}
            style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none",
              background: running ? "#d1d5db" : c.color, color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: running ? "default" : "pointer",
              marginBottom: 6, transition: "all 0.15s",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {running ? "Running..." : result ? `Run again for ${market}` : `${purpose.action} for ${market}`}
          </button>
          <div style={{ textAlign: "center", color: "#d1d5db", fontSize: 11, marginBottom: 20, fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {toCredits(agent.price_per_request)} credit{toCredits(agent.price_per_request) !== 1 ? "s" : ""} · live API call
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#b91c1c", marginBottom: 16 }}>{error}</div>
          )}

          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Insight */}
              {insight && tone && (
                <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 12, padding: "16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>What this means</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: tone.color, lineHeight: 1.6 }}>
                    {insight.text}
                  </div>
                </div>
              )}

              {/* Raw data */}
              {entries.length > 0 && (
                <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>
                    Raw Data — {market}
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

              {/* Combine with */}
              {pairSuggestions.length > 0 && (
                <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Combine it with</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Add these to build a complete signal:</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {pairSuggestions.map(a => {
                      const pc = cat(a.category);
                      const pp = agentPurpose(a);
                      return (
                        <span key={a.id} style={{ background: pc.pill, color: pc.color, border: `1px solid ${pc.color}30`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}>
                          {pp.displayName}
                        </span>
                      );
                    })}
                  </div>
                  <a href="/build" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#0ea5e9", color: "#fff", borderRadius: 10, padding: "11px", fontSize: 12, fontWeight: 700, textDecoration: "none", fontFamily: "system-ui, -apple-system, sans-serif" }}>
                    Build this pipeline →
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
  const purpose = agentPurpose(agent);
  const [hov, setHov] = useState(false);
  const [tryHov, setTryHov] = useState(false);
  const verified = !!(agent.health_endpoint || agent.status === "active");

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "16px",
        display: "flex", flexDirection: "column",
        transition: "all 0.18s",
        boxShadow: hov ? `0 8px 28px rgba(0,0,0,0.11)` : "0 2px 12px rgba(0,0,0,0.07)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        transform: hov ? "translateY(-1px)" : "none",
      }}
    >
      {/* Icon row + TRY button */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <CatIcon category={agent.category} size={44} />
          {verified && (
            <div title="Active agent" style={{
              position: "absolute", bottom: -2, right: -2,
              width: 14, height: 14, borderRadius: "50%",
              background: "#10b981", border: "2px solid #fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "#fff", fontSize: 7, fontWeight: 900 }}>✓</span>
            </div>
          )}
        </div>
        <button
          onClick={() => onTry(agent)}
          onMouseEnter={() => setTryHov(true)}
          onMouseLeave={() => setTryHov(false)}
          style={{
            padding: "6px 12px", borderRadius: 20,
            border: `1.5px solid ${c.color}`,
            background: tryHov ? c.color : "#fff",
            color: tryHov ? "#fff" : c.color,
            fontSize: 10, fontWeight: 700, cursor: "pointer",
            transition: "all 0.12s",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: 0.3,
          }}
        >
          TRY →
        </button>
      </div>

      {/* Name */}
      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", lineHeight: 1.3, marginBottom: 4 }}>
        {purpose.displayName}
      </div>

      {/* Category pill */}
      <div style={{ marginBottom: 6 }}>
        <span style={{ background: c.pill, color: c.color, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.7 }}>
          {c.label}
        </span>
      </div>

      {/* Tagline */}
      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.55, flex: 1, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {purpose.tagline}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#f3f4f6", marginBottom: 10 }} />

      {/* Credits */}
      <div style={{ fontSize: 10, color: "#d1d5db", marginBottom: 8 }}>
        {toCredits(agent.price_per_request)} cr/call
      </div>

      {/* Pipeline link */}
      <a href="/build" style={{
        display: "block", textAlign: "center",
        color: c.color, fontSize: 10, fontWeight: 600,
        textDecoration: "none",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        + Pipeline
      </a>
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTER_CATS = [
  { id: "all",       label: "All" },
  { id: "trading",   label: "Trading" },
  { id: "data",      label: "Market Data" },
  { id: "analysis",  label: "Analysis" },
  { id: "risk",      label: "Risk" },
  { id: "composite", label: "Workflows" },
];

function FilterTabs({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
      {FILTER_CATS.map(({ id, label }) => {
        const on = active === id;
        const color = id === "all" ? "#6b7280" : cat(id).color;
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            cursor: "pointer", transition: "all 0.12s",
            border: on ? `1.5px solid ${color}` : "1.5px solid #e5e7eb",
            background: on ? color : "#fff",
            color: on ? "#fff" : "#6b7280",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}>
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
  const [search,    setSearch]    = useState("");

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
    const base = filter === "all" ? regular : agents.filter(a => a.category === filter);
    if (!search) return base;
    const q = search.toLowerCase();
    return base.filter(a => {
      const p = agentPurpose(a);
      return p.displayName.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q);
    });
  }, [agents, regular, filter, search]);

  const showComposites = filter === "all" && composites.length > 0;

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#f5f5f7", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Hero */}
      <div style={{ background: "#fff", padding: "32px 40px", borderBottom: "1px solid #e5e7eb" }}>
        {!backendOk && (
          <div style={{ marginBottom: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 16px", color: "#b91c1c", fontSize: 12, fontWeight: 600 }}>
            Backend offline — agents unavailable right now.
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.5px", marginBottom: 4 }}>
              Agent Store
            </div>
            <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
              AI agents for live market intelligence — try any in one click
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { value: agents.length || "—", label: `Agent${agents.length !== 1 ? "s" : ""}` },
              { value: "Live Data", label: null },
              { value: "Pay per use", label: null },
            ].map((s, i) => (
              <div key={i} style={{
                background: "#f5f5f7", borderRadius: 20, padding: "6px 14px",
                fontSize: 12, fontWeight: 600, color: "#374151",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {s.label ? <><span style={{ fontWeight: 800, color: "#111827" }}>{s.value}</span> <span style={{ color: "#6b7280" }}>{s.label}</span></> : s.value}
              </div>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 14, pointerEvents: "none" }}>
            ⌕
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents..."
            style={{
              width: "100%",
              padding: "11px 16px 11px 38px",
              borderRadius: 999,
              border: "1.5px solid #e5e7eb",
              background: "#f9fafb",
              fontSize: 14,
              color: "#111827",
              outline: "none",
              fontFamily: "system-ui, -apple-system, sans-serif",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={e => e.target.style.borderColor = "#3b82f6"}
            onBlur={e => e.target.style.borderColor = "#e5e7eb"}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>

        <FeaturedWorkflows />

        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>All Agents</div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>pick one and try it in one click</div>
          {search && <div style={{ fontSize: 12, color: "#6b7280", marginLeft: 4 }}>— {visible.length} result{visible.length !== 1 ? "s" : ""} for "{search}"</div>}
        </div>

        <FilterTabs active={filter} onChange={v => { setFilter(v); setSearch(""); }} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 28 }}>
          {visible.map(a => <AgentCard key={a.id} agent={a} onTry={setTryAgent} />)}
          {visible.length === 0 && (
            <div style={{ gridColumn: "1 / -1", background: "#fff", borderRadius: 16, padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: 13, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              {search ? `No agents match "${search}".` : "No agents in this category yet."}
            </div>
          )}
        </div>

        {showComposites && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Full Workflows</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Multi-agent pipelines deployed as a single callable agent</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 28 }}>
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
