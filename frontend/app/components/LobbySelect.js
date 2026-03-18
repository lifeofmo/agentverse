"use client";

import { useEffect, useState } from "react";

import { API } from "@/app/lib/config";

// Each lobby carries a theme object that drives AgentCity's visual preset
export const LOBBY_THEMES = {
  trading: {
    sky:         "#0B1E3D",
    fog:         "#0B1E3D",
    floorLight:  "#1C2E4A",
    floorDark:   "#152338",
    ambient:     "#2060A0",
    ambientInt:  0.9,
    sun:         "#4DA6FF",
    sunInt:      1.2,
    fill:        "#102050",
    fillInt:     0.5,
    hemiSky:     "#1a3060",
    hemiGround:  "#0a1020",
    bgStyle:     "linear-gradient(180deg, #0B1E3D 0%, #152338 100%)",
  },
  analysis: {
    sky:         "#E8F4FF",
    fog:         "#D0E8FF",
    floorLight:  "#F0F6FF",
    floorDark:   "#D8EAFF",
    ambient:     "#FFFFFF",
    ambientInt:  2.4,
    sun:         "#FFFFFF",
    sunInt:      2.0,
    fill:        "#B0D0F0",
    fillInt:     0.8,
    hemiSky:     "#D0E8FF",
    hemiGround:  "#E8F4FF",
    bgStyle:     "linear-gradient(180deg, #D0E8FF 0%, #E8F4FF 100%)",
  },
  data: {
    sky:         "#041B2E",
    fog:         "#041B2E",
    floorLight:  "#0A2A3E",
    floorDark:   "#061822",
    ambient:     "#00CCFF",
    ambientInt:  0.7,
    sun:         "#00EEFF",
    sunInt:      1.0,
    fill:        "#003050",
    fillInt:     0.6,
    hemiSky:     "#004466",
    hemiGround:  "#001122",
    bgStyle:     "linear-gradient(180deg, #041B2E 0%, #061822 100%)",
  },
  defi: {
    sky:         "#1A1200",
    fog:         "#1A1200",
    floorLight:  "#2A1E00",
    floorDark:   "#1A1200",
    ambient:     "#FFD700",
    ambientInt:  0.8,
    sun:         "#FFD060",
    sunInt:      1.1,
    fill:        "#5a3a00",
    fillInt:     0.5,
    hemiSky:     "#3a2800",
    hemiGround:  "#0a0800",
    bgStyle:     "linear-gradient(180deg, #1A1200 0%, #0a0800 100%)",
  },
  experimental: {
    sky:         "#0D1A0D",
    fog:         "#0D1A0D",
    floorLight:  "#1A2E1A",
    floorDark:   "#0D1A0D",
    ambient:     "#66FF66",
    ambientInt:  0.7,
    sun:         "#80FF80",
    sunInt:      0.9,
    fill:        "#003300",
    fillInt:     0.5,
    hemiSky:     "#1a3a1a",
    hemiGround:  "#050d05",
    bgStyle:     "linear-gradient(180deg, #0D1A0D 0%, #050d05 100%)",
  },
  all: {
    sky:         "#8ED6FF",
    fog:         "#8ED6FF",
    floorLight:  "#F4E7D0",
    floorDark:   "#EAD9BE",
    ambient:     "#ffffff",
    ambientInt:  2.2,
    sun:         "#fffcf0",
    sunInt:      1.8,
    fill:        "#DCEBFF",
    fillInt:     0.75,
    hemiSky:     "#8ED6FF",
    hemiGround:  "#c8e6c9",
    bgStyle:     "linear-gradient(180deg, #cfe9ff 0%, #f4e7d0 100%)",
  },
};

export const LOBBIES = [
  {
    id: "trading",
    label: "Trading World",
    categories: ["trading", "risk"],
    color: "#58D68D",
    dark: "#1a5c34",
    letter: "T",
    desc: "Market trading, risk management & signal agents",
    theme: LOBBY_THEMES.trading,
  },
  {
    id: "analysis",
    label: "Analysis World",
    categories: ["analysis"],
    color: "#44cc44",
    dark: "#1a4a1a",
    letter: "A",
    desc: "Sentiment analysis, forecasting & research agents. Use these to interpret market data and generate insights.",
    theme: LOBBY_THEMES.analysis,
  },
  {
    id: "data",
    label: "Data World",
    categories: ["data"],
    color: "#00FF41",
    dark: "#001a00",
    letter: "D",
    desc: "Data feeds, pipelines & infrastructure agents. Fetch, transform, and route data between systems.",
    theme: LOBBY_THEMES.data,
  },
  {
    id: "defi",
    label: "Tomorrowland",
    categories: ["composite"],
    color: "#F7DC6F",
    dark: "#5c4800",
    letter: "C",
    desc: "Composite pipelines — multi-agent chains registered as a single callable agent. Built in the Pipeline Builder.",
    theme: LOBBY_THEMES.defi,
  },
  {
    id: "experimental",
    label: "Burning Man",
    categories: ["experimental"],
    color: "#FF6B35",
    dark: "#5c1a14",
    letter: "X",
    desc: "Experimental agents being tested and prototyped. Early-stage, creative, or uncategorized builds live here.",
    theme: LOBBY_THEMES.experimental,
  },
  {
    id: "all",
    label: "All Worlds",
    categories: null,
    color: "#4a9fd4",
    dark: "#1a3a60",
    letter: "∞",
    desc: "The full AgentVerse plaza — every deployed agent",
    theme: LOBBY_THEMES.all,
  },
];

