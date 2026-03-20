"use client";

import { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
import ReactFlow, {
  Background, Controls,
  addEdge, useNodesState, useEdgesState,
  Handle, Position, ReactFlowProvider,
  getBezierPath, useViewport,
} from "reactflow";
import "reactflow/dist/style.css";

import { API, WS } from "@/app/lib/config";

// ── Agent purpose map (same as Marketplace) ────────────────────────────────────
const AGENT_PURPOSE = {
  MomentumAgent:      { displayName: "Trading Signal",        tagline: "BUY / SELL / HOLD signal",           action: "Get Signal" },
  SentimentAgent:     { displayName: "Sentiment Analyzer",    tagline: "Fear & greed index",                 action: "Check Sentiment" },
  PriceFeedAgent:     { displayName: "Live Price Feed",       tagline: "Real-time price + 24h change",       action: "Get Price" },
  TrendAnalyzer:      { displayName: "Trend Detector",        tagline: "Up / down / sideways",               action: "Detect Trend" },
  RiskAgent:          { displayName: "Risk Scanner",          tagline: "Volatility & downside risk",         action: "Scan Risk" },
  ArbitrageAgent:     { displayName: "Arbitrage Finder",      tagline: "Price gaps across exchanges",        action: "Find Gaps" },
  VolatilityScanner:  { displayName: "Volatility Meter",      tagline: "Current volatility level",           action: "Measure" },
  CorrelationAgent:   { displayName: "Correlation Tracker",   tagline: "How assets move together",           action: "Check Correlation" },
  PortfolioOptimizer: { displayName: "Portfolio Optimizer",   tagline: "Ideal allocation weights",           action: "Optimize" },
  PatternRecognizer:  { displayName: "Chart Pattern Scanner", tagline: "Technical patterns forming",         action: "Scan Patterns" },
  LiquidityAnalyzer:  { displayName: "Liquidity Analyzer",    tagline: "Buying & selling pressure",          action: "Check Liquidity" },
  MarketDepthAgent:   { displayName: "Market Depth Agent",    tagline: "Order book price direction",         action: "Read Depth" },
};
function agentPurpose(nameOrAgent) {
  const name = typeof nameOrAgent === "string" ? nameOrAgent : nameOrAgent?.name;
  return AGENT_PURPOSE[name] ?? { displayName: name, tagline: "Live market data", action: "Run" };
}


// ── Category palette ──────────────────────────────────────────────────────────

const CAT = {
  trading:   { color: "#10b981", pill: "#ecfdf5", icon: "📈", label: "Trading"    },
  analysis:  { color: "#8b5cf6", pill: "#f5f3ff", icon: "🔍", label: "Analysis"   },
  data:      { color: "#3b82f6", pill: "#eff6ff", icon: "⚡", label: "Market Data" },
  risk:      { color: "#ef4444", pill: "#fef2f2", icon: "🛡️", label: "Risk"       },
  composite: { color: "#f59e0b", pill: "#fffbeb", icon: "🔗", label: "Workflow"   },
  default:   { color: "#6b7280", pill: "#f9fafb", icon: "🤖", label: "Agent"      },
};
// back-compat aliases used by older code paths
const cat = (c) => {
  const v = CAT[c] ?? CAT.default;
  return { ...v, border: v.color, bg: v.pill, text: v.color, glow: `${v.color}40` };
};

const CAT_ORDER = ["trading", "analysis", "data", "risk", "composite"];
const CAT_LABELS = { trading: "Trading", analysis: "Analysis", data: "Market Data", risk: "Risk", composite: "Workflows" };

// ── Category dot ───────────────────────────────────────────────────────────────
function CatDot({ category, size = 11 }) {
  const c = cat(category);
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: c.color, flexShrink: 0 }} />;
}

// ── CSS keyframes injected once ───────────────────────────────────────────────

const GLOBAL_CSS = `
@keyframes floatUp {
  0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-32px); }
}
@keyframes nodePulse {
  0%   { box-shadow: 0 0 0 0 var(--pulse-color); }
  60%  { box-shadow: 0 0 0 14px rgba(0,0,0,0); }
  100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
}
.agent-node-active { animation: nodePulse 0.9s ease-out infinite; }
`;

// ── Canvas dot grid ───────────────────────────────────────────────────────────

function CanvasGrid() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const gap = 32;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      for (let x = gap / 2; x < canvas.width; x += gap) {
        for (let y = gap / 2; y < canvas.height; y += gap) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />;
}

// ── Pipe edge ─────────────────────────────────────────────────────────────────

function ParticleEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, data = {} }) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const pathId = `ep-${id}`;
  const color  = style.stroke || "#3b82f6";
  const dashes = style.strokeDasharray;
  const active = !!data.particles;
  const offsets = useMemo(() => [0, 0.35, 0.7], []);
  return (
    <g>
      <path d={edgePath} fill="none" stroke={`${color}14`} strokeWidth={14} strokeLinecap="round" strokeDasharray={dashes} />
      <path d={edgePath} fill="none" stroke={`${color}30`} strokeWidth={8}  strokeLinecap="round" strokeDasharray={dashes} />
      <path id={pathId} d={edgePath} fill="none" stroke={active ? color : `${color}50`}
        strokeWidth={active ? 2.5 : 1.5} strokeLinecap="round" strokeDasharray={dashes}
        style={active ? { filter: `drop-shadow(0 0 5px ${color})` } : undefined} />
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={18} />
      {active && offsets.map((offset, i) => (
        <circle key={i} r={4.5 - i * 1} fill={color} filter={`drop-shadow(0 0 6px ${color})`} opacity={1 - i * 0.28}>
          <animateMotion dur={`${data.speed || 1.3}s`} begin={`${-offset * (data.speed || 1.3)}s`}
            repeatCount="indefinite" rotate="none">
            <mpath xlinkHref={`#${pathId}`} />
          </animateMotion>
        </circle>
      ))}
    </g>
  );
}

const edgeTypes = { particle: ParticleEdge };

// ── Node components ───────────────────────────────────────────────────────────

// Shared node card shell
function NodeShell({ color, selected, active, revenueFlash, children, minW = 160 }) {
  return (
    <div className={active ? "agent-node-active" : ""} style={{
      "--pulse-color": `${color}50`,
      background: "#fff",
      border: selected ? `2px solid ${color}` : "2px solid rgba(255,255,255,0.12)",
      borderRadius: 14,
      padding: "12px 14px",
      minWidth: minW,
      cursor: "pointer", position: "relative",
      boxShadow: selected
        ? `0 0 0 3px ${color}30, 0 8px 32px rgba(0,0,0,0.35)`
        : "0 4px 20px rgba(0,0,0,0.28)",
      transition: "border-color 0.18s, box-shadow 0.18s",
    }}>
      {revenueFlash && (
        <div style={{ position: "absolute", top: -24, left: "50%",
          color: "#10b981", fontWeight: 800, fontSize: 12,
          animation: "floatUp 1.5s ease-out forwards", pointerEvents: "none",
          whiteSpace: "nowrap" }}>
          ↑ {revenueFlash}
        </div>
      )}
      {children}
    </div>
  );
}

