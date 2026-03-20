"use client";

import { useEffect, useState, useMemo } from "react";
import { API } from "@/app/lib/config";

// ── Lobby themes ───────────────────────────────────────────────────────────────
export const LOBBY_THEMES = {
  trading: {
    sky: "#0B1E3D", fog: "#0B1E3D", floorLight: "#1C2E4A", floorDark: "#152338",
    ambient: "#2060A0", ambientInt: 0.9, sun: "#4DA6FF", sunInt: 1.2,
    fill: "#102050", fillInt: 0.5, hemiSky: "#1a3060", hemiGround: "#0a1020",
    bgStyle: "linear-gradient(180deg, #0B1E3D 0%, #152338 100%)",
  },
  analysis: {
    sky: "#E8F4FF", fog: "#D0E8FF", floorLight: "#F0F6FF", floorDark: "#D8EAFF",
    ambient: "#FFFFFF", ambientInt: 2.4, sun: "#FFFFFF", sunInt: 2.0,
    fill: "#B0D0F0", fillInt: 0.8, hemiSky: "#D0E8FF", hemiGround: "#E8F4FF",
    bgStyle: "linear-gradient(180deg, #D0E8FF 0%, #E8F4FF 100%)",
  },
  data: {
    sky: "#041B2E", fog: "#041B2E", floorLight: "#0A2A3E", floorDark: "#061822",
    ambient: "#00CCFF", ambientInt: 0.7, sun: "#00EEFF", sunInt: 1.0,
    fill: "#003050", fillInt: 0.6, hemiSky: "#004466", hemiGround: "#001122",
    bgStyle: "linear-gradient(180deg, #041B2E 0%, #061822 100%)",
  },
  defi: {
    sky: "#1A1200", fog: "#1A1200", floorLight: "#2A1E00", floorDark: "#1A1200",
    ambient: "#FFD700", ambientInt: 0.8, sun: "#FFD060", sunInt: 1.1,
    fill: "#5a3a00", fillInt: 0.5, hemiSky: "#3a2800", hemiGround: "#0a0800",
    bgStyle: "linear-gradient(180deg, #1A1200 0%, #0a0800 100%)",
  },
  experimental: {
    sky: "#0D1A0D", fog: "#0D1A0D", floorLight: "#1A2E1A", floorDark: "#0D1A0D",
    ambient: "#66FF66", ambientInt: 0.7, sun: "#80FF80", sunInt: 0.9,
    fill: "#003300", fillInt: 0.5, hemiSky: "#1a3a1a", hemiGround: "#050d05",
    bgStyle: "linear-gradient(180deg, #0D1A0D 0%, #050d05 100%)",
  },
  all: {
    sky: "#8ED6FF", fog: "#8ED6FF", floorLight: "#F4E7D0", floorDark: "#EAD9BE",
    ambient: "#ffffff", ambientInt: 2.2, sun: "#fffcf0", sunInt: 1.8,
    fill: "#DCEBFF", fillInt: 0.75, hemiSky: "#8ED6FF", hemiGround: "#c8e6c9",
    bgStyle: "linear-gradient(180deg, #cfe9ff 0%, #f4e7d0 100%)",
  },
};

