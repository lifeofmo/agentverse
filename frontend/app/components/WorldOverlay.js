"use client";
import { useEffect, useState, useRef } from "react";
import { API } from "@/app/lib/config";

// ── World switcher config ──────────────────────────────────────────────────────

const WORLD_BUTTONS = [
  { id: "defi",         label: "⚡ Live",   color: "#c084fc" },
  { id: "trading",      label: "◈ Earn",   color: "#ff2d78" },
  { id: "experimental", label: "◬ Lab",    color: "#FF6B35" },
  { id: "data",         label: "≋ System", color: "#00FF41" },
  { id: "analysis",     label: "◎ Mine",   color: "#7ec87e" },
  { id: "all",          label: "✦ Learn",  color: "#d4a820" },
];

// ── Shared style helpers ───────────────────────────────────────────────────────

const sectionHeader = {
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  color: "rgba(255,255,255,0.3)",
  marginBottom: 8,
  fontFamily: "system-ui, sans-serif",
};

const dataValue = {
  fontSize: 13,
  color: "#f9fafb",
  fontWeight: 700,
  fontFamily: "monospace",
};

const mutedLabel = {
  color: "rgba(255,255,255,0.4)",
  fontSize: 11,
  fontFamily: "system-ui, sans-serif",
};

const divider = {
  borderTop: "1px solid rgba(255,255,255,0.06)",
  margin: "14px 0",
};

// ── WorldSwitcher ──────────────────────────────────────────────────────────────

