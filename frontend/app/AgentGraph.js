"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";

import { API as REGISTRY_URL, WS as WS_URL } from "@/app/lib/config";

const EDGE_IDLE     = { animated: false, style: { stroke: "#3b82f6", strokeWidth: 2 } };
const EDGE_ACTIVE   = { animated: true,  style: { stroke: "#10b981", strokeWidth: 3 } };
const EDGE_PIPELINE = { animated: true,  style: { stroke: "#f59e0b", strokeWidth: 4 } };

const registryNode = {
  id: "registry",
  position: { x: 350, y: 40 },
  data: { label: "AgentVerse Registry" },
  style: {
    background: "#1e40af", color: "#fff",
    border: "2px solid #3b82f6", borderRadius: 12,
    padding: "10px 24px", fontWeight: "bold", fontSize: 14,
  },
};

function nodeSize(requests) { return 1 + Math.min(requests / 100, 1); }

function buildAgentNode(agent, metrics, i, total, active = false) {
  const reqs  = metrics?.requests ?? 0;
  const lat   = metrics?.avg_latency_ms ?? 0;
  const earn  = metrics?.earnings ?? 0;
  const scale = nodeSize(reqs);
  const spread = Math.max(total * 210, 700);
  const startX = (800 - spread) / 2 + 80;
  return {
    id: agent.id,
    position: { x: startX + i * (spread / Math.max(total - 1, 1)), y: 260 },
    data: {
      label: [
        agent.name,
        `$${agent.price_per_request}/req`,
        reqs > 0 ? `▶ ${reqs} calls · ${lat}ms` : "no calls yet",
        reqs > 0 ? `earned $${earn}` : "",
      ].filter(Boolean).join("\n"),
    },
    style: {
      background: active ? "#78350f" : "#064e3b",
      color: active ? "#fef3c7" : "#d1fae5",
      border: `2px solid ${active ? "#f59e0b" : reqs > 50 ? "#f59e0b" : "#10b981"}`,
      borderRadius: 12,
      padding: `${8 * scale}px ${14 * scale}px`,
      whiteSpace: "pre-wrap", textAlign: "center",
      fontSize: Math.round(11 * scale),
      transition: "all 0.35s ease",
      boxShadow: active ? "0 0 18px rgba(245,158,11,0.6)" : "none",
    },
  };
}

// ── Sidebar atoms ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 8,
      textTransform: "uppercase", letterSpacing: 1 }}>
      {children}
    </div>
  );
}