const AgentNode = memo(({ data, selected }) => {
  const { zoom }  = useViewport();
  const c = cat(data.category);
  const p = agentPurpose(data.label);
  const showDetails = zoom > 0.55;

  // Pick best single value from lastOutput to show on node
  const out = data.lastOutput || {};
  const highlight = out.signal || out.trend || out.opportunity;

  return (
    <NodeShell color={c.color} selected={selected}
      active={data.active} revenueFlash={data.revenueFlash}>
      <Handle type="target" position={Position.Left}
        style={{ background: c.color, border: "2px solid #fff", width: 10, height: 10, left: -6 }} />

      {/* Icon + category */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, background: c.pill, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
          {c.icon}
        </div>
        <span style={{ background: c.pill, color: c.color, fontSize: 9, fontWeight: 700,
          padding: "2px 7px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.6 }}>
          {c.label}
        </span>
      </div>

      {/* Name */}
      <div style={{ color: "#111827", fontWeight: 700, fontSize: 13, lineHeight: 1.2, marginBottom: showDetails ? 4 : 0 }}>
        {p.displayName}
      </div>

      {/* Live output highlight */}
      {showDetails && highlight && (
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800,
          color: highlight === "BUY" || highlight === "UPTREND" || highlight === "HIGH" ? "#10b981"
               : highlight === "SELL" || highlight === "DOWNTREND" ? "#ef4444"
               : "#f59e0b" }}>
          {highlight}
        </div>
      )}
      {showDetails && out.price_usd && !highlight && (
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
          ${Number(out.price_usd).toLocaleString()}
        </div>
      )}
      {showDetails && out.confidence != null && (
        <div style={{ fontSize: 10, color: "#9ca3af" }}>
          {Math.round(Number(out.confidence) * 100)}% confidence
        </div>
      )}

      {data.active && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.color,
            animation: "nodePulse 0.9s ease-out infinite", "--pulse-color": `${c.color}40` }} />
          <span style={{ color: c.color, fontSize: 10, fontWeight: 700 }}>running…</span>
        </div>
      )}

      <Handle type="source" position={Position.Right}
        style={{ background: c.color, border: "2px solid #fff", width: 10, height: 10, right: -6 }} />
    </NodeShell>
  );
});
AgentNode.displayName = "AgentNode";

