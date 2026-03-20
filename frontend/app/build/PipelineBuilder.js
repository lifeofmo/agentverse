"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import ReactFlow, {
  Background, Controls,
  addEdge, useNodesState, useEdgesState,
  ReactFlowProvider,
  Handle, Position,
} from "reactflow";
import "reactflow/dist/style.css";

import { API as REGISTRY_URL } from "@/app/lib/config";

// ── Agent display names + categories ─────────────────────────────────────────

const AGENT_PURPOSE = {
  MomentumAgent:   { displayName: "Momentum Signal",     tagline: "Detects price momentum trends",           cat: "trading"  },
  PriceAgent:      { displayName: "Live Price Feed",      tagline: "Real-time market prices",                 cat: "data"     },
  SentimentAgent:  { displayName: "Sentiment Pulse",      tagline: "Social & news sentiment score",           cat: "analysis" },
  RiskAgent:       { displayName: "Risk Assessor",        tagline: "Portfolio risk & exposure",               cat: "risk"     },
  PortfolioAgent:  { displayName: "Portfolio Optimizer",  tagline: "Rebalance & optimize allocations",        cat: "risk"     },
  ArbitrageAgent:  { displayName: "Arb Scanner",          tagline: "Cross-exchange price gaps",               cat: "trading"  },
  NewsAgent:       { displayName: "News Digest",          tagline: "Latest market-moving headlines",          cat: "analysis" },
  VolatilityAgent: { displayName: "Volatility Meter",     tagline: "Measures market volatility",              cat: "data"     },
  LiquidityAgent:  { displayName: "Liquidity Depth",      tagline: "Order book depth & spread",               cat: "data"     },
  SignalAgent:     { displayName: "Trading Signal",       tagline: "BUY / SELL / HOLD recommendation",        cat: "trading"  },
  TrendAgent:      { displayName: "Trend Detector",       tagline: "Multi-timeframe trend analysis",          cat: "analysis" },
  CryptoAgent:     { displayName: "Crypto Overview",      tagline: "Full market snapshot",                    cat: "trading"  },
};

function getDisplayName(rawName) {
  return AGENT_PURPOSE[rawName]?.displayName ?? rawName;
}
function getTagline(rawName) {
  return AGENT_PURPOSE[rawName]?.tagline ?? "";
}

// ── Category color system ─────────────────────────────────────────────────────

const CAT = {
  trading:  { color: "#10b981", bg: "#064e3b20", pill: "#064e3b", label: "Trading",  icon: "↗" },
  analysis: { color: "#818cf8", bg: "#1e1b4b20", pill: "#1e1b4b", label: "Analysis", icon: "◎" },
  data:     { color: "#38bdf8", bg: "#0c1a2e20", pill: "#0c1a2e", label: "Data",     icon: "≋" },
  risk:     { color: "#c084fc", bg: "#3b076420", pill: "#3b0764", label: "Risk",     icon: "◬" },
  default:  { color: "#64748b", bg: "#1e293b20", pill: "#1e293b", label: "Other",    icon: "⊕" },
};

function cat(category) {
  return CAT[category] ?? CAT.default;
}

// ── Human-readable result keys ────────────────────────────────────────────────

