"use client";

import { useEffect, useState } from "react";
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
    color: "#ff2d78",
    gradient: "linear-gradient(135deg, #1a0008 0%, #2d0015 60%, #3d0020 100%)",
    symbol: "◈",
    desc: "Trading signals, momentum analysis, and risk management agents. Get BUY/SELL/HOLD calls with real-time data.",
    tags: ["Trading", "Risk", "Signals"],
    theme: LOBBY_THEMES.trading,
  },
  {
    id: "data",
    label: "Matrix",
    subtitle: "Data feeds & pipelines",
    categories: ["data"],
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
    color: "#7ec87e",
    gradient: "linear-gradient(135deg, #0a1a0a 0%, #101e10 60%, #162216 100%)",
    symbol: "◎",
    desc: "Sentiment analysis, trend detection, and market pattern recognition agents. Turn raw data into real insight.",
    tags: ["Sentiment", "Trends", "Patterns"],
    theme: LOBBY_THEMES.analysis,
  },
  {
    id: "defi",
    label: "Tomorrowland",
    subtitle: "Composite pipelines",
    categories: ["composite"],
    color: "#c084fc",
    gradient: "linear-gradient(135deg, #0a0018 0%, #130025 60%, #1a0030 100%)",
    symbol: "⊕",
    desc: "Multi-agent pipelines deployed as a single callable agent. Built in Pipeline Builder, available here as one API call.",
    tags: ["Pipelines", "Composite", "Multi-agent"],
    theme: LOBBY_THEMES.defi,
  },
  {
    id: "experimental",
    label: "Burning Man",
    subtitle: "Experimental builds",
    categories: ["experimental"],
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
    color: "#d4a820",
    gradient: "linear-gradient(135deg, #110d02 0%, #1a1203 60%, #241804 100%)",
    symbol: "⬡",
    desc: "The full AgentVerse — every agent from every world, in one place. Good for exploration and running pipelines across categories.",
    tags: ["All Agents", "Full Access", "Cross-world"],
    theme: LOBBY_THEMES.all,
  },
];

// ── World card ─────────────────────────────────────────────────────────────────

