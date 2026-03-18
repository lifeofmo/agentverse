"use client";

import { useEffect, useState, useMemo } from "react";
import { API } from "@/app/lib/config";
import { fetchWithX402 } from "@/app/lib/x402";
import { useWallet } from "./WalletProvider";

// ── Palette ───────────────────────────────────────────────────────────────────
const CAT = {
  trading:   { border: "#6BCF8B", bg: "#f0fdf5", text: "#1a5c3a", label: "Trading Signals", letter: "T" },
  analysis:  { border: "#B59CE6", bg: "#f8f5ff", text: "#3d2580", label: "Analysis",         letter: "A" },
  data:      { border: "#6BB6E6", bg: "#f0f8ff", text: "#1a4d7a", label: "Market Data",      letter: "D" },
  risk:      { border: "#E67B7B", bg: "#fff4f4", text: "#7a1a1a", label: "Risk & Portfolio",  letter: "R" },
  composite: { border: "#E6C36B", bg: "#fffcf0", text: "#7a5a0a", label: "Full Workflows",   letter: "C" },
  default:   { border: "#9aabb8", bg: "#f5f7fa", text: "#3d5470", label: "Other",            letter: "·" },
};
const cat = (c) => CAT[c] ?? CAT.default;
const toCredits = (usd) => Math.max(1, Math.round(usd * 100));

// ── Human-readable key map ────────────────────────────────────────────────────
const KEY_MAP = {
  price_usd:        { label: "Price",            fmt: v => `$${Number(v).toLocaleString()}` },
  change_24h_pct:   { label: "24h Change",       fmt: v => `${v > 0 ? "+" : ""}${Number(v).toFixed(2)}%` },
  signal:           { label: "Signal",           fmt: v => String(v).toUpperCase() },
  confidence:       { label: "Confidence",       fmt: v => `${Math.round(Number(v) * 100)}%` },
  momentum_score:   { label: "Momentum",         fmt: v => Number(v).toFixed(2) },
  fear_greed_value: { label: "Fear & Greed",     fmt: v => `${v} / 100` },
  fear_greed_label: { label: "Sentiment",        fmt: v => String(v) },
  volatility:       { label: "Volatility",       fmt: v => Number(v).toFixed(3) },
  regime:           { label: "Market Regime",    fmt: v => String(v).toUpperCase() },
  opportunity:      { label: "Opportunity",      fmt: v => String(v).toUpperCase() },
  spread_pct:       { label: "Price Spread",     fmt: v => `${Number(v).toFixed(3)}%` },
  liquidity_score:  { label: "Liquidity",        fmt: v => `${Number(v).toFixed(1)} / 10` },
  trend:            { label: "Trend",            fmt: v => String(v).toUpperCase() },
  strength:         { label: "Strength",         fmt: v => Number(v).toFixed(2) },
  risk_score:       { label: "Risk Score",       fmt: v => `${Number(v).toFixed(1)} / 10` },
  sharpe_ratio:     { label: "Sharpe Ratio",     fmt: v => Number(v).toFixed(2) },
  recommendation:   { label: "Recommendation",   fmt: v => String(v).toUpperCase() },
  pattern:          { label: "Pattern",          fmt: v => String(v) },
  var_pct:          { label: "Value at Risk",    fmt: v => `${Number(v).toFixed(2)}%` },
  max_drawdown:     { label: "Max Drawdown",     fmt: v => `${Number(v).toFixed(2)}%` },
  depth_score:      { label: "Depth Score",      fmt: v => Number(v).toFixed(2) },
  correlation:      { label: "Correlation",      fmt: v => Number(v).toFixed(2) },
};
const SKIP = new Set(["market", "agent_id", "_mock", "source", "exchange_a", "exchange_b",
  "reference_price", "high_24h", "low_24h", "volume_24h_usd"]);

