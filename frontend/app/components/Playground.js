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


// ── Category palette ──────────────────────────────────────────────────────────

const CAT = {
  trading:   { border: "#6BCF8B", bg: "#f0fdf5", text: "#1a5c3a", glow: "rgba(107,207,139,0.25)"  },
  analysis:  { border: "#B59CE6", bg: "#f8f5ff", text: "#3d2580", glow: "rgba(181,156,230,0.25)"  },
  data:      { border: "#6BB6E6", bg: "#f0f8ff", text: "#1a4d7a", glow: "rgba(107,182,230,0.25)"  },
  risk:      { border: "#E67B7B", bg: "#fff4f4", text: "#7a1a1a", glow: "rgba(230,123,123,0.25)"  },
  composite: { border: "#E6C36B", bg: "#fffcf0", text: "#7a5a0a", glow: "rgba(230,195,107,0.25)"  },
  default:   { border: "#9aabb8", bg: "#f5f7fa", text: "#3d5470", glow: "rgba(154,171,184,0.15)"  },
};
const cat = (c) => CAT[c] ?? CAT.default;

const CAT_ORDER = ["trading", "analysis", "data", "risk", "composite"];
const CAT_LABELS = { trading: "Trading", analysis: "Analysis", data: "Data", risk: "Risk", composite: "Composite" };

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

// ── Plaza map grid background ─────────────────────────────────────────────────