function WorldSwitcher({ currentWorldId, onWorldSwitch }) {
  return (
    <div style={{
      borderTop: "1px solid rgba(255,255,255,0.07)",
      paddingTop: 14,
      marginTop: "auto",
      flexShrink: 0,
    }}>
      <div style={{ ...sectionHeader, marginBottom: 10 }}>View in</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {WORLD_BUTTONS.map(w => {
          const active = w.id === currentWorldId;
          return (
            <button
              key={w.id}
              onClick={() => onWorldSwitch(w.id)}
              style={{
                background: active ? `${w.color}22` : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? w.color + "60" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 7,
                color: active ? w.color : "rgba(255,255,255,0.45)",
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                padding: "5px 9px",
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
                transition: "all 0.15s",
                flex: "0 0 auto",
              }}
            >
              {w.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Tomorrowland panel (defi) ─────────────────────────────────────────────────

function TomorrowlandPanel() {
  const [pipelines,  setPipelines]  = useState([]);
  const [running,    setRunning]    = useState({});
  const [results,    setResults]    = useState({});
  const [recent,     setRecent]     = useState([]);
  const [flash,      setFlash]      = useState(null);
  const timerRef = useRef(null);

  const loadPipelines = () =>
    fetch(`${API}/pipelines`).then(r => r.json()).then(setPipelines).catch(() => {});

  const pollJobs = () =>
    fetch(`${API}/jobs/recent?limit=10`).then(r => r.json()).then(jobs => {
      const entries = jobs
        .filter(j => j.status === "completed")
        .map(j => ({
          id:     j.pipeline_id,
          name:   j.pipeline_name || j.pipeline_id,
          signal: j.signal || j.result?.signal || j.result?.recommendation || j.result?.action || null,
          ts:     new Date(j.completed_at || j.created_at).getTime(),
          data:   j.result || {},
        }));
      if (entries.length > 0)
        setRecent(prev => {
          const merged = [...entries, ...prev];
          const seen = new Set();
          return merged.filter(e => {
            const k = `${e.id}-${e.ts}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          }).slice(0, 5);
        });
    }).catch(() => {});

  useEffect(() => {
    loadPipelines();
    pollJobs();
    timerRef.current = setInterval(() => { loadPipelines(); pollJobs(); }, 15000);
    return () => clearInterval(timerRef.current);
  }, []);

  const runPipeline = async (pipeline) => {
    setRunning(r => ({ ...r, [pipeline.id]: true }));
    try {
      const res = await fetch(`${API}/run-pipeline/${pipeline.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market: "BTC" }),
      });
      const data = await res.json();
      setResults(r => ({ ...r, [pipeline.id]: data }));
      const sig = data.signal || data.recommendation || data.action || null;
      const entry = { id: pipeline.id, name: pipeline.name, signal: sig, ts: Date.now(), data };
      setRecent(prev => [entry, ...prev].slice(0, 3));
      setFlash(pipeline.id);
      setTimeout(() => setFlash(null), 1200);
    } catch {
      setResults(r => ({ ...r, [pipeline.id]: { error: "Failed" } }));
    }
    setRunning(r => ({ ...r, [pipeline.id]: false }));
  };

  const signalColor = (sig) => {
    if (!sig) return "#6b7280";
    const s = sig.toString().toUpperCase();
    if (s.includes("BUY"))  return "#10b981";
    if (s.includes("SELL")) return "#ef4444";
    if (s.includes("HOLD")) return "#f59e0b";
    return "#818cf8";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>
      <style>{`
        @keyframes flashPulse { 0% { opacity:1; } 50% { opacity:0.3; } 100% { opacity:1; } }
        @keyframes dotPulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>

      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexShrink: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: "#10b981",
          animation: "dotPulse 1.5s ease infinite",
          flexShrink: 0,
        }} />
        <span style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14, fontFamily: "system-ui, sans-serif", letterSpacing: "-0.2px" }}>
          LIVE SIGNALS
        </span>
      </div>

      {/* Pipeline list */}
      <div style={{ overflowY: "auto", flex: 1, marginBottom: 10 }}>
        {pipelines.length === 0 && (
          <div style={{ ...mutedLabel, padding: "12px 0" }}>No pipelines found.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pipelines.map(p => {
            const res = results[p.id];
            const sig = res?.signal || res?.recommendation || res?.action;
            const isFlashing = flash === p.id;
            return (
              <div key={p.id} style={{
                background: isFlashing ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${isFlashing ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 10,
                padding: "10px 12px",
                transition: "all 0.2s",
                animation: isFlashing ? "flashPulse 0.3s ease 4" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: res ? 8 : 0 }}>
                  <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600, fontFamily: "system-ui, sans-serif", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </div>
                  <button
                    onClick={() => runPipeline(p)}
                    disabled={running[p.id]}
                    style={{
                      background: running[p.id] ? "#1f2937" : "rgba(16,185,129,0.15)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      borderRadius: 6,
                      color: running[p.id] ? "#6b7280" : "#10b981",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "4px 10px",
                      cursor: running[p.id] ? "not-allowed" : "pointer",
                      fontFamily: "system-ui, sans-serif",
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {running[p.id] ? "..." : "▶ Run"}
                  </button>
                </div>

                {res && !res.error && sig && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      background: `${signalColor(sig)}18`,
                      border: `1px solid ${signalColor(sig)}40`,
                      borderRadius: 5,
                      padding: "3px 9px",
                      color: signalColor(sig),
                      fontSize: 11,
                      fontWeight: 800,
                      fontFamily: "monospace",
                    }}>
                      {sig}
                    </div>
                    {res.price && (
                      <span style={{ ...mutedLabel, fontSize: 10, fontFamily: "monospace" }}>${res.price}</span>
                    )}
                  </div>
                )}
                {res?.error && (
                  <div style={{ color: "#ef4444", fontSize: 10, fontFamily: "monospace" }}>Error</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Recent signals */}
        {recent.length > 0 && (
          <>
            <div style={divider} />
            <div style={sectionHeader}>Recent</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recent.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    background: `${signalColor(r.signal)}18`,
                    border: `1px solid ${signalColor(r.signal)}35`,
                    borderRadius: 4,
                    color: signalColor(r.signal),
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "2px 6px",
                    fontFamily: "monospace",
                    flexShrink: 0,
                  }}>
                    {r.signal || "—"}
                  </div>
                  <span style={{ ...mutedLabel, fontSize: 10, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, fontFamily: "monospace", flexShrink: 0 }}>
                    {new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Vegas panel (trading) ─────────────────────────────────────────────────────

function VegasPanel() {
  const [agents,   setAgents]   = useState([]);
  const [stats,    setStats]    = useState(null);
  const [earnings, setEarnings] = useState([]);
  const tickRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/agents`).then(r => r.json()).then(d => {
      const sorted = [...d].sort((a, b) =>
        (b.metrics_summary?.total_calls || 0) - (a.metrics_summary?.total_calls || 0)
      );
      setAgents(sorted.slice(0, 8));
    }).catch(() => {});

    fetch(`${API}/platform/stats`).then(r => r.json()).then(setStats).catch(() => {});

    // Simulate revenue flow ticks
    const tick = () => {
      const amount = (Math.random() * 0.05 + 0.001).toFixed(4);
      const names = ["PriceFeedAgent", "MomentumAgent", "RiskEngine", "SentimentBot", "TrendScanner"];
      const name = names[Math.floor(Math.random() * names.length)];
      setEarnings(prev => [{ id: Date.now(), label: `+$${amount}`, name }, ...prev].slice(0, 5));
    };
    tick();
    tickRef.current = setInterval(tick, 4000);
    return () => clearInterval(tickRef.current);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14, fontFamily: "system-ui, sans-serif", letterSpacing: "-0.2px", marginBottom: 16, flexShrink: 0 }}>
        AGENT ECONOMY
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {/* Platform stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
          {[
            { label: "Total Calls", value: stats?.total_requests ? stats.total_requests.toLocaleString() : "—" },
            { label: "Revenue",     value: stats?.total_revenue  ? `$${Number(stats.total_revenue).toFixed(2)}` : "—" },
            { label: "Agents",      value: stats?.agent_count ?? (agents.length || "—") },
          ].map(s => (
            <div key={s.label} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: "8px 10px",
              textAlign: "center",
            }}>
              <div style={{ ...dataValue, fontSize: 12 }}>{s.value}</div>
              <div style={{ ...mutedLabel, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div style={sectionHeader}>Leaderboard</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
          {agents.length === 0 && (
            <div style={mutedLabel}>Loading agents...</div>
          )}
          {agents.map((a, i) => (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8,
              padding: "7px 10px",
            }}>
              <span style={{
                color: i < 3 ? "#f59e0b" : "rgba(255,255,255,0.25)",
                fontWeight: 700, fontSize: 10,
                fontFamily: "monospace",
                width: 16, textAlign: "center", flexShrink: 0,
              }}>#{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#e5e7eb", fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "system-ui, sans-serif" }}>
                  {a.name}
                </div>
                <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontFamily: "monospace" }}>
                  {a.metrics_summary?.total_calls ?? 0} calls
                </div>
              </div>
              <div style={{ ...dataValue, fontSize: 11, color: "#34d399", flexShrink: 0 }}>
                ${a.price_per_request?.toFixed(3) ?? "0.001"}
              </div>
            </div>
          ))}
        </div>

        {/* Revenue flow */}
        <div style={sectionHeader}>Revenue Flow</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <style>{`
            @keyframes slideIn { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
          `}</style>
          {earnings.map((e, i) => (
            <div key={e.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              animation: i === 0 ? "slideIn 0.35s ease" : "none",
              opacity: 1 - i * 0.18,
            }}>
              <span style={{ color: "#10b981", fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{e.label}</span>
              <span style={{ ...mutedLabel, fontSize: 10 }}>{e.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Burning Man panel (experimental) ─────────────────────────────────────────

function BurningManPanel() {
  const [agents,   setAgents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState({ name: "", endpoint: "", price: "0.001" });
  const [deploying, setDeploying] = useState(false);
  const [deployed,  setDeployed]  = useState(null);
  const [err,       setErr]       = useState("");
  const [showForm,  setShowForm]  = useState(false);

  const load = () => {
    fetch(`${API}/agents`).then(r => r.json()).then(all => {
      setAgents(all.filter(a => a.category === "experimental"));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const deploy = async () => {
    if (!form.name.trim() || !form.endpoint.trim()) {
      setErr("Name and endpoint required.");
      return;
    }
    setDeploying(true);
    setErr("");
    try {
      const res = await fetch(`${API}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          endpoint: form.endpoint,
          price_per_request: parseFloat(form.price) || 0.001,
          category: "experimental",
          description: "Deployed from The Lab",
        }),
      });
      if (!res.ok) throw new Error("Deploy failed");
      const agent = await res.json();
      setDeployed(agent);
      setShowForm(false);
      load();
    } catch (e) {
      setErr(e.message);
    }
    setDeploying(false);
  };

  const inputStyle = {
    width: "100%",
    background: "#1a1a24",
    border: "1px solid rgba(255,107,53,0.25)",
    borderRadius: 7,
    color: "#f3f4f6",
    padding: "7px 10px",
    fontSize: 11,
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "system-ui, sans-serif",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14, fontFamily: "system-ui, sans-serif", letterSpacing: "-0.2px", marginBottom: 16, flexShrink: 0 }}>
        THE LAB
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {/* Experimental agents list */}
        <div style={sectionHeader}>Experimental Agents</div>
        {loading && <div style={mutedLabel}>Loading...</div>}
        {!loading && agents.length === 0 && (
          <div style={{ ...mutedLabel, marginBottom: 12 }}>No experimental agents yet.</div>
        )}
        {!loading && agents.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {agents.map(a => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,107,53,0.04)",
                border: "1px solid rgba(255,107,53,0.15)",
                borderRadius: 8,
                padding: "8px 10px",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: a.status === "active" ? "#10b981" : "#6b7280",
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#e5e7eb", fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "system-ui, sans-serif" }}>
                    {a.name}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.endpoint}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {deployed && (
          <div style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 12,
          }}>
            <div style={{ color: "#10b981", fontSize: 11, fontWeight: 700, fontFamily: "system-ui, sans-serif" }}>
              ✓ Deployed: {deployed.name}
            </div>
          </div>
        )}

        {/* Deploy new agent */}
        <div style={divider} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={sectionHeader}>Deploy New Agent</div>
          <button
            onClick={() => setShowForm(f => !f)}
            style={{
              background: "rgba(255,107,53,0.12)",
              border: "1px solid rgba(255,107,53,0.3)",
              borderRadius: 6,
              color: "#FF6B35",
              fontSize: 14,
              fontWeight: 700,
              width: 24, height: 24,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0,
            }}
          >
            {showForm ? "−" : "+"}
          </button>
        </div>

        {showForm && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Agent name"
              style={inputStyle}
            />
            <input
              value={form.endpoint}
              onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))}
              placeholder="https://your-agent.app/run"
              style={inputStyle}
            />
            <input
              type="number"
              step="0.001"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="Price per call ($)"
              style={inputStyle}
            />
            {err && (
              <div style={{ color: "#ef4444", fontSize: 10, fontFamily: "system-ui, sans-serif" }}>{err}</div>
            )}
            <button
              onClick={deploy}
              disabled={deploying}
              style={{
                background: deploying ? "#1f2937" : "rgba(255,107,53,0.18)",
                border: "1px solid rgba(255,107,53,0.4)",
                borderRadius: 8,
                color: deploying ? "#6b7280" : "#FF6B35",
                fontSize: 11,
                fontWeight: 700,
                padding: "8px",
                cursor: deploying ? "not-allowed" : "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {deploying ? "Deploying..." : "Deploy to The Lab"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Matrix panel (data) ───────────────────────────────────────────────────────

function MatrixPanel() {
  const [pipelines, setPipelines] = useState([]);
  const [agents,    setAgents]    = useState([]);
  const [tick,      setTick]      = useState(0);

  useEffect(() => {
    fetch(`${API}/pipelines`).then(r => r.json()).then(setPipelines).catch(() => {});
    fetch(`${API}/agents`).then(r => r.json()).then(setAgents).catch(() => {});
    const iv = setInterval(() => setTick(t => t + 1), 1800);
    return () => clearInterval(iv);
  }, []);

  const agentNameById = (id) => {
    const a = agents.find(a => a.id === id);
    return a?.name ?? id?.slice(0, 8) ?? "?";
  };

  const totalSteps = pipelines.reduce((sum, p) => sum + (p.steps?.length || 0), 0);

  const randomDataBit = () => Math.random() > 0.5
    ? (Math.random() * 9999).toFixed(0).padStart(4, "0")
    : ["0xFF", "0x1A", "ACK", "SYN", "PKT"][Math.floor(Math.random() * 5)];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`
        @keyframes matrixFade { 0% { opacity:0.8; } 50% { opacity:0.3; } 100% { opacity:0.8; } }
      `}</style>
      <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14, fontFamily: "system-ui, sans-serif", letterSpacing: "-0.2px", marginBottom: 16, flexShrink: 0 }}>
        SYSTEM LAYER
      </div>

      {/* Active connections badge */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(0,255,65,0.05)",
        border: "1px solid rgba(0,255,65,0.15)",
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 14,
        flexShrink: 0,
      }}>
        <div style={{
          color: "#00FF41",
          fontFamily: "monospace",
          fontSize: 20,
          fontWeight: 700,
        }}>{totalSteps}</div>
        <div>
          <div style={{ color: "#e5e7eb", fontSize: 11, fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>
            Active Connections
          </div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "monospace" }}>
            {pipelines.length} pipeline{pipelines.length !== 1 ? "s" : ""} · {agents.length} agents
          </div>
        </div>
        {/* Pulsing data bits */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              color: "#00FF41",
              fontSize: 8,
              fontFamily: "monospace",
              opacity: 0.5,
              animation: `matrixFade ${1 + i * 0.4}s ease infinite`,
              animationDelay: `${i * 0.2}s`,
            }}>
              {randomDataBit()}
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline chains */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        <div style={sectionHeader}>Pipeline Graph</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pipelines.length === 0 && (
            <div style={mutedLabel}>No pipelines found.</div>
          )}
          {pipelines.map(p => {
            const steps = p.steps || [];
            return (
              <div key={p.id} style={{
                background: "rgba(0,255,65,0.025)",
                border: "1px solid rgba(0,255,65,0.1)",
                borderRadius: 9,
                padding: "9px 11px",
              }}>
                <div style={{ color: "#e5e7eb", fontSize: 11, fontWeight: 600, marginBottom: 5, fontFamily: "system-ui, sans-serif" }}>
                  {p.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 3 }}>
                  {steps.map((step, i) => {
                    const name = agentNameById(step.agent_id);
                    return (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{
                          background: "rgba(0,255,65,0.08)",
                          border: "1px solid rgba(0,255,65,0.2)",
                          borderRadius: 4,
                          color: "#00FF41",
                          fontSize: 9,
                          fontFamily: "monospace",
                          padding: "2px 6px",
                        }}>
                          {name}
                        </span>
                        {i < steps.length - 1 && (
                          <span style={{ color: "rgba(0,255,65,0.3)", fontSize: 9, fontFamily: "monospace" }}>→</span>
                        )}
                      </span>
                    );
                  })}
                  {steps.length === 0 && (
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, fontFamily: "monospace" }}>empty</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Data flow animation */}
        {tick > 0 && (
          <>
            <div style={divider} />
            <div style={sectionHeader}>Data Flow</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={`${tick}-${i}`} style={{
                  color: "rgba(0,255,65,0.5)",
                  fontSize: 9,
                  fontFamily: "monospace",
                  animation: `matrixFade ${0.8 + i * 0.15}s ease infinite`,
                  animationDelay: `${i * 0.1}s`,
                }}>
                  {randomDataBit()}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sims panel (analysis) ─────────────────────────────────────────────────────

function SimsPanel() {
  const [user,      setUser]      = useState(null);
  const [agents,    setAgents]    = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    try {
      const u = localStorage.getItem("av_user");
      const t = localStorage.getItem("av_token");
      if (u && t) setUser(JSON.parse(u));
    } catch {}

    fetch(`${API}/agents`).then(r => r.json()).then(setAgents).catch(() => {});
    fetch(`${API}/pipelines`).then(r => r.json()).then(d => {
      setPipelines(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const myAgents = user
    ? agents.filter(a =>
        a.owner_wallet?.toLowerCase() === user.wallet?.toLowerCase() ||
        a.owner_id === user.id
      )
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14, fontFamily: "system-ui, sans-serif", letterSpacing: "-0.2px", marginBottom: 16, flexShrink: 0 }}>
        MY AGENTS
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {!user ? (
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "16px 14px",
            marginBottom: 14,
            textAlign: "center",
          }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 10, fontFamily: "system-ui, sans-serif" }}>
              Sign in to see your agents
            </div>
            <a href="/?tab=developer" style={{
              color: "#7ec87e",
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
              fontFamily: "system-ui, sans-serif",
            }}>
              Go to Developer Hub →
            </a>
          </div>
        ) : (
          <>
            {/* User info */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(126,200,126,0.06)",
              border: "1px solid rgba(126,200,126,0.15)",
              borderRadius: 8,
              padding: "8px 10px",
              marginBottom: 12,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "rgba(126,200,126,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#7ec87e", fontSize: 13,
              }}>◎</div>
              <div>
                <div style={{ color: "#e5e7eb", fontSize: 11, fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>
                  {user.name || user.email || "You"}
                </div>
                <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontFamily: "monospace" }}>
                  {myAgents.length} agent{myAgents.length !== 1 ? "s" : ""} deployed
                </div>
              </div>
            </div>
          </>
        )}

        {/* My agents */}
        <div style={sectionHeader}>My Agents</div>
        {loading ? (
          <div style={mutedLabel}>Loading...</div>
        ) : myAgents.length === 0 ? (
          <div style={{ ...mutedLabel, marginBottom: 12, fontSize: 11 }}>
            {user ? "No agents deployed yet." : "Sign in to see your agents."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {myAgents.map(a => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 8,
                padding: "8px 10px",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: a.status === "active" ? "#10b981" : "#6b7280",
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#e5e7eb", fontSize: 11, fontWeight: 600, fontFamily: "system-ui, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.name}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontFamily: "monospace" }}>
                    {a.category}
                  </div>
                </div>
                <div style={{ color: "#34d399", fontSize: 10, fontFamily: "monospace", fontWeight: 700, flexShrink: 0 }}>
                  ${a.price_per_request?.toFixed(3)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={divider} />

        {/* My pipelines */}
        <div style={sectionHeader}>My Pipelines</div>
        {pipelines.length === 0 ? (
          <div style={{ ...mutedLabel, marginBottom: 12 }}>No pipelines yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
            {pipelines.slice(0, 5).map(p => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 7,
                padding: "7px 10px",
              }}>
                <span style={{ color: "#7ec87e", fontSize: 10, fontFamily: "monospace" }}>⊕</span>
                <span style={{ color: "#d1d5db", fontSize: 11, fontFamily: "system-ui, sans-serif", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </span>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, fontFamily: "monospace", flexShrink: 0 }}>
                  {p.steps?.length ?? 0} steps
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <a href="/build" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(126,200,126,0.07)",
            border: "1px solid rgba(126,200,126,0.2)",
            borderRadius: 8,
            padding: "9px 12px",
            textDecoration: "none",
          }}>
            <span style={{ color: "#7ec87e", fontSize: 11, fontWeight: 700, fontFamily: "system-ui, sans-serif" }}>
              Go to Pipeline Builder
            </span>
            <span style={{ color: "#7ec87e", fontSize: 12 }}>→</span>
          </a>
          <a href="/?tab=developer" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(129,140,248,0.06)",
            border: "1px solid rgba(129,140,248,0.15)",
            borderRadius: 8,
            padding: "9px 12px",
            textDecoration: "none",
          }}>
            <span style={{ color: "#818cf8", fontSize: 11, fontWeight: 700, fontFamily: "system-ui, sans-serif" }}>
              Go to Developer Hub
            </span>
            <span style={{ color: "#818cf8", fontSize: 12 }}>→</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Hogwarts panel (all) ──────────────────────────────────────────────────────

const SPELLS = [
  {
    name: "Market Pulse",
    desc: "Predict market direction",
    agents: ["PriceFeedAgent", "SentimentAgent", "MomentumAgent"],
    color: "#10b981",
    keywords: ["pulse", "market"],
  },
  {
    name: "Risk Check",
    desc: "Measure downside risk",
    agents: ["PriceFeedAgent", "VolatilityScanner", "RiskAgent"],
    color: "#c084fc",
    keywords: ["risk", "volatility"],
  },
  {
    name: "Trend Analysis",
    desc: "Find and follow the trend",
    agents: ["PriceFeedAgent", "TrendAnalyzer", "PatternDetector", "MomentumAgent"],
    color: "#818cf8",
    keywords: ["trend", "pattern"],
  },
];

function HogwartsPanel({ onWorldSwitch }) {
  const [castingSpell, setCastingSpell] = useState(null);
  const [spellResult,  setSpellResult]  = useState(null);
  const [castError,    setCastError]    = useState(null);

  const castSpell = async (spell) => {
    setCastingSpell(spell.name);
    setSpellResult(null);
    setCastError(null);

    try {
      // Find matching pipeline
      const pipelinesRes = await fetch(`${API}/pipelines`);
      const pipelines = await pipelinesRes.json();

      const match = pipelines.find(p => {
        const n = p.name?.toLowerCase() || "";
        return spell.keywords.some(k => n.includes(k)) || n.includes(spell.name.toLowerCase());
      });

      if (match) {
        const runRes = await fetch(`${API}/run-pipeline/${match.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ market: "BTC" }),
        });
        const data = await runRes.json();
        setSpellResult({ spell, data, pipelineId: match.id, pipelineName: match.name });
      } else {
        // No matching pipeline found — simulate a result for demo
        setSpellResult({
          spell,
          data: {
            signal: "HOLD",
            momentum: 0.42,
            sentiment: 61,
            risk_score: 3.2,
          },
          pipelineId: null,
          pipelineName: null,
          simulated: true,
        });
      }
    } catch (e) {
      setCastError("Spell failed — check pipelines.");
    }

    setCastingSpell(null);
  };

  const sigColor = (sig) => {
    if (!sig) return "#6b7280";
    const s = sig.toString().toUpperCase();
    if (s.includes("BUY"))  return "#10b981";
    if (s.includes("SELL")) return "#ef4444";
    if (s.includes("HOLD")) return "#f59e0b";
    return "#818cf8";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`
        @keyframes sparkle { 0%,100% { opacity:0.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.1); } }
        @keyframes castGlow { 0% { box-shadow:none; } 50% { box-shadow: 0 0 20px rgba(212,168,32,0.4); } 100% { box-shadow:none; } }
      `}</style>

      <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14, fontFamily: "system-ui, sans-serif", letterSpacing: "-0.2px", marginBottom: 16, flexShrink: 0 }}>
        LEARN A SPELL ✦
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {/* Spell cards */}
        <div style={sectionHeader}>Spells</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {SPELLS.map(spell => {
            const isCasting = castingSpell === spell.name;
            return (
              <div key={spell.name} style={{
                background: `${spell.color}07`,
                border: `1px solid ${spell.color}25`,
                borderRadius: 10,
                padding: "11px 12px",
                animation: isCasting ? "castGlow 0.6s ease 3" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <div style={{ color: spell.color, fontWeight: 700, fontSize: 12, fontFamily: "system-ui, sans-serif" }}>
                      {spell.name}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "system-ui, sans-serif", marginTop: 2 }}>
                      {spell.desc}
                    </div>
                  </div>
                  <button
                    onClick={() => castSpell(spell)}
                    disabled={!!castingSpell}
                    style={{
                      background: isCasting ? "#1f2937" : `${spell.color}18`,
                      border: `1px solid ${spell.color}40`,
                      borderRadius: 7,
                      color: isCasting ? "#6b7280" : spell.color,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "5px 10px",
                      cursor: castingSpell ? "not-allowed" : "pointer",
                      fontFamily: "system-ui, sans-serif",
                      flexShrink: 0,
                      marginLeft: 8,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isCasting ? "Casting..." : "Cast Spell"}
                  </button>
                </div>

                {/* Agent chain */}
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 3 }}>
                  {spell.agents.map((a, i) => (
                    <span key={a} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{
                        background: `${spell.color}0e`,
                        border: `1px solid ${spell.color}20`,
                        borderRadius: 4,
                        color: `${spell.color}b0`,
                        fontSize: 8,
                        fontFamily: "monospace",
                        padding: "1px 5px",
                      }}>
                        {a}
                      </span>
                      {i < spell.agents.length - 1 && (
                        <span style={{ color: `${spell.color}40`, fontSize: 9, fontFamily: "monospace" }}>→</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Spell result */}
        {spellResult && (
          <>
            <div style={divider} />
            <div style={sectionHeader}>Spell Result — {spellResult.pipelineName || spellResult.spell.name}</div>

            {spellResult.simulated && (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, fontFamily: "system-ui, sans-serif", marginBottom: 8 }}>
                Demo result — build a matching pipeline to run live
              </div>
            )}

            {/* Primary signal */}
            {(spellResult.data.signal || spellResult.data.recommendation) && (
              <div style={{
                background: `${sigColor(spellResult.data.signal || spellResult.data.recommendation)}15`,
                border: `1px solid ${sigColor(spellResult.data.signal || spellResult.data.recommendation)}40`,
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 10,
                textAlign: "center",
              }}>
                <div style={{
                  color: sigColor(spellResult.data.signal || spellResult.data.recommendation),
                  fontWeight: 800,
                  fontSize: 18,
                  fontFamily: "monospace",
                  letterSpacing: 2,
                }}>
                  {spellResult.data.signal || spellResult.data.recommendation}
                </div>
              </div>
            )}

            {/* Why this works */}
            <div style={{ ...sectionHeader, marginBottom: 8 }}>Why This Works</div>
            <div style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 12,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {spellResult.data.momentum !== undefined && (
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
                    <span style={{ color: "#c084fc" }}>•</span>{" "}
                    Momentum signal: <span style={{ color: "#f9fafb", fontFamily: "monospace" }}>{spellResult.data.momentum}</span>
                  </div>
                )}
                {spellResult.data.sentiment !== undefined && (
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
                    <span style={{ color: "#10b981" }}>•</span>{" "}
                    Market sentiment: <span style={{ color: "#f9fafb", fontFamily: "monospace" }}>{spellResult.data.sentiment}/100</span>
                  </div>
                )}
                {spellResult.data.risk_score !== undefined && (
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
                    <span style={{ color: "#f59e0b" }}>•</span>{" "}
                    Risk level: <span style={{ color: "#f9fafb", fontFamily: "monospace" }}>{spellResult.data.risk_score}/10</span>
                  </div>
                )}
                {spellResult.data.trend !== undefined && (
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
                    <span style={{ color: "#818cf8" }}>•</span>{" "}
                    Trend: <span style={{ color: "#f9fafb", fontFamily: "monospace" }}>{spellResult.data.trend}</span>
                  </div>
                )}
                {spellResult.data.price !== undefined && (
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
                    <span style={{ color: "#34d399" }}>•</span>{" "}
                    BTC Price: <span style={{ color: "#f9fafb", fontFamily: "monospace" }}>${spellResult.data.price}</span>
                  </div>
                )}
                {/* Fallback explanation if no known fields */}
                {spellResult.data.momentum === undefined &&
                 spellResult.data.sentiment === undefined &&
                 spellResult.data.risk_score === undefined &&
                 spellResult.data.trend === undefined && (
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
                    Each agent in the chain processes the market data and passes its output to the next, producing a combined signal.
                  </div>
                )}
              </div>
            </div>

            {/* Take to world CTAs */}
            <div style={{ ...sectionHeader, marginBottom: 8 }}>Take this spell to</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { id: "defi",    label: "⚡ Tomorrowland", color: "#c084fc" },
                { id: "trading", label: "◈ Vegas",         color: "#ff2d78" },
              ].map(w => (
                <button
                  key={w.id}
                  onClick={() => onWorldSwitch(w.id)}
                  style={{
                    flex: 1,
                    background: `${w.color}10`,
                    border: `1px solid ${w.color}30`,
                    borderRadius: 8,
                    color: w.color,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "7px 8px",
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </>
        )}

        {castError && (
          <div style={{ color: "#ef4444", fontSize: 11, fontFamily: "system-ui, sans-serif", marginTop: 10 }}>
            {castError}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main WorldOverlay ─────────────────────────────────────────────────────────

export default function WorldOverlay({ worldId, onWorldSwitch }) {
  const [collapsed, setCollapsed] = useState(false);

  const PANEL_WIDTH = 340;
  const COLLAPSED_WIDTH = 36;

  const worldConfig = {
    defi:         { label: "LIVE SIGNALS", color: "#c084fc" },
    trading:      { label: "AGENT ECONOMY", color: "#ff2d78" },
    experimental: { label: "THE LAB", color: "#FF6B35" },
    data:         { label: "SYSTEM LAYER", color: "#00FF41" },
    analysis:     { label: "MY AGENTS", color: "#7ec87e" },
    all:          { label: "LEARN A SPELL", color: "#d4a820" },
  };

  const wc = worldConfig[worldId] ?? { label: worldId?.toUpperCase() ?? "WORLD", color: "#818cf8" };

  const renderPanel = () => {
    switch (worldId) {
      case "defi":         return <TomorrowlandPanel />;
      case "trading":      return <VegasPanel />;
      case "experimental": return <BurningManPanel />;
      case "data":         return <MatrixPanel />;
      case "analysis":     return <SimsPanel />;
      case "all":          return <HogwartsPanel onWorldSwitch={onWorldSwitch} />;
      default:             return <div style={mutedLabel}>No panel for this world.</div>;
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      right: 0,
      height: "100%",
      width: collapsed ? COLLAPSED_WIDTH : PANEL_WIDTH,
      zIndex: 50,
      background: "rgba(5,5,15,0.92)",
      backdropFilter: "blur(24px)",
      borderLeft: "1px solid rgba(255,255,255,0.06)",
      transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? "Expand panel" : "Collapse panel"}
        style={{
          position: "absolute",
          left: -14,
          top: "50%",
          transform: "translateY(-50%)",
          width: 26,
          height: 48,
          borderRadius: "8px 0 0 8px",
          background: "rgba(5,5,15,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRight: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 51,
          color: "rgba(255,255,255,0.45)",
          fontSize: 10,
          transition: "color 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
      >
        {collapsed ? "‹" : "›"}
      </button>

      {/* Collapsed state: vertical label */}
      {collapsed && (
        <div style={{
          width: COLLAPSED_WIDTH,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}>
          <div style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            transform: "rotate(180deg)",
            color: wc.color,
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "system-ui, sans-serif",
            textTransform: "uppercase",
            letterSpacing: 1.5,
            opacity: 0.7,
            userSelect: "none",
          }}>
            {wc.label}
          </div>
        </div>
      )}

      {/* Expanded state */}
      {!collapsed && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "16px 16px 16px 16px",
          overflow: "hidden",
        }}>
          {/* Panel content */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
            {renderPanel()}
          </div>

          {/* World switcher — always at bottom */}
          <WorldSwitcher currentWorldId={worldId} onWorldSwitch={onWorldSwitch} />
        </div>
      )}
    </div>
  );
}
