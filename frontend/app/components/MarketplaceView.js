"use client";

import { useEffect, useState, useMemo } from "react";

import { API } from "@/app/lib/config";
import { fetchWithX402 } from "@/app/lib/x402";
import { useWallet } from "./WalletProvider";

// ── Plaza pastel palette ───────────────────────────────────────────────────────

const CAT = {
  trading:   { border: "#6BCF8B", bg: "#f0fdf5", text: "#1a5c3a", letter: "T" },
  analysis:  { border: "#B59CE6", bg: "#f8f5ff", text: "#3d2580", letter: "A" },
  data:      { border: "#6BB6E6", bg: "#f0f8ff", text: "#1a4d7a", letter: "D" },
  risk:      { border: "#E67B7B", bg: "#fff4f4", text: "#7a1a1a", letter: "R" },
  composite: { border: "#E6C36B", bg: "#fffcf0", text: "#7a5a0a", letter: "C" },
  default:   { border: "#9aabb8", bg: "#f5f7fa", text: "#3d5470", letter: "·" },
};
const cat = (c) => CAT[c] ?? CAT.default;

// Payment type helpers — 1 credit = $0.01
const isX402Agent = (agent) => agent.owner_wallet?.startsWith("0x") && agent.owner_wallet?.length === 42;
const toCredits   = (usd) => Math.max(1, Math.round(usd * 100));

// ── Plaza tree prop ───────────────────────────────────────────────────────────

function PlazaTree({ size = 32 }) {
  const trunk = Math.round(size * 0.22);
  return (
    <div style={{ width: size, height: size + trunk, position: "relative", flexShrink: 0, userSelect: "none" }}>
      <div style={{
        width: size, height: size,
        background: "#6BCF8B", borderRadius: "50% 50% 42% 42%",
        position: "absolute", top: 0,
        boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.10)",
      }} />
      <div style={{
        width: trunk, height: trunk,
        background: "#c4a070", borderRadius: 3,
        position: "absolute", bottom: 0, left: "50%",
        transform: "translateX(-50%)",
      }} />
    </div>
  );
}

function CatDot({ category, size = 36 }) {
  const c = cat(category);
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
      background: c.border, display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: Math.round(size * 0.48), fontWeight: 800,
    }}>{c.letter}</div>
  );
}

// ── Stall card ────────────────────────────────────────────────────────────────