export const LOBBIES = [
  {
    id: "trading",
    label: "Las Vegas",
    subtitle: "High-stakes trading",
    categories: ["trading", "risk"],
    deployCategory: "trading",
    color: "#ff2d78",
    gradient: "linear-gradient(135deg, #1a0008 0%, #2d0015 60%, #3d0020 100%)",
    symbol: "◈",
    desc: "Trading signals, momentum analysis, and risk management. Get BUY/SELL/HOLD calls with real-time data.",
    tags: ["Trading", "Risk", "Signals"],
    theme: LOBBY_THEMES.trading,
  },
  {
    id: "data",
    label: "Matrix",
    subtitle: "Data feeds & pipelines",
    categories: ["data"],
    deployCategory: "data",
    color: "#00FF41",
    gradient: "linear-gradient(135deg, #010d01 0%, #021502 60%, #031e03 100%)",
    symbol: "≋",
    desc: "Raw data infrastructure agents. Price feeds, order books, liquidity depth — the inputs every other agent needs.",
    tags: ["Price Feeds", "Order Books", "Liquidity"],
    theme: LOBBY_THEMES.data,
  },
  {
    id: "analysis",
    label: "Sims",
    subtitle: "Analysis & pattern detection",
    categories: ["analysis"],
    deployCategory: "analysis",
    color: "#7ec87e",
    gradient: "linear-gradient(135deg, #0a1a0a 0%, #101e10 60%, #162216 100%)",
    symbol: "◎",
    desc: "Sentiment analysis, trend detection, and pattern recognition. Turn raw data into real insight.",
    tags: ["Sentiment", "Trends", "Patterns"],
    theme: LOBBY_THEMES.analysis,
  },
  {
    id: "defi",
    label: "Tomorrowland",
    subtitle: "Composite pipelines",
    categories: ["composite"],
    deployCategory: "composite",
    color: "#c084fc",
    gradient: "linear-gradient(135deg, #0a0018 0%, #130025 60%, #1a0030 100%)",
    symbol: "⊕",
    desc: "Multi-agent pipelines deployed as a single callable agent. Built in Pipeline Builder, available here as one API.",
    tags: ["Pipelines", "Composite", "Multi-agent"],
    theme: LOBBY_THEMES.defi,
  },
  {
    id: "experimental",
    label: "Burning Man",
    subtitle: "Experimental builds",
    categories: ["experimental"],
    deployCategory: "experimental",
    color: "#FF6B35",
    gradient: "linear-gradient(135deg, #180800 0%, #220c00 60%, #2d1000 100%)",
    symbol: "◬",
    desc: "Early-stage, creative, and uncategorized agents. Where developers test new ideas before deploying to a world.",
    tags: ["Experimental", "Beta", "Creative"],
    theme: LOBBY_THEMES.experimental,
  },
  {
    id: "all",
    label: "Hogwarts",
    subtitle: "All agents, one campus",
    categories: null,
    deployCategory: "composite",
    color: "#d4a820",
    gradient: "linear-gradient(135deg, #110d02 0%, #1a1203 60%, #241804 100%)",
    symbol: "⬡",
    desc: "The full AgentVerse — every agent from every world in one place. Good for exploration and cross-category pipelines.",
    tags: ["All Agents", "Full Access", "Cross-world"],
    theme: LOBBY_THEMES.all,
  },
];

// World name by category (for display in wallet lookup)
const WORLD_BY_CAT = {
  trading:     { label: "Las Vegas",    color: "#ff2d78" },
  risk:        { label: "Las Vegas",    color: "#ff2d78" },
  data:        { label: "Matrix",       color: "#00FF41" },
  analysis:    { label: "Sims",         color: "#7ec87e" },
  composite:   { label: "Tomorrowland", color: "#c084fc" },
  experimental:{ label: "Burning Man",  color: "#FF6B35" },
};

// ── Deploy modal ───────────────────────────────────────────────────────────────

const CATS = ["trading", "analysis", "data", "risk", "composite", "experimental"];
const EMPTY_FORM = { name: "", description: "", endpoint: "", price_per_request: "0.001", health_endpoint: "", owner_wallet: "" };

