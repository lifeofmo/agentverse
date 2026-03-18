"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactFlow, {
  Background, Controls,
  addEdge, useNodesState, useEdgesState,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";

import { API as REGISTRY_URL } from "@/app/lib/config";

const WORLDS = [
  { id: "trading",  label: "Las Vegas",     sub: "High-stakes trading agents",    color: "#ff2d78", bg: "#1a0008" },
  { id: "data",     label: "Matrix",        sub: "Data & feed agents",            color: "#00FF41", bg: "#010d01" },
  { id: "analysis", label: "Sims",          sub: "Analysis & pattern agents",     color: "#7ec87e", bg: "#1a2e10" },
  { id: "risk",     label: "Tomorrowland",  sub: "Risk & portfolio agents",       color: "#c084fc", bg: "#0a0018" },
  { id: "composite",label: "Hogwarts",      sub: "All agents — no category",      color: "#d4a820", bg: "#110d02" },
  { id: "experimental", label: "Burning Man", sub: "Experimental & creative",    color: "#FF6B35", bg: "#180800" },
];

function WorldPickerModal({ pipelineName, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "#0a111e", border: "1px solid #1e293b",
        borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 480,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
      }}>
        <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
          Choose a world
        </div>
        <div style={{ color: "#475569", fontSize: 12, marginBottom: 20 }}>
          Where should <span style={{ color: "#e2e8f0", fontWeight: 600 }}>"{pipelineName}"</span> live?
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {WORLDS.map((w) => (
            <button key={w.id} onClick={() => setSelected(w.id)} style={{
              background: selected === w.id ? w.bg : "#0f172a",
              border: `1.5px solid ${selected === w.id ? w.color : "#1e293b"}`,
              borderRadius: 10, padding: "12px 14px", cursor: "pointer",
              textAlign: "left", transition: "all 0.15s",
              boxShadow: selected === w.id ? `0 0 0 1px ${w.color}40` : "none",
            }}>
              <div style={{ color: w.color, fontWeight: 700, fontSize: 13 }}>{w.label}</div>
              <div style={{ color: "#475569", fontSize: 10, marginTop: 3 }}>{w.sub}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            background: "transparent", border: "1px solid #1e293b",
            color: "#475569", borderRadius: 8, padding: "8px 16px",
            fontSize: 13, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => selected && onConfirm(selected)} disabled={!selected} style={{
            background: selected ? WORLDS.find(w => w.id === selected)?.color : "#1e293b",
            border: "none", color: selected ? "#000" : "#475569",
            borderRadius: 8, padding: "8px 20px",
            fontSize: 13, fontWeight: 700, cursor: selected ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}>
            Deploy to {selected ? WORLDS.find(w => w.id === selected)?.label : "…"}
          </button>
        </div>
      </div>
    </div>
  );
}

const CATEGORY_COLOR = {
  trading:  { bg: "#064e3b", border: "#10b981", text: "#d1fae5" },
  analysis: { bg: "#1e1b4b", border: "#818cf8", text: "#c7d2fe" },
  data:     { bg: "#0c1a2e", border: "#38bdf8", text: "#bae6fd" },
  risk:     { bg: "#3b0764", border: "#c084fc", text: "#e9d5ff" },
  default:  { bg: "#1e293b", border: "#64748b", text: "#cbd5e1" },
};

function agentStyle(category) {
  return CATEGORY_COLOR[category] ?? CATEGORY_COLOR.default;
}

// ── Canvas agent node ────────────────────────────────────────────────────────

function AgentCanvasNode({ data }) {
  const s = agentStyle(data.category);
  return (
    <div style={{
      background: s.bg, color: s.text, border: `2px solid ${s.border}`,
      borderRadius: 10, padding: "10px 16px", fontSize: 12, minWidth: 130,
      textAlign: "center",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{data.label}</div>
      <div style={{ color: s.border, fontSize: 10 }}>{data.category}</div>
      <div style={{ color: "#64748b", fontSize: 10 }}>${data.price}/req</div>
    </div>
  );
}

const nodeTypes = { agent: AgentCanvasNode };

// ── Topological sort → pipeline order ────────────────────────────────────────

function topoSort(nodes, edges) {
  const inDeg  = Object.fromEntries(nodes.map((n) => [n.id, 0]));
  const adj    = Object.fromEntries(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    adj[e.source].push(e.target);
    inDeg[e.target] = (inDeg[e.target] ?? 0) + 1;
  }
  const queue  = nodes.filter((n) => inDeg[n.id] === 0).map((n) => n.id);
  const result = [];
  while (queue.length) {
    const cur = queue.shift();
    result.push(cur);
    for (const next of adj[cur]) {
      inDeg[next]--;
      if (inDeg[next] === 0) queue.push(next);
    }
  }
  return result;
}

// ── Main builder ─────────────────────────────────────────────────────────────

function Builder() {
  const reactFlowWrapper = useRef(null);
  const [rfInstance, setRfInstance]   = useState(null);
  const [agents, setAgents]           = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [pipelineName, setPipelineName]  = useState("");
  const [status, setStatus]              = useState(null);  // { ok, msg }
  const [runResult, setRunResult]        = useState(null);  // pipeline run output
  const [savedId, setSavedId]            = useState(null);  // saved pipeline id
  const [running, setRunning]            = useState(false);
  const [compositeAgentId, setCompositeAgentId] = useState(null);
  const [showWorldPicker, setShowWorldPicker]   = useState(false);
  const [deployedWorld, setDeployedWorld]       = useState(null);
  const idCounter = useRef(0);

  useEffect(() => {
    fetch(`${REGISTRY_URL}/agents`)
      .then((r) => r.json())
      .then(setAgents);
  }, []);

  // ── Drag from panel ────────────────────────────────────────────────────────

  const onDragStart = (e, agent) => {
    e.dataTransfer.setData("application/agentverse", JSON.stringify(agent));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const raw = e.dataTransfer.getData("application/agentverse");
    if (!raw || !rfInstance) return;
    const agent = JSON.parse(raw);
    const pos = rfInstance.screenToFlowPosition({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    });
    idCounter.current += 1;
    const newNode = {
      id: `${agent.id}-${idCounter.current}`,
      type: "agent",
      position: pos,
      data: { label: agent.name, category: agent.category, price: agent.price_per_request, agentId: agent.id, ownerWallet: agent.owner_wallet || "" },
    };
    setNodes((ns) => [...ns, newNode]);
  }, [rfInstance, setNodes]);

  const onConnect = useCallback(
    (params) => setEdges((es) => addEdge({ ...params, animated: true, style: { stroke: "#10b981", strokeWidth: 2 } }, es)),
    [setEdges]
  );

  // ── Save pipeline ──────────────────────────────────────────────────────────

  const savePipeline = async () => {
    if (!pipelineName.trim()) { setStatus({ ok: false, msg: "Give it a name first" }); return; }
    if (nodes.length < 2)     { setStatus({ ok: false, msg: "Add at least 2 agents" }); return; }

    const orderedIds = topoSort(nodes, edges).map((nodeId) => {
      const node = nodes.find((n) => n.id === nodeId);
      return node?.data.agentId;
    }).filter(Boolean);

    if (orderedIds.length < 2) {
      setStatus({ ok: false, msg: "Connect the agents with edges" });
      return;
    }

    const res = await fetch(`${REGISTRY_URL}/pipelines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pipelineName, agent_ids: orderedIds }),
    });
    const saved = await res.json();
    setSavedId(saved.id);
    setStatus({ ok: true, msg: `Saved as "${saved.name}"` });
  };

  // ── Run pipeline ───────────────────────────────────────────────────────────

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

      // Async queued response — poll /jobs/{job_id} until done
      if (data.job_id && data.status === "queued") {
        setStatus({ ok: true, msg: `Queued (job ${data.job_id.slice(0, 8)}…) — waiting for worker…` });
        let attempts = 0;
        while (attempts < 30) {
          await new Promise(r => setTimeout(r, 1000));
          attempts++;
          const poll = await fetch(`${REGISTRY_URL}/jobs/${data.job_id}`);
          const job  = await poll.json();
          if (job.status === "completed") { setRunResult(job.result); break; }
          if (job.status === "failed")    { setStatus({ ok: false, msg: `Job failed: ${job.error}` }); break; }
          setStatus({ ok: true, msg: `Worker running… (${attempts}s)` });
        }
      } else {
        // Sync response (no Redis)
        setRunResult(data);
      }
    } catch (err) {
      setStatus({ ok: false, msg: String(err) });
    }
    setRunning(false);
  };

  // ── Clear canvas ───────────────────────────────────────────────────────────

  // ── Register pipeline as composite agent ───────────────────────────────────

  const registerAsAgent = async (worldCategory) => {
    if (!savedId) { setStatus({ ok: false, msg: "Save the pipeline first" }); return; }
    const world = WORLDS.find(w => w.id === worldCategory);
    const res = await fetch(`${REGISTRY_URL}/pipelines/${savedId}/register-as-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: worldCategory }),
    });
    if (!res.ok) { setStatus({ ok: false, msg: "Registration failed" }); return; }
    const agent = await res.json();
    setCompositeAgentId(agent.id);
    setDeployedWorld(world);
    setShowWorldPicker(false);
  };

  // ── Clear canvas ───────────────────────────────────────────────────────────

  const clearCanvas = () => {
    setNodes([]); setEdges([]);
    setPipelineName(""); setStatus(null);
    setRunResult(null); setSavedId(null); setCompositeAgentId(null);
  };

  const inputStyle = {
    width: "100%", background: "#0f172a", border: "1px solid #334155",
    borderRadius: 6, color: "#f1f5f9", padding: "7px 10px",
    fontSize: 13, boxSizing: "border-box",
  };

  const orderPreview = topoSort(nodes, edges)
    .map((id) => nodes.find((n) => n.id === id)?.data.label)
    .filter(Boolean);

  // Cost + x402 detection
  const totalCostUsd  = nodes.reduce((s, n) => s + (n.data.price || 0), 0);
  const totalCredits  = Math.round(totalCostUsd * 100);
  const hasX402Agents = nodes.some(n => n.data.ownerWallet?.startsWith("0x") && n.data.ownerWallet?.length === 42);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#0f172a" }}>

      {/* ── Left panel — agent library ── */}
      <div style={{
        width: 220, flexShrink: 0, background: "#0a111e",
        borderRight: "1px solid #1e293b", padding: "16px 12px",
        overflowY: "auto",
      }}>
        <a href="/" style={{ color: "#3b82f6", fontSize: 12, textDecoration: "none" }}>← Map</a>
        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15, margin: "10px 0 14px" }}>
          Pipeline Builder
        </div>

        <div style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          Agents  ·  drag to canvas
        </div>

        {agents.map((a) => {
          const s = agentStyle(a.category);
          return (
            <div key={a.id} draggable
              onDragStart={(e) => onDragStart(e, a)}
              style={{
                background: s.bg, border: `1px solid ${s.border}`, color: s.text,
                borderRadius: 8, padding: "8px 10px", marginBottom: 8,
                cursor: "grab", fontSize: 12, userSelect: "none",
              }}>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div style={{ color: s.border, fontSize: 10, marginTop: 2 }}>
                {a.category}  ·  {Math.round(a.price_per_request * 100)} credits
              </div>
              {a.owner_wallet?.startsWith("0x") && (
                <div style={{ color: "#c084fc", fontSize: 9, marginTop: 2 }}>⚡ x402 direct calls</div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: 20, color: "#334155", fontSize: 11, lineHeight: 1.7 }}>
          Drag agents onto the canvas
          <br />Connect them in order
          <br />Save → Run
          <br />—
          <br />Orange = active node
        </div>
      </div>

      {/* ── Center — ReactFlow canvas ── */}
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
        >
          <Background color="#1e293b" gap={24} />
          <Controls />
        </ReactFlow>

        {/* Empty state hint */}
        {nodes.length === 0 && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#1e293b", fontSize: 18, fontWeight: 600,
            textAlign: "center", pointerEvents: "none",
          }}>
            Drag agents here
            <div style={{ fontSize: 13, marginTop: 8, color: "#1e293b" }}>
              then connect them in order
            </div>
          </div>
        )}
      </div>

      {showWorldPicker && (
        <WorldPickerModal
          pipelineName={pipelineName}
          onConfirm={registerAsAgent}
          onCancel={() => setShowWorldPicker(false)}
        />
      )}

      {/* ── Right panel — save / run ── */}
      <div style={{
        width: 240, flexShrink: 0, background: "#0a111e",
        borderLeft: "1px solid #1e293b", padding: "16px 12px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>Save Pipeline</div>

        <input placeholder="Pipeline name" value={pipelineName}
          onChange={(e) => setPipelineName(e.target.value)}
          style={inputStyle} />

        {/* Order preview */}
        {orderPreview.length > 0 && (
          <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px", fontSize: 12 }}>
            <div style={{ color: "#64748b", marginBottom: 6, fontSize: 11 }}>Execution order:</div>
            {orderPreview.map((name, i) => (
              <div key={i} style={{ color: "#94a3b8", lineHeight: 1.8 }}>
                {i > 0 && <span style={{ color: "#334155" }}>  ↓<br /></span>}
                <span style={{ color: "#e2e8f0" }}>{i + 1}. {name}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={savePipeline} style={{
          background: "#059669", color: "#fff", border: "none",
          borderRadius: 8, padding: "9px", fontSize: 13,
          cursor: "pointer", fontWeight: 600,
        }}>
          Save Pipeline
        </button>

        {/* Cost preview */}
        {nodes.length > 0 && (
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>PIPELINE COST</div>
            <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>
              {totalCredits} credits
              <span style={{ color: "#475569", fontWeight: 400, fontSize: 11, marginLeft: 6 }}>(${totalCostUsd.toFixed(4)})</span>
            </div>
            {hasX402Agents && (
              <div style={{ marginTop: 6, background: "#2d1f4e", border: "1px solid #7c3aed40", borderRadius: 6, padding: "6px 8px", fontSize: 10, color: "#c4b5fd" }}>
                ⚡ Contains x402 agent — pipeline runs on credits only. x402 payments apply to direct agent calls.
              </div>
            )}
          </div>
        )}

        {savedId && (
          <>
            <button onClick={runPipeline} disabled={running} style={{
              background: running ? "#374151" : "#7c3aed", color: "#fff",
              border: "none", borderRadius: 8, padding: "9px", fontSize: 13,
              cursor: running ? "not-allowed" : "pointer", fontWeight: 600,
            }}>
              {running ? "Running…" : "▶ Run Pipeline"}
            </button>
            {!compositeAgentId && (
              <button onClick={() => setShowWorldPicker(true)} style={{
                background: "#0f172a", color: "#f59e0b",
                border: "1px solid #b45309", borderRadius: 8,
                padding: "9px", fontSize: 13, cursor: "pointer", fontWeight: 600,
              }}>
                ⬡ Deploy to a World
              </button>
            )}
            {compositeAgentId && deployedWorld && (
              <div style={{
                background: deployedWorld.bg, border: `1px solid ${deployedWorld.color}40`,
                borderRadius: 8, padding: "10px 12px", fontSize: 11,
              }}>
                <div style={{ color: deployedWorld.color, fontWeight: 700, marginBottom: 4 }}>
                  Live in {deployedWorld.label}
                </div>
                <div style={{ color: "#475569" }}>
                  Your agent is now active in the {deployedWorld.label} world
                </div>
                <a href="/" style={{
                  display: "inline-block", marginTop: 8,
                  color: deployedWorld.color, fontSize: 11, fontWeight: 600,
                  textDecoration: "none",
                }}>
                  Go see it in Agent City →
                </a>
              </div>
            )}
          </>
        )}

        <button onClick={clearCanvas} style={{
          background: "transparent", color: "#475569",
          border: "1px solid #1e293b", borderRadius: 8,
          padding: "7px", fontSize: 12, cursor: "pointer",
        }}>
          Clear Canvas
        </button>

        {/* Status */}
        {status && (
          <div style={{
            background: status.ok ? "#064e3b" : "#450a0a",
            color: status.ok ? "#d1fae5" : "#fca5a5",
            border: `1px solid ${status.ok ? "#10b981" : "#ef4444"}`,
            borderRadius: 8, padding: "8px 10px", fontSize: 12,
          }}>
            {status.msg}
          </div>
        )}

        {/* Run result */}
        {runResult && (
          <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px", fontSize: 11 }}>
            <div style={{ color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>Final state:</div>
            {Object.entries(runResult.final).filter(([k]) => k !== "market").map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", lineHeight: 1.9 }}>
                <span style={{ color: "#64748b" }}>{k}</span>
                <span style={{ color: "#e2e8f0" }}>{typeof v === "number" ? v : String(v)}</span>
              </div>
            ))}
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
