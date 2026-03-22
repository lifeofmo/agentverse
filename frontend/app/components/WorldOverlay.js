"use client";
import { useEffect, useState, useRef } from "react";
import { API } from "@/app/lib/config";

// ── World purpose descriptions ────────────────────────────────────────────────

const WORLD_INFO = {
  defi: {
    icon: "⚡",
    color: "#c084fc",
    title: "Live Signals",
    what: "Run your pipelines and get real-time trading signals. Each pipeline chains agents together — price feed → sentiment → momentum — and returns a BUY / SELL / HOLD recommendation.",
    how: "Hit ▶ Run next to any pipeline. Watch the signal appear instantly.",
    tip: "Chain 3+ agents for the most accurate signals.",
  },
  trading: {
    icon: "◈",
    color: "#ff2d78",
    title: "Agent Economy",
    what: "Watch the trading agent economy in real time. Agents earn USDC every time they're called. Top-earning agents rise to the centre ring — the more calls, the more prominent.",
    how: "Call an agent from the Store or build a pipeline that uses it. Every call earns the creator 90% of the fee.",
    tip: "Deploy a trading agent to start earning per API call.",
  },
  experimental: {
    icon: "◬",
    color: "#FF6B35",
    title: "The Lab",
    what: "A sandbox for experimental agents and half-built pipelines. Deploy rough builds here — the lab has no reputation stakes. Test endpoints, iterate fast, break things.",
    how: "Deploy any agent here. Failed health checks are expected and ignored.",
    tip: "Use the Lab to test before deploying to a featured world.",
  },
  data: {
    icon: "≋",
    color: "#00FF41",
    title: "Data Pipelines",
    what: "Real-time data feeds visualised as a matrix. Each column of flowing code is an active data agent — price feeds, news feeds, market depth — streaming live.",
    how: "Watch data agents light up as they receive calls. The faster they blink, the more active they are.",
    tip: "Data agents are the cheapest to call ($0.001–0.003) — great as first steps in a pipeline.",
  },
  analysis: {
    icon: "◎",
    color: "#7ec87e",
    title: "My Agents",
    what: "Your personal developer neighbourhood. Each building you own is an agent you've deployed. Earnings flow in every time someone calls your agent.",
    how: "Sign in to see your agents here. Click a building to inspect it. Hit Undeploy to remove an agent.",
    tip: "Agents with high reputation appear in the centre of the city.",
  },
  all: {
    icon: "✦",
    color: "#d4a820",
    title: "Learn a Spell",
    what: "Hogwarts — where every agent is a student. Casting a spell runs a full pipeline. Each house maps to a category: Ravenclaw (data), Slytherin (trading), Hufflepuff (analysis), Gryffindor (composite).",
    how: "Pick a spell and cast it. Watch the wizard agents animate as each step executes. House points update in real time.",
    tip: "Start with Market Pulse — it chains 3 agents and gives a BUY/SELL/HOLD signal.",
  },
};