const CompositeNode = memo(({ data, selected }) => {
  const { zoom } = useViewport();
  const c = cat("composite");
  const p = agentPurpose(data.label);
  return (
    <NodeShell color={c.color} selected={selected} active={data.active} minW={175}>
      <Handle type="target" position={Position.Left}
        style={{ background: c.color, border: "2px solid #fff", width: 10, height: 10, left: -6 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, background: c.pill, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{c.icon}</div>
        <span style={{ background: c.pill, color: c.color, fontSize: 9, fontWeight: 700,
          padding: "2px 7px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.6 }}>Workflow</span>
      </div>
      <div style={{ color: "#111827", fontWeight: 700, fontSize: 13 }}>{p.displayName}</div>
      {zoom > 0.55 && data.requests > 0 && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#9ca3af" }}>
          {data.requests} runs
        </div>
      )}
      <Handle type="source" position={Position.Right}
        style={{ background: c.color, border: "2px solid #fff", width: 10, height: 10, right: -6 }} />
    </NodeShell>
  );
});
CompositeNode.displayName = "CompositeNode";

const PipelineNode = memo(({ data, selected }) => (
  <NodeShell color="#8b5cf6" selected={selected} minW={200}>
    <Handle type="target" position={Position.Left}
      style={{ background: "#8b5cf6", border: "2px solid #fff", width: 10, height: 10, left: -6 }} />
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <div style={{ width: 32, height: 32, background: "#f5f3ff", borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔗</div>
      <span style={{ background: "#f5f3ff", color: "#8b5cf6", fontSize: 9, fontWeight: 700,
        padding: "2px 7px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.6 }}>Pipeline</span>
    </div>
    <div style={{ color: "#111827", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{data.label}</div>
    {(data.agentNames || []).length > 0 && (
      <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
        {data.agentNames.map((name, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ background: "#f5f3ff", color: "#8b5cf6", borderRadius: 4,
              padding: "2px 6px", fontSize: 9, fontWeight: 600 }}>
              {agentPurpose(name).displayName}
            </span>
            {i < data.agentNames.length - 1 && <span style={{ color: "#c4b5fd", fontSize: 10 }}>→</span>}
          </span>
        ))}
      </div>
    )}
    <Handle type="source" position={Position.Right}
      style={{ background: "#8b5cf6", border: "2px solid #fff", width: 10, height: 10, right: -6 }} />
  </NodeShell>
));
PipelineNode.displayName = "PipelineNode";

const nodeTypes = { agent: AgentNode, composite: CompositeNode, pipeline: PipelineNode };

// ── Edge presets ──────────────────────────────────────────────────────────────

const E_IDLE      = { type: "particle", animated: false, style: { stroke: "rgba(255,255,255,0.2)", strokeWidth: 1.5 }, data: { particles: false } };
const E_PIPE      = { type: "particle", style: { stroke: "#10b981", strokeWidth: 3 }, data: { particles: true, speed: 0.9 } };
const E_PIPE_IDLE = { type: "particle", animated: false, style: { stroke: "#8b5cf6", strokeWidth: 2, strokeDasharray: "6 4" }, data: { particles: false } };

// ── Topo sort ─────────────────────────────────────────────────────────────────

function topoSort(nodes, edges) {
  const inDeg = Object.fromEntries(nodes.map((n) => [n.id, 0]));
  const adj   = Object.fromEntries(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (adj[e.source]) adj[e.source].push(e.target);
    if (inDeg[e.target] !== undefined) inDeg[e.target]++;
  }
  const q = nodes.filter((n) => inDeg[n.id] === 0).map((n) => n.id);
  const res = [];
  while (q.length) {
    const cur = q.shift(); res.push(cur);
    for (const nxt of (adj[cur] || [])) { if (--inDeg[nxt] === 0) q.push(nxt); }
  }
  return res;
}

// ── Demo pipeline builder ─────────────────────────────────────────────────────

function buildDemoCanvas(pipeline, agentMap) {
  const pAgents = (pipeline?.agent_ids || []).map((id) => agentMap[id]).filter(Boolean);
  if (pAgents.length < 2) return { nodes: [], edges: [] };
  const spacing = 260;
  const totalW  = (pAgents.length - 1) * spacing;
  const nodes   = pAgents.map((a, i) => ({
    id:   `demo-${a.id}`,
    type: a.category === "composite" ? "composite" : "agent",
    position: { x: i * spacing - totalW / 2, y: 0 },
    data: { label: a.name, category: a.category, price: a.price_per_request,
            agentId: a.id, requests: 0, latency: 0, earnings: 0, active: false },
  }));
  const edges = nodes.slice(0, -1).map((n, i) => ({
    id: `demo-edge-${i}`, source: n.id, target: nodes[i + 1].id, ...E_PIPE_IDLE,
  }));
  return { nodes, edges };
}

// ── Quick-start templates ─────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "crypto-signal",
    name: "Crypto Signal",
    icon: "",
    tagline: "Get BUY / SELL / HOLD in 10s",
    agents: ["PriceFeedAgent", "SentimentAgent", "MomentumAgent"],
    color: "#10b981",
  },
  {
    id: "market-scanner",
    name: "Market Scanner",
    icon: "",
    tagline: "Detect trends + volatility",
    agents: ["PriceFeedAgent", "TrendAnalyzer", "VolatilityScanner"],
    color: "#3b82f6",
  },
  {
    id: "risk-check",
    name: "Risk Check",
    icon: "",
    tagline: "Evaluate downside risk",
    agents: ["PriceFeedAgent", "RiskAgent", "PortfolioOptimizer"],
    color: "#ef4444",
  },
];

const QUICK_MARKETS = ["BTC", "ETH", "SOL", "AVAX"];

function QuickStartBar({ onSelect, running }) {
  return (
    <div style={{
      position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
      zIndex: 60, display: "flex", alignItems: "center", gap: 8,
      background: "rgba(15,23,42,0.92)", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 16, padding: "10px 14px",
      backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 600, marginRight: 2, whiteSpace: "nowrap" }}>
        Try instantly →
      </div>
      {TEMPLATES.map(t => (
        <button key={t.id} onClick={() => onSelect(t)} disabled={running} style={{
          display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 20,
          background: `${t.color}18`, border: `1px solid ${t.color}40`,
          color: "#fff", fontSize: 12, fontWeight: 600,
          cursor: running ? "not-allowed" : "pointer",
          opacity: running ? 0.5 : 1, transition: "all 0.15s", whiteSpace: "nowrap",
          letterSpacing: 0.1,
        }}
          onMouseEnter={e => !running && (e.currentTarget.style.background = `${t.color}30`)}
          onMouseLeave={e => (e.currentTarget.style.background = `${t.color}18`)}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, display: "inline-block", flexShrink: 0 }} />
          {t.name}
        </button>
      ))}
    </div>
  );
}

// ── Big result card (centers on canvas after auto-run) ────────────────────────

function BigResultCard({ bigResult, onRetry, onSave, onDismiss }) {
  const { results, template, market } = bigResult;

  // Pull values from last agent (signal) and first agent (price)
  const lastResult   = results[template.agents[template.agents.length - 1]] || {};
  const firstResult  = results[template.agents[0]] || {};
  const midResult    = results[template.agents[1]] || {};

  const signal     = lastResult.signal || lastResult.trend || lastResult.opportunity || lastResult.recommendation;
  const confidence = lastResult.confidence;
  const price      = firstResult.price_usd;
  const change     = firstResult.change_24h_pct;
  const sentiment  = midResult.fear_greed_label || midResult.regime;
  const riskScore  = lastResult.risk_score;

  const isGood = signal === "BUY" || signal === "UPTREND" || signal === "HIGH" || (riskScore != null && Number(riskScore) < 4);
  const isBad  = signal === "SELL" || signal === "DOWNTREND" || (riskScore != null && Number(riskScore) > 7);
  const signalColor = isGood ? "#10b981" : isBad ? "#ef4444" : "#f59e0b";
  const signalBg    = isGood ? "#ecfdf5" : isBad ? "#fef2f2" : "#fefce8";

  const insight = (() => {
    if (signal === "BUY")       return `Bullish momentum confirmed — sentiment and price action align upward for ${market}.`;
    if (signal === "SELL")      return `Bearish pressure detected — multiple indicators point downward for ${market}.`;
    if (signal === "HOLD")      return `Mixed signals — ${market} is consolidating. No clear edge right now.`;
    if (signal === "UPTREND")   return `${market} is in an established uptrend. Bulls are in control.`;
    if (signal === "DOWNTREND") return `${market} is trending lower. Proceed with caution on long positions.`;
    if (signal === "HIGH" && template.id === "risk-check") return `High risk environment for ${market}. Reduce position size.`;
    if (signal === "LOW"  && template.id === "risk-check") return `Low volatility — risk conditions are favorable for ${market}.`;
    return `${market} analyzed across ${template.agents.length} live agents. Data fetched in real time.`;
  })();

  const displaySignal = riskScore != null && !signal
    ? `Risk: ${Number(riskScore).toFixed(1)} / 10`
    : signal || "COMPLETE";

  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
      zIndex: 100, width: 400, borderRadius: 24, overflow: "hidden",
      boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
      animation: "spFadeUp 0.4s ease forwards",
    }}>
      {/* Signal header */}
      <div style={{ background: "#fff", borderBottom: `1px solid #f3f4f6`, padding: "24px 24px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              {market} · {template.name}
            </div>
            <div style={{ display: "inline-flex", alignItems: "center" }}>
              <div style={{
                background: signalBg, border: `1.5px solid ${signalColor}30`,
                borderRadius: 12, padding: "8px 20px",
              }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: signalColor, lineHeight: 1, letterSpacing: "-1px" }}>
                  {displaySignal}
                </span>
              </div>
            </div>
            {confidence != null && (
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8, fontWeight: 500 }}>
                {Math.round(Number(confidence) * 100)}% confidence
              </div>
            )}
            {sentiment && (
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                Sentiment: {sentiment}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            {price && (
              <>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Live Price</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>
                  ${Number(price).toLocaleString()}
                </div>
                {change != null && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: Number(change) >= 0 ? "#10b981" : "#ef4444", marginTop: 2 }}>
                    {Number(change) >= 0 ? "+" : ""}{Number(change).toFixed(2)}%
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Insight */}
      <div style={{ background: "#fff", padding: "16px 24px", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{insight}</div>
      </div>

      {/* Market re-run + actions */}
      <div style={{ background: "#fff", padding: "16px 24px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
          Try another market
        </div>
        <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 3, marginBottom: 14, gap: 2 }}>
          {QUICK_MARKETS.map(m => (
            <button key={m} onClick={() => onRetry(template, m)} style={{
              flex: 1, padding: "8px 0", borderRadius: 8,
              border: "none",
              background: m === market ? "#fff" : "transparent",
              color: m === market ? "#111827" : "#6b7280",
              fontSize: 12, fontWeight: m === market ? 700 : 500,
              cursor: "pointer", transition: "all 0.12s",
              boxShadow: m === market ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}>{m}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSave} style={{
            flex: 1, background: "#111827", color: "#fff", border: "none",
            borderRadius: 10, padding: "13px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            letterSpacing: 0.1,
          }}>Save as Agent</button>
          <button onClick={onDismiss} style={{
            flex: 1, background: "#f9fafb", color: "#6b7280", border: "1px solid #e5e7eb",
            borderRadius: 10, padding: "13px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Build manually</button>
        </div>
      </div>
    </div>
  );
}

// ── Agent Library sidebar ─────────────────────────────────────────────────────

function AgentLibrary({ agents, pipelines, collapsed, onToggle }) {
  const agentMap = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a.name])), [agents]);

  const onDragAgent = (e, agent) => {
    e.dataTransfer.setData("application/agentverse", JSON.stringify(agent));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragPipeline = (e, p, agentNames) => {
    e.dataTransfer.setData("application/agentverse",
      JSON.stringify({ _type: "pipeline", id: p.id, name: p.name, agent_ids: p.agent_ids, agentNames }));
    e.dataTransfer.effectAllowed = "move";
  };

  const grouped = useMemo(() => {
    const g = {};
    for (const a of agents) {
      if (a.category === "composite") continue;
      if (!g[a.category]) g[a.category] = [];
      g[a.category].push(a);
    }
    return g;
  }, [agents]);

  const composites = useMemo(() => agents.filter((a) => a.category === "composite"), [agents]);

  return (
    <div style={{
      position: "absolute", left: 16, top: 16, bottom: 16,
      width: collapsed ? 44 : 228,
      background: "#fff", border: "1px solid #e5e7eb",
      borderRadius: 16, zIndex: 50,
      transition: "width 0.2s ease", overflow: "hidden",
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 14px",
        borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
        {!collapsed && (
          <div style={{ flex: 1 }}>
            <div style={{ color: "#111827", fontSize: 12, fontWeight: 700 }}>Agents</div>
            <div style={{ color: "#9ca3af", fontSize: 10, marginTop: 1 }}>drag onto canvas</div>
          </div>
        )}
        <button onClick={onToggle} style={{ background: "none", border: "none",
          color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 0, marginLeft: "auto" }}>
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 16px" }}>

          {/* Grouped agents */}
          {CAT_ORDER.filter((c) => grouped[c]?.length).map((catKey) => {
            const c = cat(catKey);
            return (
              <div key={catKey} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5,
                  marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${c.color}20` }}>
                  <span style={{ fontSize: 12 }}>{c.icon}</span>
                  <span style={{ color: c.color, fontSize: 9, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 1 }}>
                    {CAT_LABELS[catKey]}
                  </span>
                </div>
                {grouped[catKey].map((a) => {
                    const p = agentPurpose(a);
                    return (
                  <div key={a.id} draggable onDragStart={(e) => onDragAgent(e, a)}
                    style={{ background: "#f9fafb", border: "1px solid #e5e7eb",
                      borderLeft: `3px solid ${c.color}`,
                      borderRadius: 8, padding: "8px 9px", marginBottom: 5,
                      cursor: "grab", userSelect: "none",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.boxShadow = `0 2px 8px ${c.color}20`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.boxShadow = "none"; }}>
                    <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 12, lineHeight: 1.2 }}>{p.displayName}</div>
                    <div style={{ color: "#9aabb8", fontSize: 9, marginTop: 2, lineHeight: 1.4 }}>{p.tagline}</div>
                  </div>
                    );
                  })}
              </div>
            );
          })}

          {agents.length === 0 && (
            <div style={{ color: "#9ca3af", fontSize: 11, padding: "20px 4px",
              textAlign: "center", lineHeight: 1.6 }}>
              Loading agents…<br />
              <span style={{ fontSize: 10 }}>Server may be restarting.</span>
            </div>
          )}

          {/* Saved Pipelines */}
          {pipelines.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5,
                marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #8b5cf620" }}>
                <span style={{ fontSize: 12 }}>🔗</span>
                <span style={{ color: "#8b5cf6", fontSize: 9, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 1 }}>Saved Pipelines</span>
              </div>
              {pipelines.map((p) => {
                const names = p.agent_ids.map((id) => agentMap[id] ?? "…");
                return (
                  <div key={p.id} draggable onDragStart={(e) => onDragPipeline(e, p, names)}
                    style={{ background: "#f9fafb", border: "1px solid #e5e7eb",
                      borderLeft: "3px solid #8b5cf6",
                      borderRadius: 8, padding: "8px 9px", marginBottom: 5,
                      cursor: "grab", userSelect: "none", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#fff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#f9fafb"; }}>
                    <div style={{ color: "#111827", fontWeight: 700, fontSize: 12 }}>{p.name}</div>
                    <div style={{ color: "#9ca3af", fontSize: 9, marginTop: 2 }}>
                      {names.slice(0, 3).map(n => agentPurpose(n).displayName).join(" → ")}{names.length > 3 ? " …" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Composite Agents */}
          {composites.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5,
                marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #f59e0b20" }}>
                <span style={{ fontSize: 12 }}>🔗</span>
                <span style={{ color: "#f59e0b", fontSize: 9, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 1 }}>Workflows</span>
              </div>
              {composites.map((a) => {
                const p = agentPurpose(a);
                return (
                <div key={a.id} draggable onDragStart={(e) => onDragAgent(e, a)}
                  style={{ background: "#f9fafb", border: "1px solid #e5e7eb",
                    borderLeft: "3px solid #f59e0b",
                    borderRadius: 8, padding: "8px 9px", marginBottom: 5,
                    cursor: "grab", userSelect: "none", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#f9fafb"; }}>
                  <div style={{ color: "#111827", fontWeight: 700, fontSize: 12 }}>{p.displayName}</div>
                  <div style={{ color: "#9ca3af", fontSize: 9, marginTop: 2 }}>multi-agent workflow</div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Friendly guide bubble ─────────────────────────────────────────────────────

const GUIDE_STEPS = [
  {
    title: "Welcome to the Playground",
    body: "Chain AI agents together to build a real market intelligence pipeline. Each agent fetches live data and passes it to the next — like an assembly line for insights.",
    cta: "Show me",
  },
  {
    title: "Step 1 — Add an agent",
    body: "The left panel lists available agents. Try dragging \"Live Price Feed\" onto the canvas to start — it fetches the latest BTC price.",
    cta: "Got it",
  },
  {
    title: "Step 2 — Add a second agent",
    body: "Drag \"Trading Signal\" onto the canvas. Hover the first agent — a dot appears on its right edge. Drag from that dot to the Trading Signal agent to connect them.",
    cta: "Got it",
  },
  {
    title: "Step 3 — Hit Run",
    body: "Click Run at the bottom toolbar. Watch data flow live: price feeds into the signal agent, which gives you a BUY / SELL / HOLD result in real time.",
    cta: "Got it",
  },
  {
    title: "Save it as a workflow",
    body: "Once it works the way you want, name it and save. You can then deploy it to the Marketplace so others can run your pipeline in one click.",
    cta: "Let's build",
  },
];

function GuideTooltip() {
  const [step, setStep]       = useState(0);
  const [visible, setVisible] = useState(false);
  const [open, setOpen]       = useState(true);

  useEffect(() => {
    if (localStorage.getItem("av_guide_done") !== "1") {
      setVisible(true);
    }
  }, []);

  const next = () => {
    if (step < GUIDE_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      localStorage.setItem("av_guide_done", "1");
      setVisible(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem("av_guide_done", "1");
    setVisible(false);
  };

  const reopen = () => {
    setStep(0);
    setOpen(true);
    setVisible(true);
  };

  const s = GUIDE_STEPS[step];

  return (
    <>
      {/* Re-open button */}
      {!visible && (
        <button onClick={reopen} style={{
          position: "absolute", bottom: 90, left: 256, zIndex: 200,
          background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 20, padding: "6px 14px",
          fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)",
          cursor: "pointer", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>?</span>
          How does this work?
        </button>
      )}

      {/* Guide bubble */}
      {visible && open && (
        <div style={{
          position: "absolute", bottom: 90, left: 256, zIndex: 200,
          width: 280,
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 16, padding: "18px",
          boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
        }}>
          {/* Avatar + dismiss */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>?</span>
            <button onClick={dismiss} style={{ background: "none", border: "none", color: "#d1d5db", fontSize: 11, cursor: "pointer", padding: 0, fontWeight: 600 }}>Skip</button>
          </div>
          {/* Progress bar */}
          <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
            {GUIDE_STEPS.map((_, i) => (
              <div key={i} style={{
                height: 3, flex: i === step ? 2 : 1, borderRadius: 2,
                background: i === step ? "#3b82f6" : i < step ? "#93c5fd" : "#e5e7eb",
                transition: "all 0.3s ease",
              }} />
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{s.title}</div>
          <p style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.65, margin: "0 0 16px 0" }}>
            {s.body}
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={next} style={{
              background: "#3b82f6", border: "none", color: "#fff",
              borderRadius: 8, padding: "8px 18px",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>{s.cta}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Onboarding hints (shown on empty canvas) ─────────────────────────────────

function OnboardingHints() {
  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      transform: "translate(-50%, -50%)",
      textAlign: "center", pointerEvents: "none", zIndex: 10,
    }}>
      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        Build a live market signal pipeline
      </div>
      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 24 }}>
        Drag agents from the left → connect them → hit Run
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {[
          ["①", "Live Price Feed", "drag from left panel"],
          ["②", "Trading Signal", "connect the two"],
          ["③", "Run", "get BUY / SELL / HOLD"],
        ].map(([num, title, sub]) => (
          <div key={num} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14, padding: "16px 14px", minWidth: 120,
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ color: "#3b82f6", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{num}</div>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 700 }}>{title}</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Results panel ─────────────────────────────────────────────────────────────

function ResultsPanel({ results, totalCost, running, onClose }) {
  if (!results.length && !running) return null;
  return (
    <div style={{
      position: "absolute", right: 16, top: 16, width: 248,
      background: "#fff", border: "1px solid #e5e7eb",
      borderTop: "3px solid #10b981",
      borderRadius: 16, padding: "14px", zIndex: 50,
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ color: "#9ca3af", fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 1 }}>Live Results</div>
          {running && (
            <div style={{ color: "#10b981", fontSize: 10, fontWeight: 700, marginTop: 2 }}>● running…</div>
          )}
        </div>
        {!running && <button onClick={onClose} style={{ background: "none", border: "none",
          color: "#9ca3af", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {results.map((r, i) => {
          const c = cat(r.category);
          const p = agentPurpose(r.agentName);
          // Pull a meaningful value from lastOutput if available
          const out = r.lastOutput || {};
          const signal = out.signal || out.trend || out.opportunity || out.recommendation;
          const signalColors = { BUY: "#10b981", SELL: "#ef4444", HOLD: "#f59e0b", UPTREND: "#10b981", DOWNTREND: "#ef4444", HIGH: "#10b981", LOW: "#6b7280" };
          return (
            <div key={i} style={{ background: "#f8f6f2", borderRadius: 8, padding: "8px 10px",
              borderLeft: `3px solid ${r.done ? c.border : "#e6d6bd"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: r.done ? 5 : 0 }}>
                <CatDot category={r.category} size={11} />
                <span style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 11 }}>{p.displayName}</span>
                {r.done && <span style={{ marginLeft: "auto", color: "#6BCF8B", fontSize: 10 }}>✓</span>}
                {!r.done && <span style={{ marginLeft: "auto", color: c.border, fontSize: 9 }}>●</span>}
              </div>
              {r.done && signal && (
                <div style={{ fontSize: 12, fontWeight: 800, color: signalColors[signal] ?? c.border, marginBottom: 2 }}>
                  {signal}
                </div>
              )}
              {r.done && out.price_usd && (
                <div style={{ fontSize: 11, color: "#2d3a4a", fontWeight: 600 }}>
                  ${Number(out.price_usd).toLocaleString()}
                  {out.change_24h_pct != null && (
                    <span style={{ marginLeft: 6, color: out.change_24h_pct >= 0 ? "#10b981" : "#ef4444", fontSize: 10 }}>
                      {out.change_24h_pct >= 0 ? "+" : ""}{Number(out.change_24h_pct).toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
              {r.done && out.confidence != null && (
                <div style={{ fontSize: 10, color: "#9aabb8" }}>
                  Confidence: {Math.round(Number(out.confidence) * 100)}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!running && results.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#9ca3af", fontSize: 11 }}>Total cost</span>
          <span style={{ color: "#111827", fontWeight: 700, fontSize: 13 }}>${totalCost.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}

// ── Inspector (single agent detail) ──────────────────────────────────────────

function Inspector({ node, onCall, onClose, lastOutput }) {
  if (!node) return null;
  const c = cat(node.data.category);
  const p = agentPurpose(node.data.label);
  return (
    <div style={{
      position: "absolute", right: 16, top: 16, width: 248,
      background: "#fff", border: "1px solid #e5e7eb",
      borderTop: `3px solid ${c.color}`,
      borderRadius: 16, padding: "16px 14px", zIndex: 51,
      overflowY: "auto",
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ color: c.border, fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 1 }}>{node.data.category}</div>
          <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 15, marginTop: 3 }}>{p.displayName}</div>
          <div style={{ color: "#9aabb8", fontSize: 11, marginTop: 2 }}>{p.tagline}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none",
          color: "#9aabb8", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
      </div>

      {lastOutput && (
        <div style={{ background: "#f8f6f2", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 8 }}>Last Output</div>
          {Object.entries(lastOutput)
            .filter(([k]) => k !== "market" && k !== "_mock")
            .slice(0, 6)
            .map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11 }}>
                <span style={{ color: "#9aabb8" }}>{k}</span>
                <span style={{ color: c.text, fontWeight: 600 }}>
                  {typeof v === "number" ? (v % 1 !== 0 ? v.toFixed(3) : v) : String(v)}
                </span>
              </div>
            ))}
        </div>
      )}

      <button onClick={() => onCall(node.id)} style={{
        width: "100%", background: c.color, color: "#fff",
        border: "none", borderRadius: 10, padding: "10px",
        fontSize: 12, cursor: "pointer", fontWeight: 700,
      }}>▶ Run this agent</button>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function TBtn({ onClick, disabled, children, variant = "ghost" }) {
  const styles = {
    primary: { background: "#10b981", color: "#fff", border: "none" },
    solid:   { background: "#8b5cf6", color: "#fff", border: "none" },
    outline: { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.15)" },
    ghost:   { background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" },
  };
  const s = styles[variant] || styles.ghost;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...s,
      borderRadius: 9, padding: "8px 16px",
      fontSize: 12, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      transition: "opacity 0.15s",
      whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function Toolbar({ pipelineName, setPipelineName, onSave, onRun, onRegister, onClear,
  savedId, running, compositeId, canRun, onDemoRun, demoName }) {
  return (
    <div style={{
      position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 50, display: "flex", alignItems: "center", gap: 8,
      background: "rgba(15,23,42,0.88)", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 16, padding: "10px 16px",
      backdropFilter: "blur(20px)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      {demoName && (
        <TBtn onClick={onDemoRun} disabled={running} variant="primary">
          {running ? "⏳ Running…" : "▶ Run Pipeline"}
        </TBtn>
      )}

      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)" }} />

      <input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)}
        placeholder="Name your pipeline…" style={{
          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8, color: "#fff", padding: "8px 12px",
          fontSize: 12, width: 156, outline: "none",
        }} />

      <TBtn onClick={onSave} disabled={!pipelineName || !canRun} variant="outline">Save</TBtn>

      {savedId && (
        <TBtn onClick={onRun} disabled={running} variant="solid">
          {running ? "Running…" : "▶ Run"}
        </TBtn>
      )}

      {savedId && !compositeId && (
        <TBtn onClick={onRegister} variant="outline">Deploy →</TBtn>
      )}
      {compositeId && (
        <span style={{ color: "#10b981", fontSize: 11, fontWeight: 700 }}>✓ Deployed</span>
      )}

      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)" }} />
      <TBtn onClick={onClear}>Reset</TBtn>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, background: "rgba(15,23,42,0.92)", border: "1px solid rgba(16,185,129,0.4)",
      borderRadius: 10, padding: "9px 20px", color: "#fff", fontSize: 12,
      fontWeight: 600, backdropFilter: "blur(12px)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)", whiteSpace: "nowrap",
    }}>{msg}</div>
  );
}

// ── Main canvas ───────────────────────────────────────────────────────────────

let dropId = 0;

function PlaygroundCanvas() {
  const wrapperRef = useRef(null);
  const [rf, setRf]                            = useState(null);
  const [allAgents, setAllAgents]              = useState([]);
  const [allPipelines, setAllPipelines]        = useState([]);
  const [nodes, setNodes, onNodesChange]       = useNodesState([]);
  const [edges, setEdges, onEdgesChange]       = useEdgesState([]);
  const [selected, setSelected]                = useState(null);
  const [lastOutput, setLastOutput]            = useState({});
  const [libOpen, setLibOpen]                  = useState(true);
  const [toast, setToast]                      = useState(null);
  const [running, setRunning]                  = useState(false);
  const [wsRetry,  setWsRetry]                 = useState(0);
  const [pipelineName, setPipelineName]        = useState("");
  const [savedId, setSavedId]                  = useState(null);
  const [compositeId, setCompositeId]          = useState(null);
  const [pipelineResults, setPipelineResults]  = useState([]);
  const [pipelineCost, setPipelineCost]        = useState(0);
  const [showResults, setShowResults]          = useState(false);
  const [backendOk, setBackendOk]              = useState(true);
  const [bigResult, setBigResult]              = useState(null);
  const [templateRunning, setTemplateRunning]  = useState(false);

  const metricsRef  = useRef({});
  const agentsRef   = useRef({});
  const demoPipeRef = useRef(null);

  const showToast = useCallback((msg, ms = 3200) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }, []);

  const patchNode = useCallback((agentId, patch) => {
    setNodes((prev) => prev.map((n) =>
      (n.data?.agentId === agentId || n.id === agentId)
        ? { ...n, data: { ...n.data, ...patch } }
        : n
    ));
  }, []);

  const flashEdge = useCallback((edgeId, preset, ms = 2500) => {
    setEdges((prev) => prev.map((e) => e.id === edgeId ? { ...e, ...preset } : e));
    setTimeout(() => {
      setEdges((prev) => prev.map((e) => e.id === edgeId ? { ...e, ...E_IDLE } : e));
    }, ms);
  }, []);

  // ── Load (with retry until backend is up) ─────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    let iv = null;

    const load = () =>
      Promise.all([
        fetch(`${API}/agents`).then((r) => r.json()),
        fetch(`${API}/metrics`).then((r) => r.json()),
        fetch(`${API}/pipelines`).then((r) => r.json()),
      ]).then(([agents, metrics, pipelines]) => {
        if (cancelled) return;
        setBackendOk(true);
        setAllAgents(agents);
        setAllPipelines(pipelines);
        metricsRef.current = Object.fromEntries(metrics.map((m) => [m.agent_id, m]));
        agentsRef.current  = Object.fromEntries(agents.map((a) => [a.id, a]));

        const demo = pipelines[0];
        demoPipeRef.current = demo;
        if (demo) {
          const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));
          const { nodes: demoNodes, edges: demoEdges } = buildDemoCanvas(demo, agentMap);
          if (demoNodes.length > 0) {
            const nodesWithMetrics = demoNodes.map((n) => {
              const m = metricsRef.current[n.data.agentId] || {};
              return { ...n, data: { ...n.data, requests: m.requests || 0,
                latency: m.avg_latency_ms || 0, earnings: m.earnings || 0 } };
            });
            setNodes(nodesWithMetrics);
            setEdges(demoEdges);
          }
        }
        // Stop retrying once data is loaded
        clearInterval(iv);
      }).catch(() => {
        if (!cancelled) setBackendOk(false);
      });

    load();
    iv = setInterval(load, 4000); // retry every 4s until backend responds
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const ws = new WebSocket(WS);

    ws.onmessage = (e) => {
      const ev = JSON.parse(e.data);

      if (ev.type === "pipeline_start") {
        setPipelineResults([]);
        setPipelineCost(0);
        setShowResults(true);
        // Mark all agents in this pipeline as pending
        (ev.agent_ids || []).forEach((aid) => {
          const a = agentsRef.current[aid];
          if (!a) return;
          setPipelineResults((prev) => {
            if (prev.some((r) => r.agentId === aid)) return prev;
            return [...prev, { agentId: aid, agentName: a.name, category: a.category,
              cost: a.price_per_request, latency: 0, done: false }];
          });
        });
      }

      if (ev.type === "agent_call_start") {
        patchNode(ev.agent_id, { active: true });
      }

      if (ev.type === "agent_call_done") {
        const earn = ev.metrics?.earnings;
        patchNode(ev.agent_id, {
          active: false,
          requests: ev.metrics?.requests || 0,
          latency:  ev.metrics?.avg_latency_ms || 0,
          earnings: ev.metrics?.earnings || 0,
          lastOutput: ev.result,
          revenueFlash: earn > 0 ? earn.toFixed(4) : null,
        });
        if (earn > 0) setTimeout(() => patchNode(ev.agent_id, { revenueFlash: null }), 1600);
        setLastOutput((p) => ({ ...p, [ev.agent_id]: ev.result }));
        const parts = Object.entries(ev.result || {})
          .filter(([k]) => k !== "market" && k !== "_mock")
          .slice(0, 3).map(([k, v]) => `${k}: ${v}`).join("  ·  ");
        if (parts) showToast(`${ev.agent_name}  →  ${parts}`);
      }

      if (ev.type === "pipeline_step_start") {
        patchNode(ev.agent_id, { active: true });
      }

      if (ev.type === "pipeline_step_done") {
        const earn = ev.metrics?.earnings;
        const latency = ev.metrics?.avg_latency_ms || 0;
        const a = agentsRef.current[ev.agent_id];
        patchNode(ev.agent_id, {
          active: false,
          requests: ev.metrics?.requests || 0,
          latency, earnings: ev.metrics?.earnings || 0,
          lastOutput: ev.output,
          revenueFlash: earn > 0 ? earn.toFixed(4) : null,
        });
        if (earn > 0) setTimeout(() => patchNode(ev.agent_id, { revenueFlash: null }), 1600);
        setLastOutput((p) => ({ ...p, [ev.agent_id]: ev.output }));
        // Animate OUTGOING edges — data pulses forward to the next agent
        setEdges((prev) => prev.map((edge) =>
          edge.source === `demo-${ev.agent_id}` || edge.source === ev.agent_id
            ? { ...edge, ...E_PIPE } : edge
        ));
        setTimeout(() => {
          setEdges((prev) => prev.map((edge) =>
            edge.source === `demo-${ev.agent_id}` || edge.source === ev.agent_id
              ? { ...edge, ...E_PIPE_IDLE } : edge
          ));
        }, 1600);
        // Update results panel
        setPipelineResults((prev) => prev.map((r) =>
          r.agentId === ev.agent_id ? { ...r, done: true, latency, cost: a?.price_per_request ?? r.cost } : r
        ));
        const parts = Object.entries(ev.output || {})
          .filter(([k]) => k !== "market" && k !== "_mock")
          .slice(0, 3).map(([k, v]) => `${k}: ${v}`).join("  ·  ");
        if (parts) showToast(`${ev.agent_name}  →  ${parts}`);
      }

      if (ev.type === "pipeline_done") {
        setRunning(false);
        setPipelineCost(ev.total_cost || 0);
        showToast(`✓ Pipeline complete · $${(ev.total_cost || 0).toFixed(4)}`, 4000);
      }
    };

    ws.onerror = () => {};
    ws.onclose = () => { setTimeout(() => setWsRetry((n) => n + 1), 3000); };
    return () => ws.close();
  }, [flashEdge, showToast, patchNode, wsRetry]);

  // ── Interaction ────────────────────────────────────────────────────────────

  const onNodeClick  = useCallback((_, n) => setSelected(n), []);
  const onPaneClick  = useCallback(() => setSelected(null), []);
  const onConnect    = useCallback(
    (p) => setEdges((es) => addEdge({ ...p, ...E_IDLE }, es)),
    [setEdges]
  );

  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    if (!rf || !wrapperRef.current) return;
    const raw = e.dataTransfer.getData("application/agentverse");
    if (!raw) return;
    const item = JSON.parse(raw);
    const bounds = wrapperRef.current.getBoundingClientRect();
    const pos = rf.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    dropId++;
    if (item._type === "pipeline") {
      setNodes((ns) => [...ns, {
        id: `pdrop-${item.id}-${dropId}`, type: "pipeline", position: pos,
        data: { label: item.name, pipelineId: item.id, agentIds: item.agent_ids, agentNames: item.agentNames || [] },
      }]);
    } else {
      const m = metricsRef.current[item.id] || {};
      setNodes((ns) => [...ns, {
        id: `drop-${item.id}-${dropId}`,
        type: item.category === "composite" ? "composite" : "agent",
        position: pos,
        data: { label: item.name, category: item.category, price: item.price_per_request,
          agentId: item.id, requests: m.requests || 0, latency: m.avg_latency_ms || 0,
          earnings: m.earnings || 0, active: false },
      }]);
    }
  }, [rf, setNodes]);

  const callAgent = useCallback(async (nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const agentId = node.data.agentId || node.id;
    await fetch(`${API}/call-agent/${agentId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ market: "BTC" }),
    });
  }, [nodes]);

  // ── Pipeline builder ───────────────────────────────────────────────────────

  const canRun = nodes.length >= 2 && edges.length >= 1;

  const savePipeline = async () => {
    if (!pipelineName || !canRun) return;
    if (!backendOk) { showToast("Server is offline — try again in a moment."); return; }
    const ids = topoSort(nodes, edges)
      .map((id) => nodes.find((n) => n.id === id)?.data.agentId)
      .filter(Boolean);
    if (ids.length < 2) { showToast("Connect at least 2 agents first"); return; }
    const res = await fetch(`${API}/pipelines`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pipelineName, agent_ids: ids }),
    });
    const saved = await res.json();
    setSavedId(saved.id);
    setAllPipelines((p) => [...p.filter((x) => x.id !== saved.id), saved]);
    showToast(`Pipeline "${saved.name}" saved`);
  };

  const runPipeline = async () => {
    if (!savedId) return;
    setRunning(true);
    try {
      await fetch(`${API}/run-pipeline/${savedId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market: "BTC" }),
      });
    } finally {
      setRunning(false);
    }
  };

  const runDemoPipeline = async () => {
    const demo = allPipelines[0];
    if (!demo) return;
    if (!backendOk) { showToast("Server is offline — try again in a moment."); return; }
    setRunning(true);
    try {
      await fetch(`${API}/run-pipeline/${demo.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market: "BTC" }),
      });
    } finally {
      setRunning(false);
    }
  };

  const registerAsAgent = async () => {
    if (!savedId) return;
    const res = await fetch(`${API}/pipelines/${savedId}/register-as-agent`, { method: "POST" });
    const agent = await res.json();
    setCompositeId(agent.id);
    showToast(`"${agent.name}" registered as composite agent`);
  };

  const clearCanvas = () => {
    // Reset to demo pipeline state
    if (demoPipeRef.current && allAgents.length > 0) {
      const agentMap = Object.fromEntries(allAgents.map((a) => [a.id, a]));
      const { nodes: demoNodes, edges: demoEdges } = buildDemoCanvas(demoPipeRef.current, agentMap);
      setNodes(demoNodes);
      setEdges(demoEdges);
    } else {
      setNodes([]); setEdges([]);
    }
    setPipelineName(""); setSavedId(null); setCompositeId(null);
    setShowResults(false); setPipelineResults([]);
  };

  // ── Template auto-run ──────────────────────────────────────────────────────

  const runTemplate = useCallback(async (template, market = "BTC") => {
    if (!backendOk) { showToast("Server is starting up — try again in a moment."); return; }

    // Find agents by name
    const agentList = template.agents
      .map(name => allAgents.find(a => a.name === name))
      .filter(Boolean);

    if (agentList.length < 2) {
      showToast("Agents still loading — try again in a second.");
      return;
    }

    setBigResult(null);
    setShowResults(false);
    setSelected(null);
    setTemplateRunning(true);

    // Build nodes + edges on canvas
    const spacing = 270;
    const totalW  = (agentList.length - 1) * spacing;
    const newNodes = agentList.map((a, i) => ({
      id: `tmpl-${a.id}-${i}`,
      type: "agent",
      position: { x: i * spacing - totalW / 2, y: 0 },
      data: { label: a.name, category: a.category, price: a.price_per_request,
              agentId: a.id, requests: 0, latency: 0, earnings: 0, active: false },
    }));
    const newEdges = newNodes.slice(0, -1).map((n, i) => ({
      id: `tmpl-edge-${i}`, source: n.id, target: newNodes[i + 1].id, ...E_PIPE_IDLE,
    }));

    setNodes(newNodes);
    setEdges(newEdges);
    setSavedId(null);
    setCompositeId(null);

    // Small pause for React + ReactFlow to render
    await new Promise(r => setTimeout(r, 350));

    const results = {};

    for (let i = 0; i < agentList.length; i++) {
      const agent  = agentList[i];
      const nodeId = newNodes[i].id;
      const edgeId = `tmpl-edge-${i}`;

      // Light up node
      setNodes(prev => prev.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, active: true } } : n
      ));

      try {
        const res = await fetch(`${API}/call-agent/${agent.id}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ market }),
        });
        const output = res.ok ? await res.json() : {};
        results[agent.name] = output;

        // Update node with output, deactivate
        setNodes(prev => prev.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, active: false, lastOutput: output } } : n
        ));

        // Pulse the outgoing edge if there is one
        if (i < newEdges.length) {
          setEdges(prev => prev.map(e => e.id === edgeId ? { ...e, ...E_PIPE } : e));
          await new Promise(r => setTimeout(r, 700));
          setEdges(prev => prev.map(e => e.id === edgeId ? { ...e, ...E_PIPE_IDLE } : e));
        } else {
          await new Promise(r => setTimeout(r, 300));
        }
      } catch {
        setNodes(prev => prev.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, active: false } } : n
        ));
      }
    }

    setTemplateRunning(false);
    setBigResult({ results, template, market });
  }, [allAgents, backendOk, showToast, setNodes, setEdges]);

  // Empty canvas = no user-placed nodes (only demo nodes are on canvas)
  const isEmpty = nodes.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0f172a" }}
      ref={wrapperRef} onDragOver={onDragOver} onDrop={onDrop}>

      <style>{GLOBAL_CSS}</style>

      <CanvasGrid />
      <Toast msg={toast} />

      {/* Backend offline banner */}
      {!backendOk && (
        <div style={{
          position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10,
          padding: "8px 20px", color: "#fca5a5", fontSize: 12, fontWeight: 600,
          backdropFilter: "blur(8px)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          Agents offline — the server is restarting. Try again in a moment.
        </div>
      )}

      <AgentLibrary
        agents={allAgents} pipelines={allPipelines}
        collapsed={!libOpen} onToggle={() => setLibOpen((v) => !v)}
      />

      {/* Results panel (right) — shows while/after pipeline runs */}
      {showResults && (
        <ResultsPanel
          results={pipelineResults} totalCost={pipelineCost}
          running={running} onClose={() => setShowResults(false)}
        />
      )}

      {/* Inspector — single agent detail (overlays results panel) */}
      {selected && !showResults && (
        <Inspector
          node={nodes.find((n) => n.id === selected.id)}
          onCall={callAgent} onClose={() => setSelected(null)}
          lastOutput={lastOutput[selected.data?.agentId || selected.id]}
        />
      )}

      {/* Quick-start template bar */}
      <QuickStartBar onSelect={t => runTemplate(t, "BTC")} running={templateRunning || running} />

      {/* Empty canvas hint (only when no nodes + no result showing) */}
      {isEmpty && !bigResult && !templateRunning && <OnboardingHints />}

      {/* Big result overlay */}
      {bigResult && (
        <BigResultCard
          bigResult={bigResult}
          onRetry={(template, market) => runTemplate(template, market)}
          onSave={() => {
            setPipelineName(bigResult.template.name);
            setBigResult(null);
            showToast(`Named "${bigResult.template.name}" — hit Save in the toolbar to keep it.`);
          }}
          onDismiss={() => setBigResult(null)}
        />
      )}

      <GuideTooltip />

      <Toolbar
        pipelineName={pipelineName} setPipelineName={setPipelineName}
        onSave={savePipeline} onRun={runPipeline} onRegister={registerAsAgent} onClear={clearCanvas}
        savedId={savedId} running={running} compositeId={compositeId} canRun={canRun}
        onDemoRun={runDemoPipeline} demoName={allPipelines[0]?.name ?? null}
      />

      <ReactFlow
        nodes={nodes} edges={edges}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onInit={setRf}
        onNodeClick={onNodeClick} onPaneClick={onPaneClick}
        deleteKeyCode="Backspace"
        fitView fitViewOptions={{ padding: 0.4 }}
        minZoom={0.2} maxZoom={2.5}
        snapToGrid snapGrid={[24, 24]}
        style={{ background: "transparent" }}
      >
        <Background color="transparent" gap={0} />
        <Controls style={{ bottom: 90, right: 16, background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10 }} />
      </ReactFlow>
    </div>
  );
}

export default function Playground() {
  return (
    <ReactFlowProvider>
      <PlaygroundCanvas />
    </ReactFlowProvider>
  );
}