function PlazaGrid() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const cx = canvas.width / 2, cy = canvas.height / 2;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(cx, cy));
      bg.addColorStop(0, "#f8f0e3");
      bg.addColorStop(1, "#f4e7d0");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const gridSize = 48;
      ctx.strokeStyle = "rgba(200,184,154,0.3)"; ctx.lineWidth = 0.7;
      for (let x = cx % gridSize; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = cy % gridSize; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
      for (let r = 70; r < 900; r += 70) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180,160,120,${Math.max(0.04, 0.18 - r / 900 * 0.14)})`;
        ctx.lineWidth = r < 210 ? 1.2 : 0.7; ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 900, cy + Math.sin(a) * 900);
        ctx.strokeStyle = "rgba(160,140,100,0.08)"; ctx.lineWidth = 0.8; ctx.stroke();
      }
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 180);
      grd.addColorStop(0, "rgba(196,153,60,0.10)"); grd.addColorStop(1, "rgba(196,153,60,0)");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />;
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

function CatDot({ category, size = 14 }) {
  const c = cat(category);
  const L = { trading: "T", analysis: "A", data: "D", risk: "R", composite: "C", default: "·" };
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0,
      background: c.border, display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: Math.round(size * 0.58), fontWeight: 800, lineHeight: 1 }}>
      {L[category] ?? "·"}
    </div>
  );
}

const AgentNode = memo(({ data, selected }) => {
  const { zoom } = useViewport();
  const c = cat(data.category);
  const showDetails = zoom > 0.5;
  return (
    <div className={data.active ? "agent-node-active" : ""} style={{
      "--pulse-color": c.glow,
      background: "#fff",
      borderTop: `3px solid ${c.border}`,
      borderRight: `1px solid ${selected ? c.border : "#e6d6bd"}`,
      borderBottom: `1px solid ${selected ? c.border : "#e6d6bd"}`,
      borderLeft: `1px solid ${selected ? c.border : "#e6d6bd"}`,
      borderRadius: 12,
      padding: showDetails ? "9px 13px" : "7px 11px",
      minWidth: showDetails ? 155 : 110,
      cursor: "pointer", position: "relative",
      transition: "border-color 0.2s, min-width 0.2s",
      boxShadow: selected
        ? `0 0 0 2px ${c.border}40, 0 4px 16px rgba(0,0,0,0.10)`
        : "0 2px 8px rgba(0,0,0,0.07)",
    }}>
      {/* Floating revenue text */}
      {data.revenueFlash && (
        <div style={{ position: "absolute", top: -26, left: "50%",
          color: "#6BCF8B", fontWeight: 800, fontSize: 12,
          animation: "floatUp 1.5s ease-out forwards", pointerEvents: "none",
          whiteSpace: "nowrap", textShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
          +${data.revenueFlash}
        </div>
      )}

      <Handle type="target" position={Position.Left}
        style={{ background: c.border, border: "none", width: 8, height: 8 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: showDetails ? 5 : 3 }}>
        <CatDot category={data.category} size={13} />
        <div style={{ background: `${c.border}18`, color: c.border,
          borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 0.8 }}>
          {data.category}
        </div>
      </div>

      <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: showDetails ? 13 : 11, lineHeight: 1.2 }}>
        {data.label}
      </div>

      {showDetails && (
        <div style={{ color: "#9aabb8", fontSize: 9, marginTop: 3 }}>
          ${data.price}/call
        </div>
      )}

      {showDetails && data.requests > 0 && (
        <div style={{ marginTop: 5, display: "flex", gap: 8, fontSize: 10 }}>
          <span style={{ color: c.border, fontWeight: 700 }}>{data.requests} calls</span>
          <span style={{ color: "#9aabb8" }}>{data.latency ? `${Math.round(data.latency)}ms` : ""}</span>
        </div>
      )}

      {showDetails && data.lastOutput && !data.active && (
        <div style={{ marginTop: 7, background: "#f8f6f2", borderRadius: 6,
          padding: "5px 8px", border: "1px solid #e6d6bd" }}>
          {Object.entries(data.lastOutput)
            .filter(([k]) => k !== "market" && k !== "agent_id" && k !== "_mock")
            .slice(0, 3)
            .map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, lineHeight: 1.75 }}>
                <span style={{ color: "#9aabb8" }}>{k}</span>
                <span style={{ color: c.text, fontWeight: 700 }}>
                  {typeof v === "number" ? (v % 1 !== 0 ? v.toFixed(3) : v) : String(v).toUpperCase()}
                </span>
              </div>
            ))}
        </div>
      )}

      {data.active && (
        <div style={{ marginTop: 4, color: c.border, fontSize: 9, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 1 }}>● processing</div>
      )}

      <Handle type="source" position={Position.Right}
        style={{ background: c.border, border: "none", width: 8, height: 8 }} />
    </div>
  );
});
AgentNode.displayName = "AgentNode";

const CompositeNode = memo(({ data, selected }) => {
  const { zoom } = useViewport();
  const showDetails = zoom > 0.5;
  return (
    <div style={{ background: "#fff", border: `1px solid ${selected ? "#E6C36B" : "#e6d6bd"}`,
      borderTop: "3px solid #E6C36B", borderRadius: 12,
      padding: showDetails ? "9px 13px" : "7px 11px",
      minWidth: showDetails ? 165 : 120, position: "relative",
      boxShadow: selected ? "0 0 0 2px rgba(196,153,60,0.3), 0 4px 16px rgba(0,0,0,0.10)" : "0 2px 8px rgba(0,0,0,0.07)" }}>
      <Handle type="target" position={Position.Left} style={{ background: "#E6C36B", border: "none", width: 8, height: 8 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <CatDot category="composite" size={13} />
        <div style={{ background: "rgba(230,195,107,0.15)", color: "#E6C36B", borderRadius: 4,
          padding: "1px 6px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Composite</div>
      </div>
      <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: showDetails ? 13 : 11 }}>{data.label}</div>
      {showDetails && data.requests > 0 && (
        <div style={{ marginTop: 5, fontSize: 10, color: "#9aabb8" }}>
          <span style={{ color: "#E6C36B", fontWeight: 700 }}>{data.requests}</span> calls
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: "#E6C36B", border: "none", width: 8, height: 8 }} />
    </div>
  );
});
CompositeNode.displayName = "CompositeNode";

const PipelineNode = memo(({ data, selected }) => (
  <div style={{ background: "#fff",
    borderTop: "3px solid #8b6fd4",
    borderRight: `1.5px dashed ${selected ? "#8b6fd4" : "#c0aee8"}`,
    borderBottom: `1.5px dashed ${selected ? "#8b6fd4" : "#c0aee8"}`,
    borderLeft: `1.5px dashed ${selected ? "#8b6fd4" : "#c0aee8"}`,
    borderRadius: 12, padding: "10px 14px", minWidth: 200,
    boxShadow: selected ? "0 0 0 2px rgba(139,111,212,0.25), 0 4px 16px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.07)" }}>
    <Handle type="target" position={Position.Left} style={{ background: "#8b6fd4", border: "none", width: 8, height: 8 }} />
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid #8b6fd4" }} />
      <div style={{ color: "#8b6fd4", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Pipeline</div>
    </div>
    <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 13, marginBottom: 7 }}>{data.label}</div>
    {(data.agentNames || []).length > 0 && (
      <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
        {data.agentNames.map((name, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ background: "rgba(139,111,212,0.12)", color: "#8b6fd4", borderRadius: 5, padding: "2px 6px", fontSize: 9, fontWeight: 600 }}>{name}</span>
            {i < data.agentNames.length - 1 && <span style={{ color: "#c0aee8", fontSize: 10 }}>→</span>}
          </span>
        ))}
      </div>
    )}
    <Handle type="source" position={Position.Right} style={{ background: "#8b6fd4", border: "none", width: 8, height: 8 }} />
  </div>
));
PipelineNode.displayName = "PipelineNode";

const nodeTypes = { agent: AgentNode, composite: CompositeNode, pipeline: PipelineNode };

// ── Edge presets ──────────────────────────────────────────────────────────────

const E_IDLE      = { type: "particle", animated: false, style: { stroke: "#d0c4b0", strokeWidth: 1.5 }, data: { particles: false } };
const E_PIPE      = { type: "particle", style: { stroke: "#E6C36B", strokeWidth: 3 },   data: { particles: true, speed: 0.9 } };
const E_PIPE_IDLE = { type: "particle", animated: false, style: { stroke: "#b59ce6", strokeWidth: 2, strokeDasharray: "6 4" }, data: { particles: false } };

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
      width: collapsed ? 44 : 224,
      background: "rgba(255,252,248,0.97)", border: "1px solid #e6d6bd",
      borderRadius: 14, zIndex: 50, backdropFilter: "blur(12px)",
      transition: "width 0.2s ease", overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 14px",
        borderBottom: "1px solid #e6d6bd", flexShrink: 0 }}>
        {!collapsed && (
          <div style={{ flex: 1 }}>
            <div style={{ color: "#2d5a7a", fontSize: 11, fontWeight: 800,
              textTransform: "uppercase", letterSpacing: 1.2 }}>Agent Library</div>
            <div style={{ color: "#9aabb8", fontSize: 9, marginTop: 1 }}>drag onto canvas</div>
          </div>
        )}
        <button onClick={onToggle} style={{ background: "none", border: "none",
          color: "#334155", cursor: "pointer", fontSize: 18, padding: 0, marginLeft: "auto" }}>
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
                  marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${c.border}30` }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: c.border }} />
                  <span style={{ color: c.border, fontSize: 9, fontWeight: 800,
                    textTransform: "uppercase", letterSpacing: 1.2 }}>
                    {CAT_LABELS[catKey]}
                  </span>
                </div>
                {grouped[catKey].map((a) => (
                  <div key={a.id} draggable onDragStart={(e) => onDragAgent(e, a)}
                    style={{ background: "#fff", border: "1px solid #e6d6bd",
                      borderLeft: `3px solid ${c.border}`,
                      borderRadius: 7, padding: "7px 9px", marginBottom: 5,
                      cursor: "grab", userSelect: "none",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      transition: "box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 2px 8px ${c.border}30`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}>
                    <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 12, lineHeight: 1.2 }}>{a.name}</div>
                    <div style={{ color: "#9aabb8", fontSize: 9, marginTop: 3 }}>
                      ${a.price_per_request}/call
                      {a.requests > 0 && <span style={{ color: c.border, marginLeft: 6 }}>·{a.requests} calls</span>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {agents.length === 0 && (
            <div style={{ color: "#9aabb8", fontSize: 11, fontStyle: "italic", padding: "12px 4px",
              textAlign: "center", lineHeight: 1.5 }}>
              No agents registered.<br />Go to Developer Hub to add one.
            </div>
          )}

          {/* Saved Pipelines */}
          {pipelines.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ color: "#8b6fd4", fontSize: 9, fontWeight: 800,
                textTransform: "uppercase", letterSpacing: 1.2,
                marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #c0aee840" }}>
                Saved Pipelines
              </div>
              {pipelines.map((p) => {
                const names = p.agent_ids.map((id) => agentMap[id] ?? "…");
                return (
                  <div key={p.id} draggable onDragStart={(e) => onDragPipeline(e, p, names)}
                    style={{ background: "#fff", border: "1.5px dashed #c0aee8",
                      borderRadius: 7, padding: "7px 9px", marginBottom: 5,
                      cursor: "grab", userSelect: "none" }}>
                    <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 12 }}>{p.name}</div>
                    <div style={{ color: "#9aabb8", fontSize: 9, marginTop: 2 }}>
                      {names.slice(0, 3).join(" → ")}{names.length > 3 ? " …" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Composite Agents */}
          {composites.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ color: "#E6C36B", fontSize: 9, fontWeight: 800,
                textTransform: "uppercase", letterSpacing: 1.2,
                marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #E6C36B40" }}>
                Composite Agents
              </div>
              {composites.map((a) => (
                <div key={a.id} draggable onDragStart={(e) => onDragAgent(e, a)}
                  style={{ background: "#fff", border: "1px solid #e6d6bd",
                    borderLeft: "3px solid #E6C36B",
                    borderRadius: 7, padding: "7px 9px", marginBottom: 5,
                    cursor: "grab", userSelect: "none" }}>
                  <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 12 }}>{a.name}</div>
                  <div style={{ color: "#9aabb8", fontSize: 9, marginTop: 2 }}>composite · ${a.price_per_request}/call</div>
                </div>
              ))}
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
    body: "This is where you chain AI agents together — like building an assembly line. Each agent does one job and passes its result to the next.",
    cta: "Show me how",
  },
  {
    title: "Step 1 — Pick an agent",
    body: "See the panel on the left? Those are your agents. Drag one onto the canvas — try PriceFeedAgent or MomentumAgent.",
    cta: "Got it",
  },
  {
    title: "Step 2 — Connect them",
    body: "Drag a second agent onto the canvas. Then hover over the first one — a dot appears on its right edge. Drag from that dot to the second agent.",
    cta: "Got it",
  },
  {
    title: "Step 3 — Run it",
    body: "Hit the Run button at the top. Watch live data flow from agent to agent. Each one calls a real API and passes its result forward.",
    cta: "Got it",
  },
  {
    title: "That's it",
    body: "You just built a real AI pipeline. Each call costs a tiny fee (fractions of a cent) — that's how developers earn on AgentVerse.",
    cta: "Let's go",
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
      {/* Re-open button when dismissed */}
      {!visible && (
        <button onClick={reopen} style={{
          position: "absolute", bottom: 90, left: 16, zIndex: 200,
          background: "rgba(255,252,248,0.97)", border: "1px solid #e6d6bd",
          borderRadius: 20, padding: "6px 14px",
          fontSize: 11, fontWeight: 700, color: "#9aabb8",
          cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 13 }}>?</span> How does this work?
        </button>
      )}

      {/* Guide bubble */}
      {visible && open && (
        <div style={{
          position: "absolute", bottom: 90, left: 16, zIndex: 200,
          width: 270,
          background: "rgba(255,252,248,0.99)", border: "1px solid #e6d6bd",
          borderRadius: 16, padding: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          animation: "spFadeUp 0.3s ease forwards",
        }}>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {GUIDE_STEPS.map((_, i) => (
              <div key={i} style={{
                height: 3, flex: i === step ? 2 : 1,
                borderRadius: 2,
                background: i === step ? "#4a9fd4" : i < step ? "#4a9fd460" : "#e6d6bd",
                transition: "all 0.3s ease",
              }} />
            ))}
          </div>

          {/* Avatar + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, #4a9fd4, #6BCF8B)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, flexShrink: 0,
            }}>A</div>
            <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 13 }}>{s.title}</div>
          </div>

          {/* Body */}
          <p style={{ color: "#6b7d92", fontSize: 12, lineHeight: 1.6, margin: "0 0 14px 0" }}>
            {s.body}
          </p>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={dismiss} style={{
              background: "none", border: "none", color: "#b8c4d0",
              fontSize: 11, cursor: "pointer", padding: 0, fontWeight: 600,
            }}>
              Skip
            </button>
            <button onClick={next} style={{
              background: "#4a9fd4", border: "none", color: "#fff",
              borderRadius: 8, padding: "7px 16px",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              {s.cta}
            </button>
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
      <div style={{ color: "#b8a898", fontSize: 14, fontWeight: 700, marginBottom: 20 }}>
        Build AI pipelines by connecting agents
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        {[
          ["①", "Drag an agent", "from the left panel"],
          ["②", "Connect agents", "draw edges between nodes"],
          ["③", "Click Run", "watch revenue flow"],
        ].map(([num, title, sub]) => (
          <div key={num} style={{ background: "rgba(255,252,248,0.9)", border: "1px solid #e6d6bd",
            borderRadius: 12, padding: "14px 16px", minWidth: 120,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ color: "#c4a85a", fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{num}</div>
            <div style={{ color: "#2d3a4a", fontSize: 11, fontWeight: 700 }}>{title}</div>
            <div style={{ color: "#9aabb8", fontSize: 10, marginTop: 3 }}>{sub}</div>
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
      position: "absolute", right: 16, top: 16, width: 240,
      background: "rgba(255,252,248,0.97)", border: "1px solid #e6d6bd",
      borderTop: "3px solid #6BCF8B",
      borderRadius: 14, padding: "14px", zIndex: 50,
      backdropFilter: "blur(20px)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ color: "#9aabb8", fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 1 }}>Pipeline Results</div>
          {running && (
            <div style={{ color: "#6BCF8B", fontSize: 10, fontWeight: 700, marginTop: 2 }}>● executing…</div>
          )}
        </div>
        {!running && <button onClick={onClose} style={{ background: "none", border: "none",
          color: "#9aabb8", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {results.map((r, i) => {
          const c = cat(r.category);
          return (
            <div key={i} style={{ background: "#f8f6f2", borderRadius: 8, padding: "8px 10px",
              borderLeft: `3px solid ${r.done ? c.border : "#e6d6bd"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <CatDot category={r.category} size={11} />
                <span style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 12 }}>{r.agentName}</span>
                {r.done && <span style={{ marginLeft: "auto", color: "#6BCF8B", fontSize: 10 }}>✓</span>}
                {!r.done && <span style={{ marginLeft: "auto", color: c.border, fontSize: 9 }}>●</span>}
              </div>
              {r.done && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                  <span style={{ color: "#9aabb8" }}>latency</span>
                  <span style={{ color: "#2d3a4a", fontWeight: 600 }}>{Math.round(r.latency)}ms</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 2 }}>
                <span style={{ color: "#9aabb8" }}>cost</span>
                <span style={{ color: c.border, fontWeight: 700 }}>${r.cost.toFixed(4)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {!running && results.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e6d6bd",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#9aabb8", fontSize: 11, fontWeight: 600 }}>Total cost</span>
          <span style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 14 }}>${totalCost.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}

// ── Inspector (single agent detail) ──────────────────────────────────────────

function Inspector({ node, onCall, onClose, lastOutput }) {
  if (!node) return null;
  const c = cat(node.data.category);
  return (
    <div style={{
      position: "absolute", right: 16, top: 16, width: 240,
      background: "rgba(255,252,248,0.97)", border: `1px solid #e6d6bd`,
      borderTop: `3px solid ${c.border}`,
      borderRadius: 14, padding: "16px 14px", zIndex: 51,
      overflowY: "auto", backdropFilter: "blur(20px)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ color: c.border, fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 1 }}>{node.data.category}</div>
          <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 15, marginTop: 3 }}>{node.data.label}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none",
          color: "#9aabb8", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ background: "#f8f6f2", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
        {[
          ["Requests",    node.data.requests || 0],
          ["Avg latency", node.data.latency ? `${Math.round(node.data.latency)}ms` : "—"],
          ["Earnings",    node.data.earnings ? `$${Number(node.data.earnings).toFixed(4)}` : "—"],
          ["Price/call",  `$${node.data.price}`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between",
            padding: "4px 0", fontSize: 12, borderBottom: "1px solid #e6d6bd" }}>
            <span style={{ color: "#9aabb8" }}>{k}</span>
            <span style={{ color: "#2d3a4a", fontWeight: 600 }}>{v}</span>
          </div>
        ))}
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
        width: "100%", background: `${c.border}18`, color: c.border,
        border: `1px solid ${c.border}44`, borderRadius: 8, padding: "9px",
        fontSize: 13, cursor: "pointer", fontWeight: 700,
      }}>Call Agent</button>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Btn({ onClick, color, disabled, children, large }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? "#f0ece6" : `${color}18`,
      color: disabled ? "#c0b8ae" : color,
      border: `1px solid ${disabled ? "#e6d6bd" : `${color}50`}`,
      borderRadius: 9, padding: large ? "8px 20px" : "6px 14px",
      fontSize: large ? 13 : 12, cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 700, transition: "background 0.15s",
    }}>{children}</button>
  );
}

function Toolbar({ pipelineName, setPipelineName, onSave, onRun, onRegister, onClear,
  savedId, running, compositeId, canRun, onDemoRun, demoName }) {
  return (
    <div style={{
      position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 50, display: "flex", alignItems: "center", gap: 8,
      background: "rgba(255,252,248,0.97)", border: "1px solid #e6d6bd",
      borderRadius: 14, padding: "8px 14px",
      backdropFilter: "blur(20px)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
    }}>
      {/* Demo run — primary CTA */}
      {demoName && (
        <Btn onClick={onDemoRun} color="#4DD9B8" disabled={running} large>
          {running ? "⏳ Running…" : `▶ Run Demo`}
        </Btn>
      )}

      <div style={{ width: 1, height: 22, background: "#e6d6bd" }} />

      <input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)}
        placeholder="Name your pipeline…" style={{
          background: "#f8f6f2", border: "1px solid #e6d6bd", borderRadius: 8,
          color: "#2d3a4a", padding: "7px 12px", fontSize: 12, width: 160, outline: "none",
        }} />
      <Btn onClick={onSave} color="#6BCF8B" disabled={!pipelineName || !canRun}>Save</Btn>
      {savedId && <Btn onClick={onRun} color="#8b6fd4" disabled={running}>{running ? "Running…" : "Run"}</Btn>}
      {savedId && !compositeId && <Btn onClick={onRegister} color="#E6C36B">Register</Btn>}
      {compositeId && <span style={{ color: "#E6C36B", fontSize: 11, fontWeight: 700 }}>✓ Registered</span>}

      <div style={{ width: 1, height: 22, background: "#e6d6bd" }} />
      <Btn onClick={onClear} color="#9aabb8">Clear</Btn>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, background: "rgba(255,252,248,0.97)", border: "1px solid #6BCF8B",
      borderRadius: 10, padding: "8px 24px", color: "#1a6642", fontSize: 12,
      fontWeight: 600, backdropFilter: "blur(12px)",
      boxShadow: "0 4px 16px rgba(74,184,122,0.15)", whiteSpace: "nowrap",
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
    if (!backendOk) { showToast("Start the backend to save pipelines: uvicorn main:app --port 8000"); return; }
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
    if (!backendOk) { showToast("Start the backend to run pipelines: uvicorn main:app --port 8000"); return; }
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

  // Empty canvas = no user-placed nodes (only demo nodes are on canvas)
  const isEmpty = nodes.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#f4e7d0" }}
      ref={wrapperRef} onDragOver={onDragOver} onDrop={onDrop}>

      <style>{GLOBAL_CSS}</style>

      <PlazaGrid />
      <Toast msg={toast} />

      {/* Backend offline banner */}
      {!backendOk && (
        <div style={{
          position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, background: "rgba(230,123,123,0.97)", borderRadius: 10,
          padding: "8px 20px", color: "#fff", fontSize: 12, fontWeight: 700,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          Backend offline — run <code style={{ background: "rgba(255,255,255,0.2)", borderRadius: 4, padding: "1px 6px" }}>uvicorn main:app --port 8000</code> then reload
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

      {/* Onboarding hints — only when canvas is empty */}
      {isEmpty && <OnboardingHints />}

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
        <Background color="transparent" />
        <Controls style={{ bottom: 90, right: 16 }} />
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