// ── What this means ───────────────────────────────────────────────────────────
function getInsight(result) {
  if (!result) return null;
  if (result.signal === "BUY")        return { text: "Strong buy signal — momentum and conditions favor entering a position.", color: "#065f46", bg: "#d1fae5" };
  if (result.signal === "SELL")       return { text: "Bearish signal — consider reducing exposure or waiting for a reversal.", color: "#991b1b", bg: "#fee2e2" };
  if (result.signal === "HOLD")       return { text: "Mixed signals right now — no clear edge. Wait for confirmation before acting.", color: "#92400e", bg: "#fef3c7" };
  if (result.opportunity === "HIGH")  return { text: `Price gap detected: ${Number(result.spread_pct || 0).toFixed(3)}% spread across exchanges — potential arbitrage window.`, color: "#1a4d7a", bg: "#dbeafe" };
  if (result.opportunity === "LOW")   return { text: "No significant arbitrage gap at the moment. Markets are closely aligned.", color: "#6b7d92", bg: "#f5f7fa" };
  if ((result.fear_greed_value ?? 50) < 25) return { text: "Extreme fear in the market — historically a contrarian buy signal. Risk is high but so is potential reward.", color: "#065f46", bg: "#d1fae5" };
  if ((result.fear_greed_value ?? 50) > 75) return { text: "Extreme greed — market may be overextended. Consider locking in profits.", color: "#991b1b", bg: "#fee2e2" };
  if (result.trend === "UPTREND")     return { text: "Market is trending up — bulls are in control. Momentum favors long positions.", color: "#065f46", bg: "#d1fae5" };
  if (result.trend === "DOWNTREND")   return { text: "Downtrend in progress — bears are in control. Be cautious with longs.", color: "#991b1b", bg: "#fee2e2" };
  if (result.trend === "SIDEWAYS")    return { text: "No clear trend — market is consolidating. Wait for a breakout before committing.", color: "#92400e", bg: "#fef3c7" };
  if ((result.risk_score ?? 5) > 7)  return { text: "High risk environment — reduce position sizes and tighten stop losses.", color: "#991b1b", bg: "#fee2e2" };
  if ((result.risk_score ?? 5) < 4)  return { text: "Low risk conditions — market is stable and volatility is subdued.", color: "#065f46", bg: "#d1fae5" };
  if (result.price_usd)               return { text: `Live price fetched. Feed this into a Momentum or Sentiment agent to get a trading signal.`, color: "#1a4d7a", bg: "#dbeafe" };
  return { text: "Agent returned live market data successfully.", color: "#3d5470", bg: "#f5f7fa" };
}

// ── Pair suggestions ──────────────────────────────────────────────────────────
const PAIRS = {
  trading:   ["PriceFeedAgent", "SentimentAgent", "TrendAnalyzer"],
  data:      ["MomentumAgent", "SentimentAgent", "TrendAnalyzer"],
  analysis:  ["MomentumAgent", "RiskAgent", "PriceFeedAgent"],
  risk:      ["TrendAnalyzer", "VolatilityScanner", "CorrelationAgent"],
  composite: ["PriceFeedAgent", "SentimentAgent"],
};

const MARKETS = ["BTC", "ETH", "SOL", "AVAX", "BNB"];

// ── Featured Workflows ────────────────────────────────────────────────────────
const WORKFLOWS = [
  {
    name: "Market Signal",
    tagline: "Get a live BUY/SELL/HOLD call on any crypto asset",
    steps: ["Price Feed", "Sentiment", "Momentum"],
    output: "Signal · Confidence · Momentum score",
    color: "#6BCF8B",
  },
  {
    name: "Risk Check",
    tagline: "Know your exposure before entering a trade",
    steps: ["Volatility", "Risk Score", "Portfolio Optimizer"],
    output: "Risk score · VaR · Recommended allocation",
    color: "#E67B7B",
  },
  {
    name: "Opportunity Scan",
    tagline: "Find price gaps and trend breakouts across markets",
    steps: ["Arbitrage", "Trend Analyzer", "Correlation"],
    output: "Spread % · Trend direction · Market regime",
    color: "#6BB6E6",
  },
];