function StallCard({ agent, metrics, rank }) {
  const c = cat(agent.category);
  const m = metrics || {};
  const RANK_LABEL = rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : null;
  const { account, walletClient, connect } = useWallet();
  const [tryState,  setTryState]  = useState("idle"); // "idle" | "running" | "ok" | "err" | "needs_wallet"
  const [tryResult, setTryResult] = useState(null);

  const handleTry = async () => {
    setTryState("running");
    setTryResult(null);
    try {
      const opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market: "BTC" }) };
      const res = await fetchWithX402(`${API}/call-agent/${agent.id}`, opts, walletClient, account);
      if (res.status === 402) { setTryState("needs_wallet"); return; }
      if (!res.ok) { setTryState("err"); return; }
      const data = await res.json();
      setTryResult(data);
      setTryState("ok");
    } catch (e) {
      setTryState(e.message?.includes("cancelled") ? "idle" : "err");
    }
  };

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e6d6bd",
      borderTop: `3px solid ${c.border}`,
      borderRadius: 14, padding: "16px",
      position: "relative",
      boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
      transition: "box-shadow 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.10), 0 0 0 1px ${c.border}40`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)"; }}>

      {RANK_LABEL && (
        <div style={{
          position: "absolute", top: 12, right: 14,
          background: c.border, color: "#fff",
          borderRadius: 6, padding: "2px 8px",
          fontSize: 10, fontWeight: 800,
        }}>{RANK_LABEL}</div>
      )}

      {/* Icon row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <CatDot category={agent.category} size={36} />
        <div style={{ flex: 1 }}>
          <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
            {agent.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
            <span style={{
              background: `${c.border}18`, color: c.border,
              borderRadius: 4, padding: "1px 7px", fontSize: 9,
              fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8,
            }}>{agent.category}</span>
            {isX402Agent(agent) ? (
              <span style={{
                background: "#f3e8ff", color: "#7c3aed", border: "1px solid #e9d5ff",
                borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 700,
              }}>⚡ USDC</span>
            ) : (
              <span style={{
                background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe",
                borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 700,
              }}>💳 Credits</span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{ color: "#9aabb8", fontSize: 12, lineHeight: 1.55, marginBottom: 13 }}>
        {agent.description || "No description."}
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 13 }}>
        {[
          [isX402Agent(agent) ? "Price / call" : "Cost", isX402Agent(agent) ? `$${agent.price_per_request}` : `${toCredits(agent.price_per_request)} credits`],
          ["Requests",    m.requests || 0],
          ["Avg latency", m.avg_latency_ms ? `${m.avg_latency_ms}ms` : "—"],
          ["Earned",      m.earnings ? `${toCredits(m.earnings)} credits` : "—"],
        ].map(([k, v]) => (
          <div key={k} style={{ background: "#f8f6f2", borderRadius: 7, padding: "7px 9px" }}>
            <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase",
              letterSpacing: 0.7, marginBottom: 2 }}>{k}</div>
            <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 13 }}>{String(v)}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ display: "flex", gap: 7 }}>
        <a href="/build" title="Open Pipeline Builder to chain this agent with others"
          style={{
            flex: 1, textAlign: "center", background: `${c.border}14`, color: c.border,
            border: `1px solid ${c.border}33`, borderRadius: 9, padding: "8px",
            fontSize: 11, fontWeight: 700, textDecoration: "none", display: "block",
          }}>+ Build Pipeline</a>
        <button
          onClick={tryState === "needs_wallet" ? connect : handleTry}
          disabled={tryState === "running"}
          style={{
            flex: 1, borderRadius: 9, padding: "8px", fontSize: 11, fontWeight: 700,
            cursor: tryState === "running" ? "default" : "pointer",
            border: "1px solid #e6d6bd",
            background: tryState === "ok" ? "#d1fae5" : tryState === "err" ? "#fee2e2" : tryState === "needs_wallet" ? "#f3e8ff" : "#f8f6f2",
            color:      tryState === "ok" ? "#065f46" : tryState === "err" ? "#991b1b" : tryState === "needs_wallet" ? "#7c3aed" : c.border,
          }}
        >
          {tryState === "running" ? "Running…" : tryState === "ok" ? "✓ Done" : tryState === "err" ? "Failed" : tryState === "needs_wallet" ? "⚡ Connect Wallet" : "Try it"}
        </button>
      </div>

      {/* Live result output */}
      {tryResult && (
        <div style={{
          marginTop: 10, background: "#f8f6f2", borderRadius: 9,
          border: `1px solid ${c.border}30`, padding: "10px 12px",
        }}>
          <div style={{ color: "#9aabb8", fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            Live Result — BTC
          </div>
          {Object.entries(tryResult)
            .filter(([k]) => !["market", "agent_id", "_mock"].includes(k))
            .slice(0, 5)
            .map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between",
                fontSize: 11, lineHeight: 1.9 }}>
                <span style={{ color: "#9aabb8" }}>{k}</span>
                <span style={{ color: c.text, fontWeight: 700 }}>
                  {typeof v === "number" ? (v % 1 !== 0 ? v.toFixed(3) : v) : String(v).toUpperCase()}
                </span>
              </div>
            ))}
          <button onClick={() => setTryResult(null)} style={{
            marginTop: 6, background: "none", border: "none",
            color: "#b8c4d0", fontSize: 10, cursor: "pointer", padding: 0,
          }}>dismiss</button>
        </div>
      )}
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, color = "#4a9fd4" }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, marginTop: 36 }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%", background: color,
        flexShrink: 0, position: "relative", top: 1,
      }} />
      <div>
        <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 16 }}>{title}</div>
        {subtitle && <div style={{ color: "#9aabb8", fontSize: 12, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ── Category filter strip ─────────────────────────────────────────────────────

const CATS = ["all", "trading", "analysis", "data", "risk", "composite"];

function FilterStrip({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {CATS.map((c) => {
        const on = active === c;
        const color = c === "all" ? "#4a9fd4" : cat(c).border;
        return (
          <button key={c} onClick={() => onChange(c)} style={{
            padding: "5px 14px", borderRadius: 20, fontSize: 11, cursor: "pointer",
            border: on ? `1px solid ${color}50` : "1px solid #e6d6bd",
            fontWeight: 600, textTransform: "capitalize",
            background: on ? `${color}14` : "#fff",
            color: on ? color : "#9aabb8",
            boxShadow: on ? `0 2px 8px ${color}20` : "none",
          }}>{c === "all" ? "All" : c}</button>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MarketplaceView() {
  const [agents,     setAgents]     = useState([]);
  const [metrics,    setMetrics]    = useState({});
  const [filter,     setFilter]     = useState("all");
  const [backendOk,  setBackendOk]  = useState(true);

  useEffect(() => {
    let cancelled = false;
    let iv = null;

    const load = () =>
      Promise.all([
        fetch(`${API}/agents`).then((r) => r.json()),
        fetch(`${API}/metrics`).then((r) => r.json()),
      ]).then(([a, m]) => {
        if (cancelled) return;
        setBackendOk(true);
        setAgents(a);
        setMetrics(Object.fromEntries(m.map((x) => [x.agent_id, x])));
        clearInterval(iv);
      }).catch(() => {
        if (!cancelled) setBackendOk(false);
      });

    load();
    iv = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const visible = useMemo(() =>
    filter === "all" ? agents : agents.filter((a) => a.category === filter),
    [agents, filter]
  );

  const trending = useMemo(() =>
    [...agents].sort((a, b) => (metrics[b.id]?.requests || 0) - (metrics[a.id]?.requests || 0)).slice(0, 4),
    [agents, metrics]
  );

  const topEarning = useMemo(() =>
    [...agents].sort((a, b) => (metrics[b.id]?.earnings || 0) - (metrics[a.id]?.earnings || 0)).slice(0, 4),
    [agents, metrics]
  );

  const newAgents = useMemo(() =>
    [...agents].slice(-4).reverse(), // last 4 registered, newest first
    [agents]
  );

  const totalCalls    = Object.values(metrics).reduce((s, m) => s + (m?.requests || 0), 0);
  const totalEarnings = Object.values(metrics).reduce((s, m) => s + (m?.earnings || 0), 0).toFixed(2);

  return (
    <div style={{
      height: "100%", overflowY: "auto",
      background: "#f4e7d0", padding: "32px 40px",
      fontFamily: "inherit",
    }}>

      {/* Backend offline banner */}
      {!backendOk && (
        <div style={{
          marginBottom: 16, background: "#fee2e2", border: "1px solid #fca5a5",
          borderRadius: 10, padding: "10px 16px", color: "#991b1b",
          fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>⚠</span>
          Backend offline — run <code style={{ background: "rgba(0,0,0,0.08)", borderRadius: 4, padding: "1px 6px" }}>uvicorn main:app --port 8000</code> to load agents
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 24 }}>
        <PlazaTree size={36} />
        <div style={{ flex: 1 }}>
          <div style={{ color: "#2d3a4a", fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>
            Agent Bazaar
          </div>
          <div style={{ color: "#9aabb8", fontSize: 13, marginTop: 5 }}>
            {agents.length} agents registered · {totalCalls} total calls · ${totalEarnings} earned
          </div>
        </div>
        <PlazaTree size={28} />
      </div>

      {/* How it works */}
      <div style={{
        background: "#fff", border: "1px solid #e6d6bd", borderRadius: 12,
        padding: "14px 18px", marginBottom: 20,
        display: "flex", gap: 24, flexWrap: "wrap",
      }}>
        {[
          ["Credits", "1 credit = $0.01. Each agent call costs a small amount. Your demo wallet starts with 10,000 credits (worth $100)."],
          ["Try it", "Click Try it on any agent to call it live with real BTC data. The result appears instantly below the card."],
          ["Build Pipeline", "Click + Build Pipeline to open the Pipeline Builder and chain this agent with others into a workflow."],
        ].map(([title, body]) => (
          <div key={title} style={{ flex: "1 1 180px" }}>
            <div style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{title}</div>
            <div style={{ color: "#9aabb8", fontSize: 11, lineHeight: 1.6 }}>{body}</div>
          </div>
        ))}
      </div>

      {/* Filter strip */}
      <FilterStrip active={filter} onChange={setFilter} />

      {filter !== "all" ? (
        <>
          <SectionHeader
            title={`${filter.charAt(0).toUpperCase() + filter.slice(1)} Agents`}
            subtitle={`${visible.length} agent${visible.length !== 1 ? "s" : ""}`}
            color={cat(filter).border}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14 }}>
            {visible.map((a) => <StallCard key={a.id} agent={a} metrics={metrics[a.id]} />)}
            {visible.length === 0 && (
              <div style={{
                background: "#fff", border: "1px solid #e6d6bd", borderRadius: 14,
                padding: "40px 32px", color: "#9aabb8", fontSize: 14, fontStyle: "italic",
              }}>
                No agents in this category yet.
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <SectionHeader title="Trending" subtitle="Most active agents right now" color="#d45a5a" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14, marginBottom: 8 }}>
            {trending.map((a, i) => (
              <StallCard key={a.id} agent={a} metrics={metrics[a.id]} rank={i + 1} />
            ))}
            {trending.length === 0 && (
              <div style={{ color: "#9aabb8", fontSize: 13, fontStyle: "italic" }}>No activity yet.</div>
            )}
          </div>

          <SectionHeader title="Top Earning" subtitle="Highest cumulative revenue" color="#c4993c" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14, marginBottom: 8 }}>
            {topEarning.map((a, i) => (
              <StallCard key={a.id} agent={a} metrics={metrics[a.id]} rank={i + 1} />
            ))}
            {topEarning.length === 0 && (
              <div style={{ color: "#9aabb8", fontSize: 13, fontStyle: "italic" }}>No earnings yet.</div>
            )}
          </div>

          <SectionHeader title="New Arrivals" subtitle="Recently registered agents" color="#B59CE6" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14, marginBottom: 8 }}>
            {newAgents.map((a) => (
              <StallCard key={a.id} agent={a} metrics={metrics[a.id]} />
            ))}
            {newAgents.length === 0 && (
              <div style={{ color: "#9aabb8", fontSize: 13, fontStyle: "italic" }}>No agents yet.</div>
            )}
          </div>

          <SectionHeader title="All Agents" subtitle={`${agents.length} registered in the plaza`} color="#4a9fd4" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14 }}>
            {agents.map((a) => <StallCard key={a.id} agent={a} metrics={metrics[a.id]} />)}
            {agents.length === 0 && (
              <div style={{
                background: "#fff", border: "1px solid #e6d6bd", borderRadius: 14,
                padding: "40px 32px", color: "#9aabb8", fontSize: 14, fontStyle: "italic",
              }}>
                No agents registered yet. Publish your first agent to the plaza.
              </div>
            )}
          </div>
        </>
      )}

      <div style={{ height: 40 }} />
    </div>
  );
}