function LobbyCard({ lobby, agentCount, onEnter }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onEnter(lobby)}
      style={{
        background: hovered ? `${lobby.color}14` : "#fff",
        border: `2px solid ${hovered ? lobby.color : "#e6d6bd"}`,
        borderRadius: 18,
        padding: "22px 24px",
        cursor: "pointer",
        transition: "all 0.18s",
        boxShadow: hovered
          ? `0 8px 32px ${lobby.color}30, 0 0 0 1px ${lobby.color}40`
          : "0 2px 12px rgba(0,0,0,0.06)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow orb */}
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 90, height: 90, borderRadius: "50%",
        background: `${lobby.color}20`,
        transition: "opacity 0.18s",
        opacity: hovered ? 1 : 0,
        pointerEvents: "none",
      }} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: hovered ? lobby.color : `${lobby.color}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: hovered ? "#fff" : lobby.color,
          fontSize: 20, fontWeight: 800,
          transition: "all 0.18s", flexShrink: 0,
        }}>{lobby.letter}</div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 800, fontSize: 15, color: "#2d3a4a", lineHeight: 1.2,
          }}>{lobby.label}</div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4,
            background: `${lobby.color}18`, borderRadius: 6,
            padding: "2px 8px",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: lobby.color }} />
            <span style={{ color: lobby.color, fontSize: 11, fontWeight: 700 }}>
              {agentCount} agent{agentCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div style={{ color: "#9aabb8", fontSize: 12, lineHeight: 1.55, marginBottom: 14 }}>
        {lobby.desc}
      </div>

      {/* Enter button */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px",
        background: hovered ? lobby.color : "#f8f6f2",
        borderRadius: 10,
        transition: "all 0.18s",
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: hovered ? "#fff" : lobby.color,
          transition: "color 0.18s",
        }}>Enter World</span>
        <span style={{
          fontSize: 16, color: hovered ? "#fff" : lobby.color,
          transition: "color 0.18s",
        }}>→</span>
      </div>
    </div>
  );
}

export default function LobbySelect({ onEnter }) {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    fetch(`${API}/agents`).then(r => r.json()).then(setAgents).catch(() => {});
  }, []);

  const countFor = (lobby) => {
    if (!lobby.categories) return agents.length;
    return agents.filter(a => lobby.categories.includes(a.category)).length;
  };

  const totalAgents = agents.length;

  return (
    <div style={{
      height: "100%", overflowY: "auto",
      background: "linear-gradient(180deg, #cfe9ff 0%, #f4e7d0 18%, #f4e7d0 100%)",
      padding: "40px",
      fontFamily: "inherit",
    }}>

      {/* Header */}
      <div style={{ maxWidth: 720, margin: "0 auto 40px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 14, marginBottom: 8,
        }}>
          {/* Globe icon */}
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #4a9fd4, #6BCF8B)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
            boxShadow: "0 4px 16px rgba(74,159,212,0.3)",
          }}>⬡</div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2d3a4a", letterSpacing: "-0.4px" }}>
              Choose Your World
            </div>
            <div style={{ color: "#9aabb8", fontSize: 13, marginTop: 3 }}>
              {totalAgents} agents deployed across AgentVerse
            </div>
          </div>
        </div>

        <p style={{ color: "#6b7d92", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
          Each world hosts agents from one domain. Click any agent inside to see what it does and run it live.
          Deploy your own agent from the <strong style={{ color: "#4a9fd4" }}>Developer tab</strong> — it will appear in the matching world automatically.
        </p>
      </div>

      {/* Lobby grid */}
      <div style={{
        maxWidth: 720, margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 16,
      }}>
        {LOBBIES.map(lobby => (
          <LobbyCard
            key={lobby.id}
            lobby={lobby}
            agentCount={countFor(lobby)}
            onEnter={onEnter}
          />
        ))}
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