function FeaturedWorkflows() {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 15 }}>Pre-built Workflows</div>
        <div style={{ color: "#9aabb8", fontSize: 12 }}>Chain agents to get real market intelligence</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {WORKFLOWS.map((w) => (
          <a key={w.name} href="/build" style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "#fff", borderRadius: 14, padding: "16px 18px",
                border: `1px solid ${w.color}25`, borderTop: `3px solid ${w.color}`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "box-shadow 0.18s", cursor: "pointer",
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = `0 6px 24px ${w.color}28`}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"}
            >
              <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{w.name}</div>
              <div style={{ color: "#6b7d92", fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>{w.tagline}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                {w.steps.map((s, i) => (
                  <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ background: `${w.color}18`, color: w.color, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{s}</span>
                    {i < w.steps.length - 1 && <span style={{ color: "#c8d4e0", fontSize: 12 }}>→</span>}
                  </span>
                ))}
              </div>
              <div style={{ color: "#9aabb8", fontSize: 10 }}>Returns: {w.output}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── PlazaTree ─────────────────────────────────────────────────────────────────
function PlazaTree({ size = 32 }) {
  const trunk = Math.round(size * 0.22);
  return (
    <div style={{ width: size, height: size + trunk, position: "relative", flexShrink: 0, userSelect: "none" }}>
      <div style={{ width: size, height: size, background: "#6BCF8B", borderRadius: "50% 50% 42% 42%", position: "absolute", top: 0, boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.10)" }} />
      <div style={{ width: trunk, height: trunk, background: "#c4a070", borderRadius: 3, position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)" }} />
    </div>
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

  const runAgent = async () => {
    setRunning(true); setResult(null); setError(null);
    try {
      const opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market }) };
      const res = await fetchWithX402(`${API}/call-agent/${agent.id}`, opts, walletClient, account);
      if (!res.ok) { setError("Agent returned an error. Try again."); return; }
      setResult(await res.json());
    } catch {
      setError("Could not reach the agent. Check your connection.");
    } finally {
      setRunning(false);
    }
  };

  const insight = getInsight(result);
  const entries = result
    ? Object.entries(result).filter(([k, v]) => !SKIP.has(k) && KEY_MAP[k] && v !== null && v !== undefined).slice(0, 6)
    : [];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>

        {/* Modal header */}
        <div style={{ background: c.bg, borderBottom: `3px solid ${c.border}`, padding: "20px 24px", position: "sticky", top: 0, zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: c.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                {c.letter}
              </div>
              <div>
                <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 17 }}>{agent.name}</div>
                <div style={{ color: c.border, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{c.label}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#9aabb8", fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
          </div>
          <p style={{ margin: "12px 0 0", color: "#6b7d92", fontSize: 13, lineHeight: 1.6 }}>
            {agent.description || "Calls a live market API and returns real data."}
          </p>
        </div>

        {/* Modal body */}
        <div style={{ padding: "20px 24px" }}>

          {/* Market picker */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#9aabb8", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Choose a market</div>
            <div style={{ display: "flex", gap: 6 }}>
              {MARKETS.map(m => (
                <button key={m} onClick={() => { setMarket(m); setResult(null); }} style={{
                  padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", transition: "all 0.15s",
                  background: market === m ? c.border : "#f0ece6",
                  color: market === m ? "#fff" : "#9aabb8",
                }}>{m}</button>
              ))}
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runAgent} disabled={running}
            style={{
              width: "100%", background: running ? "#e6d6bd" : c.border, color: "#fff",
              border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 800,
              cursor: running ? "default" : "pointer", marginBottom: 8, transition: "all 0.15s",
            }}
          >
            {running ? "Running…" : result ? `Run Again on ${market}` : `Run on ${market}`}
          </button>
          <div style={{ textAlign: "center", color: "#c8d4e0", fontSize: 11, marginBottom: 16 }}>
            {toCredits(agent.price_per_request)} credit{toCredits(agent.price_per_request) !== 1 ? "s" : ""} per call · 1 credit = $0.01
          </div>

          {error && (
            <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "10px 14px", fontSize: 12, marginBottom: 14 }}>{error}</div>
          )}

          {/* Results */}
          {result && (
            <>
              {/* Insight */}
              {insight && (
                <div style={{ background: insight.bg, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                  <div style={{ color: "#9aabb8", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>What this means</div>
                  <div style={{ color: insight.color, fontSize: 13, fontWeight: 600, lineHeight: 1.6 }}>{insight.text}</div>
                </div>
              )}

              {/* Data */}
              {entries.length > 0 && (
                <div style={{ background: "#f8f6f2", borderRadius: 10, padding: "14px", marginBottom: 14 }}>
                  <div style={{ color: "#9aabb8", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Live Data — {market}</div>
                  {entries.map(([k, v]) => {
                    const def = KEY_MAP[k];
                    return (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f0ece6" }}>
                        <span style={{ color: "#9aabb8", fontSize: 12 }}>{def.label}</span>
                        <span style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 13 }}>{def.fmt(v)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pair with */}
              {pairSuggestions.length > 0 && (
                <div style={{ background: "#f0f8ff", border: "1px solid #6BB6E620", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ color: "#9aabb8", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>What to combine it with</div>
                  <div style={{ color: "#6b7d92", fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>
                    Chain this agent with these to build a more complete signal:
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {pairSuggestions.map(a => {
                      const pc = cat(a.category);
                      return (
                        <span key={a.id} style={{ background: `${pc.border}15`, border: `1px solid ${pc.border}35`, borderRadius: 8, padding: "5px 12px", fontSize: 11, color: pc.border, fontWeight: 700 }}>
                          {a.name}
                        </span>
                      );
                    })}
                  </div>
                  <a href="/build" style={{ display: "block", textAlign: "center", background: "#4a9fd4", color: "#fff", borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                    Open Pipeline Builder to chain them →
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────
function AgentCard({ agent, onTry }) {
  const c = cat(agent.category);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        border: `1px solid ${hovered ? c.border : "#e6d6bd"}`,
        borderTop: `3px solid ${c.border}`,
        borderRadius: 14, padding: "18px",
        boxShadow: hovered ? `0 6px 24px ${c.border}28` : "0 2px 10px rgba(0,0,0,0.06)",
        transition: "all 0.18s", display: "flex", flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: c.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 17, flexShrink: 0 }}>
          {c.letter}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>{agent.name}</div>
          <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ background: `${c.border}18`, color: c.border, borderRadius: 4, padding: "1px 7px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7 }}>{c.label}</span>
            <span style={{ background: "#f0ece6", color: "#9aabb8", borderRadius: 4, padding: "1px 7px", fontSize: 9, fontWeight: 600 }}>{toCredits(agent.price_per_request)} cr/call</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{ color: "#6b7d92", fontSize: 12, lineHeight: 1.65, marginBottom: 18, flex: 1 }}>
        {agent.description || "Calls a live market API and returns real-time data."}
      </div>

      {/* Primary CTA */}
      <button
        onClick={() => onTry(agent)}
        style={{
          width: "100%", background: c.border, color: "#fff", border: "none",
          borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 800,
          cursor: "pointer", marginBottom: 8, transition: "opacity 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        Try Live
      </button>

      {/* Secondary CTA */}
      <a href="/build" style={{
        display: "block", textAlign: "center",
        background: `${c.border}10`, color: c.border,
        border: `1px solid ${c.border}25`, borderRadius: 9, padding: "8px",
        fontSize: 11, fontWeight: 700, textDecoration: "none",
      }}>
        + Add to Pipeline
      </a>
    </div>
  );
}

// ── Filter strip ──────────────────────────────────────────────────────────────
const FILTER_CATS = [
  { id: "all",       label: "All Agents" },
  { id: "trading",   label: "Trading Signals" },
  { id: "data",      label: "Market Data" },
  { id: "analysis",  label: "Analysis" },
  { id: "risk",      label: "Risk & Portfolio" },
  { id: "composite", label: "Full Workflows" },
];

function FilterStrip({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
      {FILTER_CATS.map(({ id, label }) => {
        const on = active === id;
        const color = id === "all" ? "#4a9fd4" : cat(id).border;
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            padding: "6px 16px", borderRadius: 20, fontSize: 11, fontWeight: 700,
            cursor: "pointer", transition: "all 0.15s",
            border: on ? `1px solid ${color}50` : "1px solid #e6d6bd",
            background: on ? `${color}14` : "#fff",
            color: on ? color : "#9aabb8",
          }}>{label}</button>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MarketplaceView() {
  const [agents,   setAgents]   = useState([]);
  const [filter,   setFilter]   = useState("all");
  const [tryAgent, setTryAgent] = useState(null);
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
  const composites = useMemo(() => agents.filter(a => a.category === "composite"), [agents]);

  const visible = useMemo(() => {
    if (filter === "all") return regular;
    return agents.filter(a => a.category === filter);
  }, [agents, regular, filter]);

  const showCompositeSection = filter === "all" && composites.length > 0;

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#f4e7d0", padding: "32px 40px", fontFamily: "inherit" }}>

      {!backendOk && (
        <div style={{ marginBottom: 16, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 16px", color: "#991b1b", fontSize: 12, fontWeight: 600 }}>
          Backend offline — agents unavailable right now.
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 28 }}>
        <PlazaTree size={36} />
        <div style={{ flex: 1 }}>
          <div style={{ color: "#2d3a4a", fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px" }}>Agent Marketplace</div>
          <div style={{ color: "#9aabb8", fontSize: 13, marginTop: 5 }}>
            {agents.length} live agents · Each calls a real API and returns real data · Pay per use
          </div>
        </div>
        <PlazaTree size={28} />
      </div>

      {/* Featured Workflows */}
      <FeaturedWorkflows />

      {/* Filter */}
      <FilterStrip active={filter} onChange={setFilter} />

      {/* Agent grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
        {visible.map(a => <AgentCard key={a.id} agent={a} onTry={setTryAgent} />)}
        {visible.length === 0 && (
          <div style={{ background: "#fff", border: "1px solid #e6d6bd", borderRadius: 14, padding: "40px 32px", color: "#9aabb8", fontSize: 14, fontStyle: "italic" }}>
            No agents in this category yet.
          </div>
        )}
      </div>

      {/* Full Workflows section (composite agents) */}
      {showCompositeSection && (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14, paddingTop: 8, borderTop: "1px solid #e6d6bd" }}>
            <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 15 }}>Full Workflows</div>
            <div style={{ color: "#9aabb8", fontSize: 12 }}>Multi-agent pipelines registered as a single callable agent</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
            {composites.map(a => <AgentCard key={a.id} agent={a} onTry={setTryAgent} />)}
          </div>
        </>
      )}

      <div style={{ height: 40 }} />

      {/* Try Agent Modal */}
      {tryAgent && (
        <TryAgentModal agent={tryAgent} allAgents={agents} onClose={() => setTryAgent(null)} />
      )}
    </div>
  );
}