function TabBar({ tab, setTab }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
      {["pipelines", "challenges"].map((t) => (
        <button key={t} onClick={() => setTab(t)} style={{
          flex: 1, padding: "5px 0", fontSize: 11, borderRadius: 6,
          border: "none", cursor: "pointer",
          background: tab === t ? "#1d4ed8" : "#1e293b",
          color: tab === t ? "#bfdbfe" : "#64748b",
          fontWeight: tab === t ? 600 : 400,
          textTransform: "capitalize",
        }}>
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentGraph() {
  const [nodes, setNodes]         = useState([registryNode]);
  const [edges, setEdges]         = useState([]);
  const [toast, setToast]         = useState(null);
  const [tab, setTab]             = useState("pipelines");

  // Pipelines
  const [pipelines, setPipelines]     = useState([]);
  const [newPipeline, setNewPipeline] = useState({ name: "", agent_ids: [] });
  const [showBuilder, setShowBuilder] = useState(false);

  // Challenges
  const [challenges, setChallenges]         = useState([]);
  const [leaderboards, setLeaderboards]     = useState({});   // challenge_id → entries[]
  const [openChallenge, setOpenChallenge]   = useState(null); // id being viewed
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [newChallenge, setNewChallenge]     = useState({
    title: "", description: "", reward: 50, scoring_field: "confidence",
  });
  // submit modal: { challengeId }
  const [submitting, setSubmitting] = useState(null);

  const agentsRef  = useRef([]);
  const metricsRef = useRef({});
  const activeRef  = useRef(new Set());

  const rebuildNodes = useCallback(() => {
    const agents = agentsRef.current;
    setNodes([
      registryNode,
      ...agents.map((a, i) =>
        buildAgentNode(a, metricsRef.current[a.id], i, agents.length, activeRef.current.has(a.id))
      ),
    ]);
  }, []);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    const [agentsRes, metricsRes, pipelinesRes, challengesRes] = await Promise.all([
      fetch(`${REGISTRY_URL}/agents`),
      fetch(`${REGISTRY_URL}/metrics`),
      fetch(`${REGISTRY_URL}/pipelines`),
      fetch(`${REGISTRY_URL}/challenges`),
    ]);
    const agents     = await agentsRes.json();
    const metrics    = await metricsRes.json();
    const pipelines  = await pipelinesRes.json();
    const challenges = await challengesRes.json();

    agentsRef.current  = agents;
    metricsRef.current = Object.fromEntries(metrics.map((m) => [m.agent_id, m]));
    setPipelines(pipelines);
    setChallenges(challenges);

    const pipelineEdges = [];
    for (const p of pipelines) {
      for (let i = 0; i < p.agent_ids.length - 1; i++) {
        pipelineEdges.push({
          id: `pipe-${p.id}-${i}`,
          source: p.agent_ids[i], target: p.agent_ids[i + 1],
          ...EDGE_IDLE,
          style: { stroke: "#6366f1", strokeWidth: 2, strokeDasharray: "6 3" },
        });
      }
    }
    setEdges([
      ...agents.map((a) => ({ id: `registry-${a.id}`, source: "registry", target: a.id, ...EDGE_IDLE })),
      ...pipelineEdges,
    ]);
    rebuildNodes();
  }, [rebuildNodes]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadLeaderboard = useCallback(async (challengeId) => {
    const res = await fetch(`${REGISTRY_URL}/challenges/${challengeId}/leaderboard`);
    const entries = await res.json();
    setLeaderboards((prev) => ({ ...prev, [challengeId]: entries }));
  }, []);

  // ── Edge helpers ────────────────────────────────────────────────────────────

  const flashEdge = useCallback((edgeId, style, duration = 2500) => {
    setEdges((prev) => prev.map((e) => (e.id === edgeId ? { ...e, ...style } : e)));
    setTimeout(() => {
      setEdges((prev) => prev.map((e) => (e.id === edgeId ? { ...e, ...EDGE_IDLE } : e)));
    }, duration);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── WebSocket ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (e) => {
      const ev = JSON.parse(e.data);

      if (ev.type === "agent_call_start") flashEdge(`registry-${ev.agent_id}`, EDGE_ACTIVE);

      if (ev.type === "agent_call_done") {
        if (ev.metrics) { metricsRef.current[ev.agent_id] = ev.metrics; rebuildNodes(); }
        const parts = Object.entries(ev.result).filter(([k]) => k !== "market")
          .map(([k, v]) => `${k}: ${v}`).join("  ·  ");
        showToast(`${ev.agent_name}  →  ${parts}`);
      }

      if (ev.type === "pipeline_start")    showToast(`▶ Pipeline "${ev.pipeline_name}" starting…`);

      if (ev.type === "pipeline_step_start") {
        activeRef.current.add(ev.agent_id);
        flashEdge(`registry-${ev.agent_id}`, EDGE_PIPELINE, 3000);
        rebuildNodes();
      }

      if (ev.type === "pipeline_step_done") {
        activeRef.current.delete(ev.agent_id);
        if (ev.metrics) metricsRef.current[ev.agent_id] = ev.metrics;
        rebuildNodes();
        const parts = Object.entries(ev.output).filter(([k]) => k !== "market")
          .map(([k, v]) => `${k}: ${v}`).join("  ·  ");
        showToast(`${ev.agent_name}  →  ${parts}`);
      }

      if (ev.type === "pipeline_done") {
        activeRef.current.clear(); rebuildNodes();
        showToast(`✓ Pipeline "${ev.pipeline_name}" complete`);
      }

      if (ev.type === "challenge_entry") {
        showToast(`🏆 ${ev.pipeline_name}  score: ${ev.score}`);
        // Refresh leaderboard if it's open
        if (openChallenge) loadLeaderboard(openChallenge);
      }
    };
    ws.onerror = () => console.warn("WebSocket unavailable");
    return () => ws.close();
  }, [flashEdge, showToast, rebuildNodes, openChallenge, loadLeaderboard]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const onNodeDoubleClick = useCallback(async (_, node) => {
    if (node.id === "registry") return;
    await fetch(`${REGISTRY_URL}/call-agent/${node.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ market: "BTC" }),
    });
  }, []);

  const toggleAgentInPipeline = (id) => {
    setNewPipeline((p) => ({
      ...p,
      agent_ids: p.agent_ids.includes(id)
        ? p.agent_ids.filter((x) => x !== id)
        : [...p.agent_ids, id],
    }));
  };

  const savePipeline = async () => {
    if (!newPipeline.name || newPipeline.agent_ids.length < 2) return;
    const res = await fetch(`${REGISTRY_URL}/pipelines`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPipeline),
    });
    const saved = await res.json();
    setPipelines((p) => [...p, saved]);
    setNewPipeline({ name: "", agent_ids: [] });
    setShowBuilder(false);
    loadAll();
  };

  const runPipeline = async (id) => {
    await fetch(`${REGISTRY_URL}/run-pipeline/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ market: "BTC" }),
    });
  };

  const saveChallenge = async () => {
    if (!newChallenge.title) return;
    const res = await fetch(`${REGISTRY_URL}/challenges`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newChallenge),
    });
    const saved = await res.json();
    setChallenges((c) => [...c, saved]);
    setNewChallenge({ title: "", description: "", reward: 50, scoring_field: "confidence" });
    setShowChallengeForm(false);
  };

  const submitToChallengeWith = async (challengeId, pipelineId) => {
    setSubmitting(null);
    await fetch(`${REGISTRY_URL}/challenges/${challengeId}/submit/${pipelineId}`, {
      method: "POST",
    });
    loadLeaderboard(challengeId);
    setOpenChallenge(challengeId);
  };

  const agentName = (id) => agentsRef.current.find((a) => a.id === id)?.name ?? id.slice(0, 8);

  // ── Input style helper ───────────────────────────────────────────────────────

  const inputStyle = {
    width: "100%", background: "#0f172a", border: "1px solid #334155",
    borderRadius: 6, color: "#f1f5f9", padding: "6px 8px",
    fontSize: 12, marginBottom: 8, boxSizing: "border-box",
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0f172a", display: "flex" }}>

      {/* Sidebar */}
      <div style={{
        width: 264, flexShrink: 0, background: "#0a111e",
        borderRight: "1px solid #1e293b", padding: "16px 12px",
        overflowY: "auto", zIndex: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ color: "#e2e8f0", fontWeight: "bold", fontSize: 15 }}>AgentVerse</div>
          <a href="/build" style={{
            background: "#1e293b", color: "#7c3aed", border: "1px solid #4c1d95",
            borderRadius: 6, padding: "3px 9px", fontSize: 11, textDecoration: "none", fontWeight: 600,
          }}>+ Build</a>
        </div>

        <TabBar tab={tab} setTab={setTab} />

        {/* ── Pipelines tab ── */}
        {tab === "pipelines" && (
          <>
            <SectionLabel>Pipelines</SectionLabel>
            {pipelines.map((p) => (
              <div key={p.id} style={{ background: "#1e293b", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 12 }}>
                <div style={{ color: "#f1f5f9", fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                <div style={{ color: "#64748b", marginBottom: 6 }}>{p.agent_ids.map(agentName).join(" → ")}</div>
                <button onClick={() => runPipeline(p.id)} style={{
                  background: "#7c3aed", color: "#fff", border: "none",
                  borderRadius: 6, padding: "4px 0", fontSize: 11,
                  cursor: "pointer", width: "100%",
                }}>▶ Run</button>
              </div>
            ))}

            {showBuilder ? (
              <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px" }}>
                <input placeholder="Pipeline name" value={newPipeline.name}
                  onChange={(e) => setNewPipeline((p) => ({ ...p, name: e.target.value }))}
                  style={inputStyle} />
                <div style={{ color: "#64748b", fontSize: 11, marginBottom: 6 }}>Click agents in order:</div>
                {agentsRef.current.map((a) => (
                  <div key={a.id} onClick={() => toggleAgentInPipeline(a.id)} style={{
                    padding: "5px 8px", borderRadius: 6, marginBottom: 4, cursor: "pointer", fontSize: 12,
                    background: newPipeline.agent_ids.includes(a.id) ? "#1d4ed8" : "#0f172a",
                    color: newPipeline.agent_ids.includes(a.id) ? "#bfdbfe" : "#94a3b8",
                  }}>
                    {newPipeline.agent_ids.includes(a.id)
                      ? `${newPipeline.agent_ids.indexOf(a.id) + 1}. ${a.name}`
                      : a.name}
                  </div>
                ))}
                {newPipeline.agent_ids.length >= 2 && (
                  <div style={{ color: "#94a3b8", fontSize: 11, margin: "6px 0" }}>
                    {newPipeline.agent_ids.map(agentName).join(" → ")}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={savePipeline} style={{ flex: 1, background: "#059669", color: "#fff", border: "none", borderRadius: 6, padding: "6px", fontSize: 12, cursor: "pointer" }}>Save</button>
                  <button onClick={() => { setShowBuilder(false); setNewPipeline({ name: "", agent_ids: [] }); }}
                    style={{ flex: 1, background: "#374151", color: "#9ca3af", border: "none", borderRadius: 6, padding: "6px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowBuilder(true)} style={{
                width: "100%", background: "#1e293b", color: "#94a3b8",
                border: "1px dashed #334155", borderRadius: 8, padding: "8px",
                fontSize: 12, cursor: "pointer", marginTop: 4,
              }}>+ New Pipeline</button>
            )}
          </>
        )}

        {/* ── Challenges tab ── */}
        {tab === "challenges" && (
          <>
            <SectionLabel>Challenges</SectionLabel>

            {challenges.map((c) => (
              <div key={c.id} style={{ background: "#1e293b", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <div style={{ color: "#f1f5f9", fontWeight: 600 }}>{c.title}</div>
                  <div style={{ color: "#fbbf24", fontSize: 11, fontWeight: 600 }}>${c.reward}</div>
                </div>
                <div style={{ color: "#64748b", marginBottom: 6, fontSize: 11 }}>
                  score by: <span style={{ color: "#94a3b8" }}>{c.scoring_field}</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { setSubmitting(c.id); }} style={{
                    flex: 1, background: "#7c3aed", color: "#fff", border: "none",
                    borderRadius: 6, padding: "4px 0", fontSize: 11, cursor: "pointer",
                  }}>Submit Pipeline</button>
                  <button onClick={() => {
                    if (openChallenge === c.id) { setOpenChallenge(null); }
                    else { setOpenChallenge(c.id); loadLeaderboard(c.id); }
                  }} style={{
                    flex: 1, background: "#0f172a", color: "#94a3b8", border: "1px solid #334155",
                    borderRadius: 6, padding: "4px 0", fontSize: 11, cursor: "pointer",
                  }}>
                    {openChallenge === c.id ? "Hide" : "Leaderboard"}
                  </button>
                </div>

                {/* Submit picker */}
                {submitting === c.id && (
                  <div style={{ marginTop: 8, borderTop: "1px solid #334155", paddingTop: 8 }}>
                    <div style={{ color: "#64748b", fontSize: 11, marginBottom: 6 }}>Pick a pipeline:</div>
                    {pipelines.map((p) => (
                      <div key={p.id} onClick={() => submitToChallengeWith(c.id, p.id)} style={{
                        padding: "5px 8px", borderRadius: 6, marginBottom: 4,
                        background: "#0f172a", color: "#94a3b8", cursor: "pointer", fontSize: 11,
                      }}>
                        {p.name}  <span style={{ color: "#475569" }}>({p.agent_ids.map(agentName).join(" → ")})</span>
                      </div>
                    ))}
                    <button onClick={() => setSubmitting(null)} style={{
                      width: "100%", background: "#374151", color: "#9ca3af",
                      border: "none", borderRadius: 6, padding: "4px", fontSize: 11,
                      cursor: "pointer", marginTop: 4,
                    }}>Cancel</button>
                  </div>
                )}

                {/* Leaderboard */}
                {openChallenge === c.id && leaderboards[c.id] && (
                  <div style={{ marginTop: 8, borderTop: "1px solid #334155", paddingTop: 8 }}>
                    {leaderboards[c.id].length === 0
                      ? <div style={{ color: "#475569", fontSize: 11 }}>No entries yet</div>
                      : leaderboards[c.id].map((entry, rank) => (
                          <div key={entry.id} style={{
                            display: "flex", justifyContent: "space-between",
                            padding: "3px 0", fontSize: 11,
                            color: rank === 0 ? "#fbbf24" : "#94a3b8",
                          }}>
                            <span>{rank + 1}. {entry.pipeline_name}</span>
                            <span>{entry.score}</span>
                          </div>
                        ))
                    }
                  </div>
                )}
              </div>
            ))}

            {showChallengeForm ? (
              <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px" }}>
                <input placeholder="Title" value={newChallenge.title}
                  onChange={(e) => setNewChallenge((c) => ({ ...c, title: e.target.value }))}
                  style={inputStyle} />
                <input placeholder="Description" value={newChallenge.description}
                  onChange={(e) => setNewChallenge((c) => ({ ...c, description: e.target.value }))}
                  style={inputStyle} />
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input type="number" placeholder="Reward $" value={newChallenge.reward}
                    onChange={(e) => setNewChallenge((c) => ({ ...c, reward: parseFloat(e.target.value) }))}
                    style={{ ...inputStyle, marginBottom: 0, width: "50%" }} />
                  <select value={newChallenge.scoring_field}
                    onChange={(e) => setNewChallenge((c) => ({ ...c, scoring_field: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: 0, width: "50%" }}>
                    <option value="confidence">confidence</option>
                    <option value="volatility">volatility</option>
                    <option value="bullish_score">bullish_score</option>
                    <option value="change_24h_pct">change_24h_pct</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={saveChallenge} style={{ flex: 1, background: "#b45309", color: "#fff", border: "none", borderRadius: 6, padding: "6px", fontSize: 12, cursor: "pointer" }}>Post</button>
                  <button onClick={() => setShowChallengeForm(false)} style={{ flex: 1, background: "#374151", color: "#9ca3af", border: "none", borderRadius: 6, padding: "6px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowChallengeForm(true)} style={{
                width: "100%", background: "#1e293b", color: "#94a3b8",
                border: "1px dashed #334155", borderRadius: 8, padding: "8px",
                fontSize: 12, cursor: "pointer", marginTop: 4,
              }}>+ Post Challenge</button>
            )}
          </>
        )}

        <div style={{ marginTop: 20, color: "#334155", fontSize: 11, lineHeight: 1.6 }}>
          Double-click a node to call it
          <br />Purple dashed = pipeline links
          <br />Nodes grow with usage
        </div>
      </div>

      {/* Graph */}
      <div style={{ flex: 1, position: "relative" }}>
        {toast && (
          <div style={{
            position: "absolute", bottom: 28, left: "50%",
            transform: "translateX(-50%)", zIndex: 20,
            background: "#065f46", color: "#d1fae5",
            border: "1px solid #10b981", borderRadius: 10,
            padding: "10px 28px", fontSize: 13, fontWeight: 500,
            boxShadow: "0 4px 24px rgba(0,0,0,0.6)", whiteSpace: "nowrap",
          }}>
            {toast}
          </div>
        )}
        <ReactFlow nodes={nodes} edges={edges} onNodeDoubleClick={onNodeDoubleClick} fitView>
          <Background color="#1e293b" gap={24} />
          <Controls />
          <MiniMap nodeColor={(n) => n.id === "registry" ? "#3b82f6" : "#10b981"}
                   style={{ background: "#1e293b" }} />
        </ReactFlow>
      </div>
    </div>
  );
}