function DeployModal({ lobby, onClose, onDeployed }) {
  const [form,    setForm]    = useState({ ...EMPTY_FORM, category: lobby?.deployCategory ?? "trading" });
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState("");
  const [success, setSuccess] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim())     { setErr("Agent name is required."); return; }
    if (!form.endpoint.trim()) { setErr("Endpoint URL is required."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch(`${API}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price_per_request: parseFloat(form.price_per_request) || 0 }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Registration failed");
      }
      const agent = await res.json();
      setSuccess(agent);
      onDeployed?.(agent);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const targetWorld = LOBBIES.find(l => l.deployCategory === form.category) ?? lobby;
  const worldColor  = targetWorld?.color ?? "#818cf8";

  const inputStyle = {
    width: "100%", background: "#1f2937", border: "1px solid #374151",
    borderRadius: 8, color: "#f3f4f6", padding: "9px 12px",
    fontSize: 13, boxSizing: "border-box", outline: "none",
    fontFamily: "system-ui, sans-serif",
  };
  const labelStyle = {
    color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5,
    display: "block",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#111827", border: "1px solid #1f2937",
        borderRadius: 22, width: "100%", maxWidth: 500,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        {success ? (
          /* ── Success state ── */
          <div style={{ padding: "36px 32px", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: `${worldColor}20`, border: `2px solid ${worldColor}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, margin: "0 auto 20px",
            }}>✓</div>
            <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
              Agent deployed!
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              <span style={{ color: worldColor, fontWeight: 700 }}>{success.name}</span> is now live in{" "}
              <span style={{ color: worldColor, fontWeight: 700 }}>{targetWorld?.label ?? "AgentVerse"}</span>.
              It will appear in the Store and can be called immediately.
            </div>

            {/* Agent ID copy */}
            <div style={{
              background: "#1f2937", border: "1px solid #374151",
              borderRadius: 10, padding: "12px 16px", marginBottom: 24, textAlign: "left",
            }}>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>
                Agent ID (save this)
              </div>
              <div style={{ color: "#818cf8", fontSize: 12, fontFamily: "monospace", wordBreak: "break-all" }}>
                {success.id}
              </div>
            </div>

            {/* Share link */}
            <div style={{
              background: `${worldColor}12`, border: `1px solid ${worldColor}30`,
              borderRadius: 10, padding: "11px 16px", marginBottom: 24, textAlign: "left",
            }}>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>
                Call endpoint
              </div>
              <div style={{ color: worldColor, fontSize: 11, fontFamily: "monospace", wordBreak: "break-all" }}>
                POST {API}/call-agent/{success.id}
              </div>
            </div>

            <button onClick={onClose} style={{
              background: worldColor, color: "#000",
              border: "none", borderRadius: 10, padding: "11px 28px",
              fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%",
            }}>
              Done
            </button>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            {/* Header */}
            <div style={{
              padding: "24px 28px 20px",
              borderBottom: "1px solid #1f2937",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px", marginBottom: 4 }}>
                    Deploy an agent
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                    Your agent goes live in{" "}
                    <span style={{ color: worldColor, fontWeight: 600 }}>
                      {targetWorld?.label ?? "AgentVerse"}
                    </span>
                    {" "}instantly
                  </div>
                </div>
                <button onClick={onClose} style={{
                  background: "#1f2937", border: "none",
                  width: 32, height: 32, borderRadius: 8,
                  color: "rgba(255,255,255,0.4)", fontSize: 18,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>×</button>
              </div>
            </div>

            {/* Form */}
            <div style={{ padding: "22px 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Name + Category row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Agent Name *</label>
                  <input
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    placeholder="e.g. Momentum Trader"
                    style={inputStyle}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={labelStyle}>World</label>
                  <select value={form.category} onChange={e => set("category", e.target.value)}
                    style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                    {CATS.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              {/* Endpoint */}
              <div>
                <label style={labelStyle}>Endpoint URL *</label>
                <input
                  value={form.endpoint}
                  onChange={e => set("endpoint", e.target.value)}
                  placeholder="https://your-agent.railway.app/run"
                  style={inputStyle}
                />
                <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, marginTop: 5 }}>
                  Must accept POST requests with a JSON body <code style={{ color: "#818cf8" }}>{`{"market":"BTC"}`}</code>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="What does this agent do? What data does it return?"
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {/* Price + Wallet row */}
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Price / call ($)</label>
                  <input
                    type="number" step="0.001" min="0"
                    value={form.price_per_request}
                    onChange={e => set("price_per_request", e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Wallet address (earn USDC)</label>
                  <input
                    value={form.owner_wallet}
                    onChange={e => set("owner_wallet", e.target.value)}
                    placeholder="0x… optional, Base network"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Health endpoint */}
              <div>
                <label style={labelStyle}>Health endpoint (optional — gets a verified badge)</label>
                <input
                  value={form.health_endpoint}
                  onChange={e => set("health_endpoint", e.target.value)}
                  placeholder="https://your-agent.railway.app/health"
                  style={inputStyle}
                />
              </div>

              {/* What happens next */}
              <div style={{
                background: `${worldColor}0e`, border: `1px solid ${worldColor}25`,
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{ color: worldColor, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                  What happens after you deploy
                </div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, lineHeight: 1.7 }}>
                  ✓ Agent appears in <strong style={{ color: worldColor }}>{targetWorld?.label}</strong> world immediately<br />
                  ✓ Listed in the Store — anyone can try it in one click<br />
                  ✓ Callable via <code style={{ color: "#818cf8", fontSize: 10 }}>POST /call-agent/{"<id>"}</code><br />
                  {form.owner_wallet && "✓ Callers pay you directly in USDC on Base"}
                </div>
              </div>

              {err && (
                <div style={{
                  background: "#450a0a", border: "1px solid #ef4444",
                  borderRadius: 8, padding: "9px 12px",
                  color: "#fca5a5", fontSize: 12,
                }}>{err}</div>
              )}

              <button onClick={submit} disabled={busy} style={{
                background: busy ? "#1f2937" : worldColor,
                color: busy ? "rgba(255,255,255,0.3)" : "#000",
                border: "none", borderRadius: 10,
                padding: "12px", fontSize: 13, fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}>
                {busy ? "Deploying…" : `Deploy to ${targetWorld?.label ?? "AgentVerse"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Wallet lookup panel ────────────────────────────────────────────────────────

function WalletLookup({ allAgents }) {
  const [wallet,  setWallet]  = useState("");
  const [checked, setChecked] = useState(false);

  const myAgents = useMemo(() => {
    if (!checked || !wallet.trim()) return [];
    const q = wallet.trim().toLowerCase();
    return allAgents.filter(a => a.owner_wallet?.toLowerCase() === q);
  }, [allAgents, wallet, checked]);

  const search = () => {
    if (wallet.trim()) setChecked(true);
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16, padding: "20px 24px",
      marginBottom: 36,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: checked ? 16 : 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#818cf8", fontSize: 14, flexShrink: 0,
        }}>⬡</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#f3f4f6", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
            Find your deployed agents
          </div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
            Enter a wallet address to see all agents you own across worlds
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={wallet}
            onChange={e => { setWallet(e.target.value); setChecked(false); }}
            onKeyDown={e => e.key === "Enter" && search()}
            placeholder="0x… wallet address"
            style={{
              background: "#1f2937", border: "1px solid #374151",
              borderRadius: 8, color: "#f3f4f6", padding: "7px 12px",
              fontSize: 12, width: 260, outline: "none",
              fontFamily: "system-ui, sans-serif",
            }}
          />
          <button onClick={search} style={{
            background: "#818cf8", border: "none",
            borderRadius: 8, color: "#fff",
            padding: "7px 16px", fontSize: 12,
            fontWeight: 700, cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
          }}>Look up</button>
        </div>
      </div>

      {checked && (
        myAgents.length === 0 ? (
          <div style={{
            color: "rgba(255,255,255,0.3)", fontSize: 12,
            padding: "12px 0 0", borderTop: "1px solid rgba(255,255,255,0.06)",
          }}>
            No agents found for this wallet. Deploy one using the button on any world card.
          </div>
        ) : (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginBottom: 10, fontWeight: 600 }}>
              {myAgents.length} agent{myAgents.length !== 1 ? "s" : ""} found
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myAgents.map(a => {
                const w = WORLD_BY_CAT[a.category] ?? { label: "Unknown", color: "#6b7280" };
                const active = a.status === "active";
                return (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: "#1f2937", border: "1px solid #374151",
                    borderRadius: 10, padding: "11px 14px",
                  }}>
                    {/* Status dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: active ? "#34d399" : "#6b7280",
                    }} />

                    {/* Name + world */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#f3f4f6", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                        {a.name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          background: `${w.color}18`, border: `1px solid ${w.color}35`,
                          color: w.color, fontSize: 9, fontWeight: 700,
                          padding: "1px 7px", borderRadius: 5, textTransform: "uppercase", letterSpacing: 0.6,
                        }}>{w.label}</span>
                        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
                          {a.category}
                        </span>
                      </div>
                    </div>

                    {/* Price */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ color: "#34d399", fontWeight: 700, fontSize: 12 }}>
                        ${a.price_per_request?.toFixed(4)}/call
                      </div>
                      <div style={{ color: active ? "#34d399" : "#6b7280", fontSize: 10 }}>
                        {active ? "active" : a.status ?? "unknown"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ── World card ─────────────────────────────────────────────────────────────────

function WorldCard({ lobby, agentCount, onEnter, onDeploy, size = "normal" }) {
  const [hov,        setHov]        = useState(false);
  const [deployHov,  setDeployHov]  = useState(false);
  const big = size === "large";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: lobby.gradient,
        borderRadius: 20,
        border: `1px solid ${hov ? lobby.color + "60" : lobby.color + "22"}`,
        padding: big ? "28px 24px" : "20px 20px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative", overflow: "hidden",
        boxShadow: hov
          ? `0 0 0 1px ${lobby.color}40, 0 20px 48px ${lobby.color}20`
          : "0 4px 16px rgba(0,0,0,0.3)",
        height: "100%",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 160, height: 160, borderRadius: "50%",
        background: `radial-gradient(circle, ${lobby.color}18 0%, transparent 70%)`,
        opacity: hov ? 1 : 0.4, transition: "opacity 0.2s ease",
        pointerEvents: "none",
      }} />

      {/* Symbol watermark */}
      <div style={{
        position: "absolute", bottom: -10, right: 16,
        fontSize: big ? 88 : 68, fontWeight: 900,
        color: lobby.color, opacity: 0.06, lineHeight: 1,
        pointerEvents: "none", userSelect: "none",
      }}>{lobby.symbol}</div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, position: "relative" }}>
        <div style={{
          width: big ? 46 : 40, height: big ? 46 : 40,
          borderRadius: 12, flexShrink: 0,
          background: hov ? `${lobby.color}30` : `${lobby.color}18`,
          border: `1px solid ${lobby.color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: big ? 20 : 16, color: lobby.color,
          transition: "background 0.2s",
        }}>{lobby.symbol}</div>

        <div style={{
          background: `${lobby.color}18`, border: `1px solid ${lobby.color}35`,
          borderRadius: 20, padding: "3px 9px",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: lobby.color, opacity: 0.9 }} />
          <span style={{ color: lobby.color, fontSize: 10, fontWeight: 700 }}>
            {agentCount} agent{agentCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Name + subtitle */}
      <div style={{ marginBottom: 8, position: "relative" }}>
        <div style={{
          color: "#f9fafb", fontWeight: 800,
          fontSize: big ? 20 : 16, lineHeight: 1.2, marginBottom: 3,
          letterSpacing: "-0.3px",
        }}>{lobby.label}</div>
        <div style={{ color: `${lobby.color}80`, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {lobby.subtitle}
        </div>
      </div>

      {/* Description */}
      <div style={{
        color: "rgba(255,255,255,0.4)", fontSize: 11, lineHeight: 1.6,
        marginBottom: 12, flex: 1, position: "relative",
      }}>
        {lobby.desc}
      </div>

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12, position: "relative" }}>
        {lobby.tags.map(t => (
          <span key={t} style={{
            background: `${lobby.color}12`, border: `1px solid ${lobby.color}28`,
            color: `${lobby.color}b0`, fontSize: 8, fontWeight: 700,
            padding: "2px 7px", borderRadius: 5, textTransform: "uppercase", letterSpacing: 0.6,
          }}>{t}</span>
        ))}
      </div>

      {/* Action row */}
      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        {/* Enter button */}
        <div
          onClick={() => onEnter(lobby)}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "9px 12px", borderRadius: 9,
            background: hov ? `${lobby.color}22` : `${lobby.color}10`,
            border: `1px solid ${lobby.color}30`,
            transition: "all 0.18s", cursor: "pointer",
          }}
        >
          <span style={{ color: lobby.color, fontSize: 11, fontWeight: 700 }}>Enter</span>
          <span style={{
            color: lobby.color, fontSize: 14,
            transform: hov ? "translateX(2px)" : "none",
            transition: "transform 0.15s",
          }}>→</span>
        </div>

        {/* Deploy button */}
        {lobby.id !== "all" && (
          <div
            onClick={e => { e.stopPropagation(); onDeploy(lobby); }}
            onMouseEnter={() => setDeployHov(true)}
            onMouseLeave={() => setDeployHov(false)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "9px 12px", borderRadius: 9,
              background: deployHov ? `${lobby.color}30` : `${lobby.color}12`,
              border: `1px solid ${lobby.color}40`,
              cursor: "pointer", transition: "all 0.15s",
              flexShrink: 0,
            }}
          >
            <span style={{ color: lobby.color, fontSize: 14, lineHeight: 1 }}>+</span>
            <span style={{ color: lobby.color, fontSize: 11, fontWeight: 700 }}>Deploy</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────────

function StatsBar({ agents }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API}/platform/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const items = [
    { label: "Agents",      value: agents.length || "—" },
    { label: "Total calls", value: stats?.total_requests ? stats.total_requests.toLocaleString() : "—" },
    { label: "Revenue",     value: stats?.total_revenue  ? `$${Number(stats.total_revenue).toFixed(2)}` : "—" },
    { label: "Developers",  value: stats?.developer_count ?? "—" },
  ];

  return (
    <div style={{
      display: "flex", gap: 0,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, overflow: "hidden",
      marginBottom: 32,
    }}>
      {items.map((item, i) => (
        <div key={item.label} style={{
          flex: 1, padding: "14px 20px",
          borderRight: i < items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
          textAlign: "center",
        }}>
          <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px" }}>
            {item.value}
          </div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.7 }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function LobbySelect({ onEnter }) {
  const [agents,      setAgents]      = useState([]);
  const [deployLobby, setDeployLobby] = useState(null); // lobby being deployed to

  const load = () => fetch(`${API}/agents`).then(r => r.json()).then(setAgents).catch(() => {});

  useEffect(() => { load(); }, []);

  const countFor = (lobby) => {
    if (!lobby.categories) return agents.length;
    return agents.filter(a => lobby.categories.includes(a.category)).length;
  };

  return (
    <div style={{
      height: "100%", overflowY: "auto",
      background: "#0a0a0f",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 3px; }
      `}</style>

      {deployLobby && (
        <DeployModal
          lobby={deployLobby}
          onClose={() => setDeployLobby(null)}
          onDeployed={() => { load(); }}
        />
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.2)",
            borderRadius: 20, padding: "4px 14px", marginBottom: 16,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8" }} />
            <span style={{ color: "#818cf8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
              AgentVerse Worlds
            </span>
          </div>

          <h1 style={{
            color: "#f9fafb", fontSize: 34, fontWeight: 800,
            letterSpacing: "-0.8px", lineHeight: 1.1, margin: "0 0 12px",
          }}>
            Choose your world
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, lineHeight: 1.65, margin: 0, maxWidth: 500 }}>
            Each world hosts agents from a specific domain. Enter to explore, or hit{" "}
            <span style={{ color: "#818cf8", fontWeight: 600 }}>Deploy</span> to add your own agent directly.
          </p>
        </div>

        {/* Stats */}
        <StatsBar agents={agents} />

        {/* Wallet lookup */}
        <WalletLookup allAgents={agents} />

        {/* World grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
        }}>
          {LOBBIES.map((lobby, i) => (
            <WorldCard
              key={lobby.id}
              lobby={lobby}
              agentCount={countFor(lobby)}
              onEnter={onEnter}
              onDeploy={setDeployLobby}
              size={i === 0 ? "large" : "normal"}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 40, textAlign: "center",
          color: "rgba(255,255,255,0.18)", fontSize: 12,
        }}>
          Build multi-agent pipelines in{" "}
          <a href="/build" style={{ color: "rgba(129,140,248,0.55)", textDecoration: "none", fontWeight: 600 }}>
            Pipeline Builder
          </a>
          {" "}· deploy them to Tomorrowland as composite agents
        </div>
      </div>
    </div>
  );
}