function WorldCard({ lobby, agentCount, onEnter, size = "normal" }) {
  const [hov, setHov] = useState(false);
  const big = size === "large";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onEnter(lobby)}
      style={{
        background: lobby.gradient,
        borderRadius: 20,
        border: `1px solid ${hov ? lobby.color + "60" : lobby.color + "22"}`,
        padding: big ? "32px 28px" : "22px 22px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative", overflow: "hidden",
        boxShadow: hov
          ? `0 0 0 1px ${lobby.color}40, 0 20px 48px ${lobby.color}20`
          : `0 4px 16px rgba(0,0,0,0.3)`,
        height: "100%",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 160, height: 160, borderRadius: "50%",
        background: `radial-gradient(circle, ${lobby.color}18 0%, transparent 70%)`,
        opacity: hov ? 1 : 0.4,
        transition: "opacity 0.2s ease",
        pointerEvents: "none",
      }} />

      {/* Symbol watermark */}
      <div style={{
        position: "absolute", bottom: -10, right: 16,
        fontSize: big ? 96 : 72, fontWeight: 900,
        color: lobby.color, opacity: 0.06, lineHeight: 1,
        pointerEvents: "none", userSelect: "none",
        transition: "opacity 0.2s ease",
      }}>{lobby.symbol}</div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, position: "relative" }}>
        <div style={{
          width: big ? 50 : 42, height: big ? 50 : 42,
          borderRadius: 13, flexShrink: 0,
          background: `${lobby.color}20`, border: `1px solid ${lobby.color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: big ? 22 : 18, color: lobby.color,
          transition: "background 0.2s",
          ...(hov ? { background: `${lobby.color}35` } : {}),
        }}>{lobby.symbol}</div>

        {/* Agent count badge */}
        <div style={{
          background: `${lobby.color}18`, border: `1px solid ${lobby.color}35`,
          borderRadius: 20, padding: "4px 10px",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: lobby.color, opacity: 0.9 }} />
          <span style={{ color: lobby.color, fontSize: 11, fontWeight: 700 }}>
            {agentCount} agent{agentCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Name + subtitle */}
      <div style={{ marginBottom: 10, position: "relative" }}>
        <div style={{
          color: "#f9fafb", fontWeight: 800,
          fontSize: big ? 22 : 17, lineHeight: 1.2, marginBottom: 4,
          letterSpacing: "-0.3px",
        }}>{lobby.label}</div>
        <div style={{ color: `${lobby.color}90`, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {lobby.subtitle}
        </div>
      </div>

      {/* Description */}
      <div style={{
        color: "rgba(255,255,255,0.42)", fontSize: 12, lineHeight: 1.6,
        marginBottom: 16, flex: 1, position: "relative",
      }}>
        {lobby.desc}
      </div>

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16, position: "relative" }}>
        {lobby.tags.map(t => (
          <span key={t} style={{
            background: `${lobby.color}12`, border: `1px solid ${lobby.color}30`,
            color: `${lobby.color}cc`, fontSize: 9, fontWeight: 700,
            padding: "3px 8px", borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.6,
          }}>{t}</span>
        ))}
      </div>

      {/* Enter CTA */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderRadius: 10,
        background: hov ? `${lobby.color}22` : `${lobby.color}10`,
        border: `1px solid ${lobby.color}30`,
        transition: "all 0.18s",
        position: "relative",
      }}>
        <span style={{ color: lobby.color, fontSize: 12, fontWeight: 700 }}>
          Enter {lobby.label}
        </span>
        <span style={{
          color: lobby.color, fontSize: 16,
          transform: hov ? "translateX(3px)" : "none",
          transition: "transform 0.15s",
        }}>→</span>
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
    { label: "Agents",        value: agents.length || "—" },
    { label: "Total calls",   value: stats?.total_requests ? stats.total_requests.toLocaleString() : "—" },
    { label: "Revenue",       value: stats?.total_revenue  ? `$${Number(stats.total_revenue).toFixed(2)}` : "—" },
    { label: "Developers",    value: stats?.developer_count ?? "—" },
  ];

  return (
    <div style={{
      display: "flex", gap: 0,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, overflow: "hidden",
      marginBottom: 36,
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
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.7 }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function LobbySelect({ onEnter }) {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    fetch(`${API}/agents`).then(r => r.json()).then(setAgents).catch(() => {});
  }, []);

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

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
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
            color: "#f9fafb", fontSize: 36, fontWeight: 800,
            letterSpacing: "-0.8px", lineHeight: 1.1, margin: "0 0 12px",
          }}>
            Choose your world
          </h1>
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, lineHeight: 1.65, margin: 0, maxWidth: 520 }}>
            Each world hosts agents from a specific domain. Click any agent to see what it does and run it live.
            Deploy from the <span style={{ color: "#818cf8", fontWeight: 600 }}>Developer</span> tab — it appears in the matching world automatically.
          </p>
        </div>

        {/* Stats */}
        <StatsBar agents={agents} />

        {/* World grid — 3 + 3 layout */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}>
          {LOBBIES.map((lobby, i) => (
            <WorldCard
              key={lobby.id}
              lobby={lobby}
              agentCount={countFor(lobby)}
              onEnter={onEnter}
              size={i === 0 ? "large" : "normal"}
            />
          ))}
        </div>

        {/* Footer tip */}
        <div style={{
          marginTop: 40, textAlign: "center",
          color: "rgba(255,255,255,0.18)", fontSize: 12,
        }}>
          Build multi-agent pipelines in{" "}
          <a href="/build" style={{ color: "rgba(129,140,248,0.6)", textDecoration: "none", fontWeight: 600 }}>
            Pipeline Builder
          </a>
          {" "}and deploy them to Tomorrowland as composite agents
        </div>
      </div>
    </div>
  );
}