function WorldInfoBanner({ worldId }) {
  const [open, setOpen] = useState(false);
  const info = WORLD_INFO[worldId];
  if (!info) return null;
  return (
    <div style={{ marginBottom: 14, flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", background: `${info.color}10`, border: `1px solid ${info.color}25`,
          borderRadius: 8, padding: "7px 10px", cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <span style={{ color: info.color, fontSize: 11, fontWeight: 700 }}>
          {info.icon} What is this world?
        </span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${info.color}20`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "12px 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 1.6, fontFamily: "system-ui, sans-serif" }}>{info.what}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <span style={{ color: info.color, fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>HOW</span>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 1.5, fontFamily: "system-ui, sans-serif" }}>{info.how}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>TIP</span>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 1.5, fontFamily: "system-ui, sans-serif" }}>{info.tip}</span>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [market,     setMarket]     = useState("BTC");
  const timerRef = useRef(null);
  const MARKETS = ["BTC", "ETH", "SOL", "AVAX"];

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
    timerRef.current = setInterval(() => { loadPipelines(); pollJobs(); }, 10000);
    return () => clearInterval(timerRef.current);
  }, []);

  const runPipeline = async (pipeline) => {
    setRunning(r => ({ ...r, [pipeline.id]: true }));
    try {
      const res = await fetch(`${API}/run-pipeline/${pipeline.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market }),
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

      {/* Title + market selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: "#10b981",
          animation: "dotPulse 1.5s ease infinite",
          flexShrink: 0,
        }} />
        <span style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14, fontFamily: "system-ui, sans-serif", letterSpacing: "-0.2px", flex: 1 }}>
          LIVE SIGNALS
        </span>
      </div>

      {/* Market selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexShrink: 0 }}>
        {MARKETS.map(m => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            style={{
              flex: 1,
              background: market === m ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${market === m ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 6,
              color: market === m ? "#10b981" : "rgba(255,255,255,0.4)",
              fontSize: 10,
              fontWeight: market === m ? 700 : 500,
              padding: "4px 0",
              cursor: "pointer",
              fontFamily: "monospace",
              transition: "all 0.15s",
            }}
          >{m}</button>
        ))}
      </div>

      {/* Pipeline list */}
      <div style={{ overflowY: "auto", flex: 1, marginBottom: 10 }}>
        {pipelines.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ ...mutedLabel, marginBottom: 8 }}>No pipelines yet — build one in</div>
            <a href="/build" style={{ color: "#10b981", fontSize: 11, fontWeight: 700, textDecoration: "none", fontFamily: "system-ui, sans-serif" }}>
              Pipeline Builder →
            </a>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pipelines.map(p => {
            const res = results[p.id];
            const sig = res?.signal || res?.recommendation || res?.action;
            const isFlashing = flash === p.id;
            const stepCount = p.agent_ids?.length ?? 0;
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600, fontFamily: "system-ui, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontFamily: "monospace", marginTop: 1 }}>
                      {stepCount} agent{stepCount !== 1 ? "s" : ""}
                    </div>
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
                    {res.confidence && (
                      <span style={{ color: "#a78bfa", fontSize: 10, fontFamily: "monospace" }}>
                        {(res.confidence * 100).toFixed(0)}%
                      </span>
                    )}
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

const REP_TIER = (r) => r >= 4.5 ? { label: "Elite", color: "#f59e0b" } : r >= 3.5 ? { label: "Pro", color: "#818cf8" } : r >= 2.5 ? { label: "Active", color: "#34d399" } : { label: "New", color: "#9aabb8" };

function VegasPanel() {
  const [econ,      setEcon]      = useState(null);
  const [jobs,      setJobs]      = useState([]);
  const [flow,      setFlow]      = useState([]);
  const [jobView,   setJobView]   = useState("board"); // "board" | "post"
  const [postForm,  setPostForm]  = useState({ title: "", description: "", required_category: "", required_min_rep: 0, bounty_credits: "", deadline_hours: 24 });
  const [posting,   setPosting]   = useState(false);
  const [postMsg,   setPostMsg]   = useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem("av_token") : null;

  const load = () => {
    fetch(`${API}/economy/stats`).then(r => r.json()).then(setEcon).catch(() => {});
    fetch(`${API}/agent-jobs?status=open&limit=10`).then(r => r.json()).then(d => setJobs(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  // WS-driven revenue flow
  useEffect(() => {
    let ws, retry;
    const connect = () => {
      try {
        ws = new WebSocket(typeof window !== "undefined" ? (window.__AV_WS__ || "wss://agentverse-production.up.railway.app/ws") : "");
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (["agent_call_done", "job_completed", "pipeline_done"].includes(msg.type)) {
              const label = msg.type === "job_completed" ? `+$${Number(msg.payout || 0).toFixed(4)} job` : `+$${Number(msg.price || msg.amount || 0).toFixed(4)}`;
              const name  = msg.agent_name || msg.title || msg.pipeline_id?.slice(0, 8) || "agent";
              setFlow(prev => [{ id: Date.now(), label, name }, ...prev].slice(0, 6));
            }
          } catch {}
        };
        ws.onclose = () => { retry = setTimeout(connect, 6000); };
      } catch {}
    };
    connect();
    return () => { clearTimeout(retry); try { ws?.close(); } catch {} };
  }, []);

  const postJob = async () => {
    if (!token) { setPostMsg("Sign in to post a job"); return; }
    if (!postForm.title || !postForm.bounty_credits) { setPostMsg("Title and bounty required"); return; }
    setPosting(true); setPostMsg("");
    try {
      const res = await fetch(`${API}/agent-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...postForm, bounty_credits: parseFloat(postForm.bounty_credits), input_data: {} }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || "Failed");
      setPostMsg(`Job posted! Bounty $${postForm.bounty_credits} escrowed.`);
      setPostForm({ title: "", description: "", required_category: "", required_min_rep: 0, bounty_credits: "", deadline_hours: 24 });
      setJobView("board");
      load();
    } catch (e) { setPostMsg(`Error: ${e.message}`); }
    finally { setPosting(false); }
  };

  const claimJob = async (jobId) => {
    if (!token) { alert("Sign in to claim a job"); return; }
    const agentId = prompt("Enter your agent ID to claim this job:");
    if (!agentId) return;
    const res = await fetch(`${API}/agent-jobs/${jobId}/claim?agent_id=${agentId}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    alert(res.ok ? `Job claimed by ${agentId}` : d.detail || "Failed");
    load();
  };

  const top = econ?.top_agents || [];
  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: "#f9fafb", fontFamily: "system-ui, sans-serif", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }`}</style>
      <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14, fontFamily: "system-ui, sans-serif", letterSpacing: "-0.2px", marginBottom: 12, flexShrink: 0 }}>AGENT ECONOMY</div>

      <div style={{ overflowY: "auto", flex: 1 }}>

        {/* Economy stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
          {[
            { label: "Open Jobs",      value: econ?.open_jobs ?? "—",                                    color: "#f59e0b" },
            { label: "Jobs Completed", value: econ?.completed_jobs ?? "—",                               color: "#34d399" },
            { label: "Bounties Paid",  value: econ ? `$${Number(econ.total_bounties_paid).toFixed(2)}` : "—", color: "#818cf8" },
            { label: "Top Agents",     value: top.length || "—",                                          color: "#9aabb8" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ color: s.color, fontWeight: 800, fontSize: 14, fontFamily: "monospace" }}>{s.value}</div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Top earners with rep tiers */}
        <div style={sectionHeader}>Top Earners</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
          {top.slice(0, 6).map((a, i) => {
            const tier = REP_TIER(a.reputation || 3);
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "7px 10px" }}>
                <span style={{ color: i === 0 ? "#f59e0b" : "rgba(255,255,255,0.25)", fontWeight: 700, fontSize: 10, fontFamily: "monospace", width: 16, textAlign: "center", flexShrink: 0 }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#e5e7eb", fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {i === 0 && "👑 "}{a.name}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 1 }}>
                    <span style={{ background: `${tier.color}20`, border: `1px solid ${tier.color}50`, borderRadius: 4, padding: "0 5px", fontSize: 8, color: tier.color, fontWeight: 700 }}>{tier.label}</span>
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 9 }}>{(a.reputation || 0).toFixed(1)}★ · {a.total_calls || 0} calls</span>
                  </div>
                </div>
                <div style={{ color: "#34d399", fontWeight: 800, fontSize: 11, flexShrink: 0, fontFamily: "monospace" }}>${Number(a.total_earned || 0).toFixed(4)}</div>
              </div>
            );
          })}
          {top.length === 0 && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>No earnings yet — call some agents.</div>}
        </div>

        {/* Jobs board */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={sectionHeader}>Jobs Board</div>
          <button onClick={() => setJobView(v => v === "post" ? "board" : "post")} style={{ background: jobView === "post" ? "rgba(255,255,255,0.08)" : "rgba(129,140,248,0.15)", border: "1px solid rgba(129,140,248,0.3)", borderRadius: 6, padding: "3px 10px", fontSize: 10, color: "#818cf8", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
            {jobView === "post" ? "← Board" : "+ Post Job"}
          </button>
        </div>

        {jobView === "post" ? (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <input value={postForm.title} onChange={e => setPostForm(f => ({ ...f, title: e.target.value }))} placeholder="Job title" style={{ ...inputStyle, marginBottom: 6 }} />
            <textarea value={postForm.description} onChange={e => setPostForm(f => ({ ...f, description: e.target.value }))} placeholder="What needs to be done?" rows={2} style={{ ...inputStyle, resize: "vertical", marginBottom: 6 }} />
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <select value={postForm.required_category} onChange={e => setPostForm(f => ({ ...f, required_category: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>
                <option value="">Any category</option>
                {["trading", "analysis", "data", "risk", "composite"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={postForm.bounty_credits} onChange={e => setPostForm(f => ({ ...f, bounty_credits: e.target.value }))} placeholder="Bounty $" type="number" min="0.01" step="0.01" style={{ ...inputStyle, width: 80, flex: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>Min rep:</span>
              <input value={postForm.required_min_rep} onChange={e => setPostForm(f => ({ ...f, required_min_rep: parseFloat(e.target.value) || 0 }))} type="number" min="0" max="5" step="0.5" style={{ ...inputStyle, width: 60, flex: "none" }} />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>Deadline (h):</span>
              <input value={postForm.deadline_hours} onChange={e => setPostForm(f => ({ ...f, deadline_hours: parseInt(e.target.value) || 24 }))} type="number" min="1" style={{ ...inputStyle, width: 60, flex: "none" }} />
            </div>
            <button onClick={postJob} disabled={posting} style={{ width: "100%", background: posting ? "rgba(255,255,255,0.05)" : "rgba(129,140,248,0.2)", border: "1px solid rgba(129,140,248,0.4)", borderRadius: 7, padding: "7px", fontSize: 11, fontWeight: 700, color: "#818cf8", cursor: posting ? "default" : "pointer", fontFamily: "inherit" }}>
              {posting ? "Posting..." : "Post Job & Escrow Bounty"}
            </button>
            {postMsg && <div style={{ marginTop: 6, fontSize: 10, color: postMsg.startsWith("Error") ? "#f87171" : "#34d399" }}>{postMsg}</div>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {jobs.length === 0 && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>No open jobs — be the first to post one.</div>}
            {jobs.map(j => (
              <div key={j.id} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "9px 11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#e5e7eb", fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.title}</div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 2 }}>
                      {j.required_category && <span style={{ color: "#818cf8", marginRight: 6 }}>{j.required_category}</span>}
                      {j.required_min_rep > 0 && <span style={{ marginRight: 6 }}>{j.required_min_rep}★ min</span>}
                      by {j.poster_name || "anon"}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 12, fontFamily: "monospace" }}>${Number(j.bounty_credits).toFixed(2)}</div>
                    <button onClick={() => claimJob(j.id)} style={{ marginTop: 4, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 5, padding: "2px 8px", fontSize: 9, color: "#34d399", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Claim</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live revenue flow */}
        <div style={sectionHeader}>Live Flow</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {flow.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>Waiting for activity…</div>}
          {flow.map((e, i) => (
            <div key={e.id} style={{ display: "flex", gap: 8, animation: i === 0 ? "slideIn 0.35s ease" : "none", opacity: 1 - i * 0.18 }}>
              <span style={{ color: "#10b981", fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{e.label}</span>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{e.name}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Burning Man panel (experimental) ─────────────────────────────────────────

function BurningManPanel() {
  const [agents,      setAgents]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [form,        setForm]        = useState({ name: "", endpoint: "", price: "0.001" });
  const [deploying,   setDeploying]   = useState(false);
  const [deployed,    setDeployed]    = useState(null);
  const [err,         setErr]         = useState("");
  const [showForm,    setShowForm]    = useState(false);
  const [pingUrl,     setPingUrl]     = useState("");
  const [pinging,     setPinging]     = useState(false);
  const [pingResult,  setPingResult]  = useState(null);
  const [pingError,   setPingError]   = useState(null);
  const [pingMs,      setPingMs]      = useState(null);

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

  const pingEndpoint = async () => {
    if (!pingUrl.trim()) return;
    setPinging(true);
    setPingResult(null);
    setPingError(null);
    setPingMs(null);
    const start = Date.now();
    try {
      const res = await fetch(pingUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market: "BTC", test: true }),
      });
      const elapsed = Date.now() - start;
      setPingMs(elapsed);
      const data = await res.json().catch(() => ({ status: res.status }));
      setPingResult(data);
    } catch (e) {
      setPingMs(Date.now() - start);
      setPingError(e.message || "Request failed");
    }
    setPinging(false);
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

        {/* Test Endpoint */}
        <div style={divider} />
        <div style={sectionHeader}>🧪 Test Endpoint</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input
            value={pingUrl}
            onChange={e => setPingUrl(e.target.value)}
            placeholder="https://your-agent.app/run"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={pingEndpoint}
            disabled={pinging || !pingUrl.trim()}
            style={{
              background: pinging ? "#1f2937" : "rgba(255,107,53,0.18)",
              border: "1px solid rgba(255,107,53,0.4)",
              borderRadius: 7,
              color: pinging ? "#6b7280" : "#FF6B35",
              fontSize: 11,
              fontWeight: 700,
              padding: "7px 12px",
              cursor: (pinging || !pingUrl.trim()) ? "not-allowed" : "pointer",
              fontFamily: "system-ui, sans-serif",
              flexShrink: 0,
            }}
          >
            {pinging ? "..." : "Ping"}
          </button>
        </div>
        {pingMs !== null && (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "monospace", marginBottom: 6 }}>
            {pingMs}ms response time · no credits charged
          </div>
        )}
        {pingResult && (
          <pre style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,107,53,0.2)",
            borderRadius: 7,
            padding: "8px 10px",
            color: "#10b981",
            fontSize: 9,
            fontFamily: "monospace",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            marginBottom: 8,
          }}>
            {JSON.stringify(pingResult, null, 2)}
          </pre>
        )}
        {pingError && (
          <div style={{ color: "#ef4444", fontSize: 10, fontFamily: "monospace", marginBottom: 8 }}>
            Error: {pingError}
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

  const totalSteps = pipelines.reduce((sum, p) => sum + (p.agent_ids?.length || 0), 0);

  const NOW_MS = Date.now();
  const isRecentlyRun = (lastRunAt) => {
    if (!lastRunAt) return false;
    return (NOW_MS - new Date(lastRunAt).getTime()) < 24 * 60 * 60 * 1000;
  };

  const agentNames = agents.length > 0
    ? agents.map(a => a.name)
    : ["PriceFeedAgent", "MomentumAgent", "SentimentBot", "RiskEngine", "TrendScanner", "ArbitrageBot", "NewsAgent", "VolatilityScanner"];

  const dataPacket = (i) => agentNames[(tick + i) % agentNames.length];

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <div style={{ color: "#00FF41", fontFamily: "monospace", fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
            {agents.length}
          </div>
          <div style={{ color: "rgba(0,255,65,0.5)", fontSize: 8, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>
            agents
          </div>
        </div>
        <div style={{ width: 1, height: 30, background: "rgba(0,255,65,0.15)", flexShrink: 0 }} />
        <div>
          <div style={{ color: "#e5e7eb", fontSize: 11, fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>
            Active Connections
          </div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "monospace" }}>
            {pipelines.length} pipeline{pipelines.length !== 1 ? "s" : ""} · {totalSteps} steps
          </div>
        </div>
        {/* Pulsing agent name packets */}
        <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              color: "#00FF41",
              fontSize: 7,
              fontFamily: "monospace",
              opacity: 0.45 - i * 0.1,
              animation: `matrixFade ${1 + i * 0.4}s ease infinite`,
              animationDelay: `${i * 0.2}s`,
              maxWidth: 80,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {dataPacket(i)}
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
            const steps = p.agent_ids || [];
            const live = isRecentlyRun(p.last_run_at);
            return (
              <div key={p.id} style={{
                background: "rgba(0,255,65,0.025)",
                border: `1px solid ${live ? "rgba(0,255,65,0.2)" : "rgba(0,255,65,0.1)"}`,
                borderRadius: 9,
                padding: "9px 11px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  {live && (
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%", background: "#00FF41",
                      animation: "matrixFade 1.2s ease infinite", flexShrink: 0,
                    }} />
                  )}
                  <div style={{ color: "#e5e7eb", fontSize: 11, fontWeight: 600, fontFamily: "system-ui, sans-serif", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </div>
                  {p.last_run_at && (
                    <div style={{ color: "rgba(0,255,65,0.4)", fontSize: 8, fontFamily: "monospace", flexShrink: 0 }}>
                      {new Date(p.last_run_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 3 }}>
                  {steps.map((agentId, i) => {
                    const name = agentNameById(agentId);
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
            <div style={sectionHeader}>Data Packets</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={`${tick}-${i}`} style={{
                  color: "rgba(0,255,65,0.55)",
                  fontSize: 8,
                  fontFamily: "monospace",
                  background: "rgba(0,255,65,0.04)",
                  border: "1px solid rgba(0,255,65,0.12)",
                  borderRadius: 3,
                  padding: "2px 5px",
                  animation: `matrixFade ${0.8 + i * 0.15}s ease infinite`,
                  animationDelay: `${i * 0.1}s`,
                }}>
                  {dataPacket(i + tick * 3)}
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
  const [token,     setToken]     = useState(null);
  const [agents,    setAgents]    = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [removing,  setRemoving]  = useState({});

  useEffect(() => {
    try {
      const u = localStorage.getItem("av_user");
      const t = localStorage.getItem("av_token");
      if (u && t) { setUser(JSON.parse(u)); setToken(t); }
    } catch {}

    fetch(`${API}/agents`).then(r => r.json()).then(setAgents).catch(() => {});
    fetch(`${API}/pipelines`).then(r => r.json()).then(d => {
      setPipelines(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const myAgents = user
    ? agents.filter(a =>
        a.developer_name === user.username ||
        a.owner_wallet?.toLowerCase() === user.wallet?.toLowerCase()
      )
    : [];

  const undeploy = async (agentId) => {
    if (!token) return;
    if (!confirm("Remove this agent from AgentVerse? This cannot be undone.")) return;
    setRemoving(r => ({ ...r, [agentId]: true }));
    try {
      const res = await fetch(`${API}/agents/${agentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 204) {
        setAgents(a => a.filter(x => x.id !== agentId));
      }
    } catch {}
    setRemoving(r => { const n = { ...r }; delete n[agentId]; return n; });
  };

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
            {/* Stats summary */}
            {myAgents.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <div style={{
                  flex: 1, background: "rgba(126,200,126,0.06)", border: "1px solid rgba(126,200,126,0.15)",
                  borderRadius: 7, padding: "6px 10px", textAlign: "center",
                }}>
                  <div style={{ ...dataValue, fontSize: 14, color: "#7ec87e" }}>{myAgents.length}</div>
                  <div style={{ ...mutedLabel, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>Agents</div>
                </div>
                <div style={{
                  flex: 1, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)",
                  borderRadius: 7, padding: "6px 10px", textAlign: "center",
                }}>
                  <div style={{ ...dataValue, fontSize: 14, color: "#34d399" }}>
                    ${myAgents.reduce((s, a) => s + (a.earnings || 0), 0).toFixed(4)}
                  </div>
                  <div style={{ ...mutedLabel, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>Earned</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* My agents */}
        <div style={sectionHeader}>My Agents</div>
        {loading ? (
          <div style={mutedLabel}>Loading...</div>
        ) : myAgents.length === 0 ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ ...mutedLabel, fontSize: 11, marginBottom: user ? 8 : 0 }}>
              {user ? "No agents deployed yet." : "Sign in to see your agents."}
            </div>
            {user && (
              <a href="/?tab=developer" style={{
                display: "inline-block",
                background: "rgba(126,200,126,0.1)",
                border: "1px solid rgba(126,200,126,0.25)",
                borderRadius: 7,
                color: "#7ec87e",
                fontSize: 11,
                fontWeight: 700,
                padding: "6px 12px",
                textDecoration: "none",
                fontFamily: "system-ui, sans-serif",
              }}>
                Deploy your first agent →
              </a>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {myAgents.map(a => (
              <div key={a.id} style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 8,
                padding: "8px 10px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                      {a.category} · ${a.price_per_request?.toFixed(3)}/call
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ color: "#34d399", fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>
                      {a.status === "active" ? "● live" : "○ idle"}
                    </div>
                    <div style={{ color: "rgba(52,211,153,0.6)", fontSize: 9, fontFamily: "monospace" }}>
                      ${(a.earnings || 0).toFixed(4)} earned
                    </div>
                  </div>
                </div>
                {token && (
                  <button
                    onClick={() => undeploy(a.id)}
                    disabled={removing[a.id]}
                    style={{
                      marginTop: 7, width: "100%",
                      background: removing[a.id] ? "rgba(255,255,255,0.03)" : "rgba(239,68,68,0.07)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 6, padding: "5px 0",
                      color: removing[a.id] ? "rgba(255,255,255,0.2)" : "#f87171",
                      fontSize: 10, fontWeight: 700, cursor: removing[a.id] ? "default" : "pointer",
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    {removing[a.id] ? "Removing…" : "Undeploy"}
                  </button>
                )}
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
                  {p.agent_ids?.length ?? 0} steps
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
  {
    name: "Alpha Signal",
    desc: "Find high-conviction opportunities",
    agents: ["NewsFeedAgent", "SentimentAgent", "CorrelationAgent", "MomentumAgent"],
    color: "#f59e0b",
    keywords: ["alpha", "signal", "news"],
  },
  {
    name: "Portfolio Check",
    desc: "Optimise your portfolio allocation",
    agents: ["PriceFeedAgent", "RiskAgent", "PortfolioOptimizer"],
    color: "#06b6d4",
    keywords: ["portfolio", "optimiz"],
  },
];

function HogwartsPanel({ onWorldSwitch }) {
  const [castingSpell, setCastingSpell] = useState(null);
  const [castingStep,  setCastingStep]  = useState(-1);
  const [spellResult,  setSpellResult]  = useState(null);
  const [castError,    setCastError]    = useState(null);

  const castSpell = async (spell) => {
    setCastingSpell(spell.name);
    setCastingStep(0);
    setSpellResult(null);
    setCastError(null);

    // Animate each agent lighting up with 400ms delay
    for (let i = 0; i < spell.agents.length; i++) {
      await new Promise(res => setTimeout(res, 400));
      setCastingStep(i);
    }

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
    setCastingStep(-1);
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

                {/* Step progress during casting */}
                {isCasting && castingStep >= 0 && (
                  <div style={{ color: spell.color, fontSize: 10, fontFamily: "system-ui, sans-serif", marginBottom: 5, opacity: 0.85 }}>
                    Step {castingStep + 1}/{spell.agents.length}: {spell.agents[castingStep]}...
                  </div>
                )}

                {/* Agent chain */}
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 3 }}>
                  {spell.agents.map((a, i) => {
                    const isActive = isCasting && i === castingStep;
                    const isDone   = isCasting && i < castingStep;
                    return (
                      <span key={a} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{
                          background: isActive ? `${spell.color}28` : isDone ? `${spell.color}14` : `${spell.color}0e`,
                          border: `1px solid ${isActive ? spell.color + "70" : spell.color + "20"}`,
                          borderRadius: 4,
                          color: isActive ? spell.color : isDone ? `${spell.color}90` : `${spell.color}b0`,
                          fontSize: 8,
                          fontFamily: "monospace",
                          padding: "1px 5px",
                          transition: "all 0.3s",
                          fontWeight: isActive ? 700 : 400,
                        }}>
                          {a}
                        </span>
                        {i < spell.agents.length - 1 && (
                          <span style={{ color: `${spell.color}40`, fontSize: 9, fontFamily: "monospace" }}>→</span>
                        )}
                      </span>
                    );
                  })}
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

            {/* Build pipeline CTA */}
            <a href="/build" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: `${spellResult.spell.color}0e`,
              border: `1px solid ${spellResult.spell.color}30`,
              borderRadius: 8,
              padding: "8px 12px",
              textDecoration: "none",
              marginBottom: 10,
            }}>
              <span style={{ color: spellResult.spell.color, fontSize: 11, fontWeight: 700, fontFamily: "system-ui, sans-serif" }}>
                Build this pipeline →
              </span>
            </a>

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

function DeployHereButton({ worldId, color }) {
  const [show, setShow] = useState(false);
  const categoryMap = { trading: "trading", defi: "composite", experimental: "default", data: "data", analysis: "analysis", all: "default" };
  const category = categoryMap[worldId] ?? "default";
  if (show) {
    return (
      <div style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${color}30`, borderRadius: 10, padding: "12px 12px", marginBottom: 10 }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 8, fontFamily: "system-ui, sans-serif" }}>
          Deploy an agent to this world by going to the Developer Dashboard and registering with category <strong style={{ color }}>{category}</strong>.
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <a href="/?tab=developer" style={{ flex: 1, display: "block", textAlign: "center", background: `${color}18`, border: `1px solid ${color}35`, borderRadius: 7, padding: "8px 0", color, fontSize: 11, fontWeight: 700, textDecoration: "none", fontFamily: "system-ui, sans-serif" }}>
            Developer Hub →
          </a>
          <button onClick={() => setShow(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "rgba(255,255,255,0.3)", fontSize: 11, padding: "0 10px", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>✕</button>
        </div>
      </div>
    );
  }
  return (
    <button onClick={() => setShow(true)} style={{
      width: "100%", background: `${color}10`, border: `1px dashed ${color}35`,
      borderRadius: 9, padding: "8px 0", color, fontSize: 11, fontWeight: 700,
      cursor: "pointer", marginBottom: 10, fontFamily: "system-ui, sans-serif",
      transition: "background 0.15s",
    }}
    onMouseEnter={e => { e.currentTarget.style.background = `${color}20`; }}
    onMouseLeave={e => { e.currentTarget.style.background = `${color}10`; }}
    >+ Deploy agent here</button>
  );
}

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
          {/* World info banner */}
          <WorldInfoBanner worldId={worldId} />

          {/* Deploy here button */}
          <DeployHereButton worldId={worldId} color={wc.color} />

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