const KEY_MAP = {
  signal:       { label: "Signal",       fmt: v => String(v).toUpperCase() },
  price:        { label: "Price",        fmt: v => `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  momentum:     { label: "Momentum",     fmt: v => String(v) },
  sentiment:    { label: "Sentiment",    fmt: v => String(v) },
  risk_score:   { label: "Risk Score",   fmt: v => `${v} / 10` },
  confidence:   { label: "Confidence",   fmt: v => `${Math.round(Number(v) * 100)}%` },
  volatility:   { label: "Volatility",   fmt: v => String(v) },
  change_24h:   { label: "24h Change",   fmt: v => `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}%` },
  volume:       { label: "Volume",       fmt: v => `$${Number(v).toLocaleString()}` },
  trend:        { label: "Trend",        fmt: v => String(v) },
  recommendation: { label: "Action",     fmt: v => String(v).toUpperCase() },
};

function formatResultKey(k) {
  return KEY_MAP[k]?.label ?? k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function formatResultVal(k, v) {
  if (KEY_MAP[k]) {
    try { return KEY_MAP[k].fmt(v); } catch { return String(v); }
  }
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

function getSignalColor(v) {
  const s = String(v).toUpperCase();
  if (s === "BUY")  return "#10b981";
  if (s === "SELL") return "#ef4444";
  if (s === "HOLD") return "#f59e0b";
  return "#818cf8";
}

// ── Pipeline templates ────────────────────────────────────────────────────────

const PIPELINE_TEMPLATES = [
  {
    id: "crypto-signal",
    name: "Crypto Signal",
    desc: "Price → Momentum → BUY/SELL/HOLD",
    agents: ["PriceAgent", "MomentumAgent", "SignalAgent"],
    color: "#10b981",
  },
  {
    id: "market-scan",
    name: "Market Scanner",
    desc: "Price feed + sentiment analysis + trend",
    agents: ["PriceAgent", "SentimentAgent", "TrendAgent"],
    color: "#818cf8",
  },
  {
    id: "risk-check",
    name: "Risk Check",
    desc: "Live price → volatility → risk score",
    agents: ["PriceAgent", "VolatilityAgent", "RiskAgent"],
    color: "#c084fc",
  },
];

// ── Worlds ────────────────────────────────────────────────────────────────────

const WORLDS = [
  { id: "trading",      label: "Las Vegas",    sub: "High-stakes trading",     color: "#ff2d78" },
  { id: "data",         label: "Matrix",       sub: "Data & feed agents",      color: "#00FF41" },
  { id: "analysis",     label: "Sims",         sub: "Analysis & patterns",     color: "#7ec87e" },
  { id: "risk",         label: "Tomorrowland", sub: "Risk & portfolio",        color: "#c084fc" },
  { id: "composite",    label: "Hogwarts",     sub: "All agents",              color: "#d4a820" },
  { id: "experimental", label: "Burning Man",  sub: "Experimental builds",     color: "#FF6B35" },
];

// ── World picker modal ────────────────────────────────────────────────────────

function WorldPickerModal({ pipelineName, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(null);
  const selectedWorld = WORLDS.find(w => w.id === selected);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#111827", border: "1px solid #1f2937",
        borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 500,
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: "#f9fafb", fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
            Deploy to a world
          </div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            <span style={{ color: "#e5e7eb", fontWeight: 600 }}>"{pipelineName}"</span>
            {" "}will appear in the Marketplace under the chosen world.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
          {WORLDS.map((w) => (
            <button key={w.id} onClick={() => setSelected(w.id)} style={{
              background: selected === w.id ? `${w.color}18` : "#1f2937",
              border: `1.5px solid ${selected === w.id ? w.color : "#374151"}`,
              borderRadius: 12, padding: "14px 16px", cursor: "pointer",
              textAlign: "left", transition: "all 0.15s",
            }}>
              <div style={{ color: selected === w.id ? w.color : "#e5e7eb", fontWeight: 700, fontSize: 13 }}>
                {w.label}
              </div>
              <div style={{ color: "#6b7280", fontSize: 11, marginTop: 3 }}>{w.sub}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            background: "transparent", border: "1px solid #374151",
            color: "#6b7280", borderRadius: 10, padding: "10px 18px",
            fontSize: 13, cursor: "pointer", fontWeight: 500,
          }}>Cancel</button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            style={{
              background: selected ? selectedWorld?.color : "#374151",
              border: "none",
              color: selected ? "#000" : "#4b5563",
              borderRadius: 10, padding: "10px 22px",
              fontSize: 13, fontWeight: 700,
              cursor: selected ? "pointer" : "not-allowed",
              transition: "all 0.15s",
            }}
          >
            Deploy to {selectedWorld?.label ?? "…"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Canvas node ───────────────────────────────────────────────────────────────

function AgentCanvasNode({ data, selected }) {
  const c = cat(data.category);
  const displayName = getDisplayName(data.rawName ?? data.label);

  return (
    <div style={{
      background: "#1f2937",
      border: `1.5px solid ${selected ? c.color : "#374151"}`,
      borderLeft: `4px solid ${c.color}`,
      borderRadius: 12,
      padding: "12px 16px",
      minWidth: 160,
      maxWidth: 200,
      boxShadow: selected ? `0 0 0 3px ${c.color}30, 0 8px 24px rgba(0,0,0,0.3)` : "0 4px 12px rgba(0,0,0,0.2)",
      transition: "box-shadow 0.15s",
      position: "relative",
    }}>
      <Handle type="target"  position={Position.Left}  style={{ background: c.color, width: 8, height: 8, border: "2px solid #111827" }} />
      <Handle type="source"  position={Position.Right} style={{ background: c.color, width: 8, height: 8, border: "2px solid #111827" }} />

      <div style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: `${c.color}22`, border: `1px solid ${c.color}44`,
        borderRadius: 6, padding: "2px 7px", marginBottom: 8,
      }}>
        <span style={{ color: c.color, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {c.icon} {c.label}
        </span>
      </div>

      <div style={{ color: "#f9fafb", fontWeight: 700, fontSize: 13, lineHeight: 1.3, marginBottom: 4 }}>
        {displayName}
      </div>
      <div style={{ color: "#6b7280", fontSize: 10 }}>
        {data.price > 0 ? `$${data.price.toFixed(4)}/call` : "free"}
      </div>
    </div>
  );
}

const nodeTypes = { agent: AgentCanvasNode };

// ── Topological sort ──────────────────────────────────────────────────────────

function topoSort(nodes, edges) {
  const inDeg = Object.fromEntries(nodes.map(n => [n.id, 0]));
  const adj   = Object.fromEntries(nodes.map(n => [n.id, []]));
  for (const e of edges) {
    adj[e.source].push(e.target);
    inDeg[e.target] = (inDeg[e.target] ?? 0) + 1;
  }
  const queue  = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id);
  const result = [];
  while (queue.length) {
    const cur = queue.shift();
    result.push(cur);
    for (const next of adj[cur]) {
      if (--inDeg[next] === 0) queue.push(next);
    }
  }
  return result;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyCanvas({ onTemplate }) {
  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 28,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#374151", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          Build your first pipeline
        </div>
        <div style={{ color: "#1f2937", fontSize: 12 }}>
          Chain agents together — data feeds into analysis, analysis into signals
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, pointerEvents: "all" }}>
        {PIPELINE_TEMPLATES.map(t => (
          <button key={t.id} onClick={() => onTemplate(t)} style={{
            background: "#111827", border: `1px solid ${t.color}50`,
            borderRadius: 14, padding: "14px 18px", cursor: "pointer",
            textAlign: "left", minWidth: 150, transition: "all 0.15s",
            boxShadow: `0 0 0 0 ${t.color}`,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.boxShadow = `0 0 20px ${t.color}30`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = `${t.color}50`; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: t.color, marginBottom: 10,
            }} />
            <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{t.name}</div>
            <div style={{ color: "#4b5563", fontSize: 11, lineHeight: 1.5 }}>{t.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ color: "#1f2937", fontSize: 11 }}>
        or drag agents from the left panel
      </div>
    </div>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ result }) {
  if (!result) return null;

  const finalData = result.final ?? result;
  const entries = Object.entries(finalData).filter(([k]) => k !== "market" && k !== "raw");
  const signalEntry = entries.find(([k]) => k === "signal" || k === "recommendation");
  const signal = signalEntry ? String(signalEntry[1]).toUpperCase() : null;
  const signalColor = signal ? getSignalColor(signal) : "#818cf8";

  return (
    <div style={{
      background: "#111827", border: "1px solid #1f2937",
      borderRadius: 16, padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
          Result
        </div>
        {signal && (
          <div style={{
            background: `${signalColor}22`, border: `1px solid ${signalColor}66`,
            borderRadius: 8, padding: "4px 10px",
            color: signalColor, fontWeight: 800, fontSize: 13,
          }}>
            {signal}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map(([k, v]) => {
          const isSignal = k === "signal" || k === "recommendation";
          return (
            <div key={k} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 0", borderBottom: "1px solid #1f2937",
            }}>
              <span style={{ color: "#6b7280", fontSize: 12 }}>{formatResultKey(k)}</span>
              <span style={{
                color: isSignal ? getSignalColor(String(v)) : "#e5e7eb",
                fontSize: 12, fontWeight: isSignal ? 700 : 500,
              }}>
                {formatResultVal(k, v)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main builder ──────────────────────────────────────────────────────────────

function Builder() {
  const reactFlowWrapper = useRef(null);
  const [rfInstance, setRfInstance]   = useState(null);
  const [agents, setAgents]           = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [pipelineName, setPipelineName]  = useState("");
  const [search, setSearch]              = useState("");
  const [status, setStatus]              = useState(null);
  const [runResult, setRunResult]        = useState(null);
  const [savedId, setSavedId]            = useState(null);
  const [running, setRunning]            = useState(false);
  const [saving, setSaving]              = useState(false);
  const [compositeAgentId, setCompositeAgentId] = useState(null);
  const [showWorldPicker, setShowWorldPicker]   = useState(false);
  const [deployedWorld, setDeployedWorld]       = useState(null);
  const idCounter = useRef(0);

  useEffect(() => {
    fetch(`${REGISTRY_URL}/agents`)
      .then(r => r.json())
      .then(setAgents);
  }, []);

  // Filtered agents for sidebar
  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(a => {
      const dn = getDisplayName(a.name).toLowerCase();
      const tl = getTagline(a.name).toLowerCase();
      return dn.includes(q) || tl.includes(q) || a.category?.toLowerCase().includes(q);
    });
  }, [agents, search]);

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  const onDragStart = (e, agent) => {
    e.dataTransfer.setData("application/agentverse", JSON.stringify(agent));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const onDrop = useCallback(e => {
    e.preventDefault();
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const raw = e.dataTransfer.getData("application/agentverse");
    if (!raw || !rfInstance) return;
    const agent = JSON.parse(raw);
    const pos = rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    idCounter.current += 1;
    setNodes(ns => [...ns, {
      id: `${agent.id}-${idCounter.current}`,
      type: "agent",
      position: pos,
      data: {
        label: agent.name,
        rawName: agent.name,
        category: agent.category,
        price: agent.price_per_request,
        agentId: agent.id,
        ownerWallet: agent.owner_wallet ?? "",
      },
    }]);
  }, [rfInstance, setNodes]);

  const onConnect = useCallback(
    params => setEdges(es => addEdge({ ...params, animated: true, style: { stroke: "#6366f1", strokeWidth: 2 } }, es)),
    [setEdges]
  );

  // ── Template quick-start ─────────────────────────────────────────────────────

  const loadTemplate = useCallback(template => {
    // Find matching agents from the registry
    const matched = template.agents.map(name => {
      const found = agents.find(a => a.name === name);
      return found ?? { id: name, name, category: AGENT_PURPOSE[name]?.cat ?? "default", price_per_request: 0, owner_wallet: "" };
    });

    const newNodes = matched.map((agent, i) => {
      idCounter.current += 1;
      return {
        id: `${agent.id}-${idCounter.current}`,
        type: "agent",
        position: { x: 80 + i * 240, y: 180 },
        data: {
          label: agent.name,
          rawName: agent.name,
          category: agent.category,
          price: agent.price_per_request,
          agentId: agent.id,
          ownerWallet: agent.owner_wallet ?? "",
        },
      };
    });

    // Auto-connect left to right
    const newEdges = newNodes.slice(0, -1).map((n, i) => ({
      id: `e-${n.id}-${newNodes[i + 1].id}`,
      source: n.id,
      target: newNodes[i + 1].id,
      animated: true,
      style: { stroke: "#6366f1", strokeWidth: 2 },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
    setPipelineName(template.name);
    setRunResult(null);
    setSavedId(null);
    setStatus(null);
  }, [agents, setNodes, setEdges]);

  // ── Save pipeline ────────────────────────────────────────────────────────────

  const savePipeline = async () => {
    if (!pipelineName.trim()) { setStatus({ ok: false, msg: "Add a pipeline name first" }); return; }
    if (nodes.length < 2)     { setStatus({ ok: false, msg: "Add at least 2 agents to the canvas" }); return; }

    const orderedIds = topoSort(nodes, edges)
      .map(nodeId => nodes.find(n => n.id === nodeId)?.data.agentId)
      .filter(Boolean);

    if (orderedIds.length < 2) { setStatus({ ok: false, msg: "Connect the agents with edges first" }); return; }

    setSaving(true);
    try {
      const res = await fetch(`${REGISTRY_URL}/pipelines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pipelineName, agent_ids: orderedIds }),
      });
      const saved = await res.json();
      setSavedId(saved.id);
      setStatus({ ok: true, msg: `Saved — ready to run` });
    } catch (err) {
      setStatus({ ok: false, msg: String(err) });
    }
    setSaving(false);
  };

  // ── Run pipeline ─────────────────────────────────────────────────────────────

  const runPipeline = async () => {
    if (!savedId) { setStatus({ ok: false, msg: "Save the pipeline first" }); return; }
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(`${REGISTRY_URL}/run-pipeline/${savedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market: "BTC" }),
      });
      const data = await res.json();

      if (data.job_id && data.status === "queued") {
        setStatus({ ok: true, msg: "Running…" });
        let attempts = 0;
        while (attempts < 30) {
          await new Promise(r => setTimeout(r, 1000));
          attempts++;
          const poll = await fetch(`${REGISTRY_URL}/jobs/${data.job_id}`);
          const job  = await poll.json();
          if (job.status === "completed") { setRunResult(job.result); setStatus({ ok: true, msg: "Done" }); break; }
          if (job.status === "failed")    { setStatus({ ok: false, msg: job.error ?? "Pipeline failed" }); break; }
          setStatus({ ok: true, msg: `Running… ${attempts}s` });
        }
      } else {
        setRunResult(data);
        setStatus({ ok: true, msg: "Done" });
      }
    } catch (err) {
      setStatus({ ok: false, msg: String(err) });
    }
    setRunning(false);
  };

  // ── Deploy pipeline as composite agent ──────────────────────────────────────

  const registerAsAgent = async worldCategory => {
    if (!savedId) { setStatus({ ok: false, msg: "Save the pipeline first" }); return; }
    const world = WORLDS.find(w => w.id === worldCategory);
    try {
      const res = await fetch(`${REGISTRY_URL}/pipelines/${savedId}/register-as-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: worldCategory }),
      });
      if (!res.ok) throw new Error("Registration failed");
      const agent = await res.json();
      setCompositeAgentId(agent.id);
      setDeployedWorld(world);
      setShowWorldPicker(false);
      setStatus({ ok: true, msg: `Live in ${world?.label}` });
    } catch (err) {
      setStatus({ ok: false, msg: String(err) });
    }
  };

  // ── Clear ────────────────────────────────────────────────────────────────────

  const clearCanvas = () => {
    setNodes([]); setEdges([]);
    setPipelineName(""); setStatus(null);
    setRunResult(null); setSavedId(null);
    setCompositeAgentId(null); setDeployedWorld(null);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const orderPreview = topoSort(nodes, edges)
    .map(id => nodes.find(n => n.id === id)?.data)
    .filter(Boolean);

  const totalCostUsd  = nodes.reduce((s, n) => s + (n.data.price ?? 0), 0);

  // ── Grouped agents for sidebar ────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const g = {};
    for (const a of filteredAgents) {
      const c = a.category ?? "default";
      if (!g[c]) g[c] = [];
      g[c].push(a);
    }
    return g;
  }, [filteredAgents]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#0d1117", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {showWorldPicker && (
        <WorldPickerModal
          pipelineName={pipelineName}
          onConfirm={registerAsAgent}
          onCancel={() => setShowWorldPicker(false)}
        />
      )}

      {/* ── Left panel — agent library ────────────────────────────────────────── */}
      <div style={{
        width: 272, flexShrink: 0, background: "#111827",
        borderRight: "1px solid #1f2937",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid #1f2937" }}>
          <a href="/" style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            color: "#6b7280", fontSize: 11, textDecoration: "none",
            marginBottom: 16, fontWeight: 500,
          }}>
            ← Back to map
          </a>
          <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px", marginBottom: 4 }}>
            Pipeline Builder
          </div>
          <div style={{ color: "#4b5563", fontSize: 11, lineHeight: 1.5 }}>
            Chain agents to build automated workflows
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1f2937" }}>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              color: "#374151", fontSize: 12, pointerEvents: "none",
            }}>⌕</span>
            <input
              placeholder="Search agents…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", background: "#1f2937", border: "1px solid #374151",
                borderRadius: 8, color: "#e5e7eb", padding: "7px 10px 7px 28px",
                fontSize: 12, boxSizing: "border-box", outline: "none",
              }}
            />
          </div>
        </div>

        {/* Agent list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
          {agents.length === 0 && (
            <div style={{ color: "#374151", fontSize: 12, textAlign: "center", marginTop: 24 }}>
              Loading agents…
            </div>
          )}
          {Object.entries(grouped).map(([category, list]) => {
            const c = cat(category);
            return (
              <div key={category} style={{ marginBottom: 16 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  color: c.color, fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 1,
                  marginBottom: 6, padding: "0 4px",
                }}>
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </div>
                {list.map(a => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={e => onDragStart(e, a)}
                    style={{
                      background: "#1f2937", border: "1px solid #374151",
                      borderLeft: `3px solid ${c.color}`,
                      borderRadius: 10, padding: "10px 12px", marginBottom: 6,
                      cursor: "grab", userSelect: "none",
                      transition: "border-color 0.12s, background 0.12s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#283548"; e.currentTarget.style.borderColor = c.color; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#1f2937"; e.currentTarget.style.borderColor = "#374151"; e.currentTarget.style.borderLeftColor = c.color; }}
                  >
                    <div style={{ color: "#f3f4f6", fontWeight: 600, fontSize: 12, marginBottom: 2 }}>
                      {getDisplayName(a.name)}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 10, lineHeight: 1.4 }}>
                      {getTagline(a.name) || a.name}
                    </div>
                    {a.price_per_request > 0 && (
                      <div style={{ color: "#4b5563", fontSize: 10, marginTop: 4 }}>
                        ${a.price_per_request.toFixed(4)}/call
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Templates */}
        <div style={{ padding: "12px 12px 14px", borderTop: "1px solid #1f2937" }}>
          <div style={{ color: "#4b5563", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, paddingLeft: 4 }}>
            Quick start
          </div>
          {PIPELINE_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => loadTemplate(t)} style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", background: "transparent", border: "1px solid #1f2937",
              borderRadius: 8, padding: "8px 12px", cursor: "pointer",
              marginBottom: 6, textAlign: "left",
              transition: "background 0.12s, border-color 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#1f2937"; e.currentTarget.style.borderColor = t.color + "60"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#1f2937"; }}
            >
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
              <div>
                <div style={{ color: "#d1d5db", fontSize: 11, fontWeight: 600 }}>{t.name}</div>
                <div style={{ color: "#4b5563", fontSize: 10 }}>{t.agents.length} agents</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Center — ReactFlow canvas ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{
          height: 52, flexShrink: 0,
          background: "#111827", borderBottom: "1px solid #1f2937",
          display: "flex", alignItems: "center", padding: "0 16px", gap: 10,
        }}>
          <input
            placeholder="Pipeline name…"
            value={pipelineName}
            onChange={e => setPipelineName(e.target.value)}
            style={{
              flex: 1, maxWidth: 280, background: "#1f2937", border: "1px solid #374151",
              borderRadius: 8, color: "#f9fafb", padding: "7px 12px",
              fontSize: 13, fontWeight: 600, outline: "none",
            }}
          />

          <div style={{ flex: 1 }} />

          {/* Status badge */}
          {status && (
            <div style={{
              background: status.ok ? "#064e3b" : "#450a0a",
              border: `1px solid ${status.ok ? "#10b981" : "#ef4444"}`,
              color: status.ok ? "#6ee7b7" : "#fca5a5",
              borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 500,
            }}>
              {status.msg}
            </div>
          )}

          {nodes.length > 0 && (
            <div style={{ color: "#6b7280", fontSize: 11 }}>
              {nodes.length} agents · ${totalCostUsd.toFixed(4)}/run
            </div>
          )}

          <button onClick={savePipeline} disabled={saving} style={{
            background: saving ? "#1f2937" : "#6366f1",
            color: saving ? "#6b7280" : "#fff",
            border: "none", borderRadius: 8, padding: "7px 16px",
            fontSize: 12, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
          }}>
            {saving ? "Saving…" : "Save"}
          </button>

          {savedId && (
            <button onClick={runPipeline} disabled={running} style={{
              background: running ? "#1f2937" : "#059669",
              color: running ? "#6b7280" : "#fff",
              border: "none", borderRadius: 8, padding: "7px 16px",
              fontSize: 12, fontWeight: 600, cursor: running ? "not-allowed" : "pointer",
            }}>
              {running ? "Running…" : "▶ Run"}
            </button>
          )}

          {savedId && !compositeAgentId && (
            <button onClick={() => setShowWorldPicker(true)} style={{
              background: "transparent", border: "1px solid #92400e",
              color: "#f59e0b", borderRadius: 8, padding: "7px 16px",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              Deploy
            </button>
          )}

          <button onClick={clearCanvas} style={{
            background: "transparent", border: "1px solid #1f2937",
            color: "#4b5563", borderRadius: 8, padding: "7px 12px",
            fontSize: 12, cursor: "pointer",
          }}>
            Clear
          </button>
        </div>

        {/* Canvas */}
        <div ref={reactFlowWrapper} style={{ flex: 1, position: "relative" }}
          onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes} edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            fitView
            deleteKeyCode="Backspace"
            style={{ background: "#0d1117" }}
          >
            <Background color="#1f2937" gap={24} size={1} />
            <Controls style={{ background: "#111827", border: "1px solid #1f2937" }} />
          </ReactFlow>

          {nodes.length === 0 && <EmptyCanvas onTemplate={loadTemplate} />}
        </div>
      </div>

      {/* ── Right panel — pipeline details ────────────────────────────────────── */}
      <div style={{
        width: 296, flexShrink: 0, background: "#111827",
        borderLeft: "1px solid #1f2937",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>

        <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid #1f2937" }}>
          <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
            Execution flow
          </div>
          {orderPreview.length === 0 && (
            <div style={{ color: "#374151", fontSize: 12, marginTop: 6 }}>
              Connect agents to see the order
            </div>
          )}
        </div>

        {/* Flow preview */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {orderPreview.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {orderPreview.map((d, i) => {
                const c = cat(d.category);
                return (
                  <div key={i}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "#1f2937", border: `1px solid #374151`,
                      borderLeft: `3px solid ${c.color}`,
                      borderRadius: 10, padding: "10px 12px",
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: `${c.color}22`, border: `1px solid ${c.color}60`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: c.color, fontSize: 10, fontWeight: 700, flexShrink: 0,
                      }}>
                        {i + 1}
                      </div>
                      <div>
                        <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                          {getDisplayName(d.rawName ?? d.label)}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 10 }}>{c.label}</div>
                      </div>
                    </div>
                    {i < orderPreview.length - 1 && (
                      <div style={{ color: "#374151", fontSize: 14, textAlign: "center", margin: "4px 0", lineHeight: 1 }}>↓</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Run result */}
          {runResult && <ResultCard result={runResult} />}

          {/* Deployed state */}
          {compositeAgentId && deployedWorld && (
            <div style={{
              background: `${deployedWorld.color}10`, border: `1px solid ${deployedWorld.color}40`,
              borderRadius: 12, padding: "14px 16px", marginTop: 12,
            }}>
              <div style={{ color: deployedWorld.color, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                Live in {deployedWorld.label}
              </div>
              <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 10 }}>
                Available in the Marketplace for other users to try.
              </div>
              <a href="/" style={{
                display: "inline-block", color: deployedWorld.color,
                fontSize: 11, fontWeight: 600, textDecoration: "none",
              }}>
                View in Agent City →
              </a>
            </div>
          )}
        </div>

        {/* Cost footer */}
        {nodes.length > 0 && (
          <div style={{
            borderTop: "1px solid #1f2937",
            padding: "14px 16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#6b7280", fontSize: 11 }}>Cost per run</span>
              <span style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 13 }}>
                ${totalCostUsd.toFixed(4)}
                <span style={{ color: "#4b5563", fontWeight: 400, fontSize: 10, marginLeft: 4 }}>
                  ({Math.round(totalCostUsd * 100)} credits)
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelineBuilder() {
  return (
    <ReactFlowProvider>
      <Builder />
    </ReactFlowProvider>
  );
}
