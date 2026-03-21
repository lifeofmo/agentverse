"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Playground from "./components/Playground";
import ChallengesView from "./components/ChallengesView";
import MarketplaceView from "./components/MarketplaceView";
import DeveloperView from "./components/DeveloperView";
import LobbySelect, { LOBBIES } from "./components/LobbySelect";
import WorldOverlay from "./components/WorldOverlay";
import ErrorBoundary from "./components/ErrorBoundary";

const ExperimentalWorld = dynamic(() => import("./components/ExperimentalWorld"), { ssr: false });
const MatrixWorld       = dynamic(() => import("./components/MatrixWorld"),       { ssr: false });
const SimsWorld         = dynamic(() => import("./components/SimsWorld"),         { ssr: false });
const TomorrowlandWorld = dynamic(() => import("./components/TomorrowlandWorld"), { ssr: false });
const LasVegasWorld     = dynamic(() => import("./components/LasVegasWorld"),     { ssr: false });
const HogwartsWorld     = dynamic(() => import("./components/HogwartsWorld"),     { ssr: false });
const AgentCity         = dynamic(() => import("./components/AgentCity"),         { ssr: false });

import { useAuth } from "@/app/lib/useAuth";

// ── Splash ─────────────────────────────────────────────────────────────────────

const WORLDS_CYCLE = [
  { name: "Las Vegas",    color: "#ff2d78", bg: "#0d0005", sub: "High-stakes trading agents" },
  { name: "Matrix",       color: "#00FF41", bg: "#010d01", sub: "Data feeds in a digital grid" },
  { name: "Tomorrowland", color: "#c084fc", bg: "#0a0018", sub: "Composite pipelines at festival scale" },
  { name: "Sims",         color: "#7ec87e", bg: "#1a2e10", sub: "Analysis agents with real neighborhoods" },
  { name: "Burning Man",  color: "#FF6B35", bg: "#180800", sub: "Experimental builds on the playa" },
  { name: "Hogwarts",     color: "#d4a820", bg: "#110d02", sub: "All agents, one campus" },
];

function SplashScreen({ onEnter }) {
  const [idx, setIdx]         = useState(0);
  const [fade, setFade]       = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx(i => (i + 1) % WORLDS_CYCLE.length); setFade(true); }, 280);
    }, 2800);
    return () => clearInterval(iv);
  }, []);

  const w = WORLDS_CYCLE[idx];
  const enter = () => { setExiting(true); setTimeout(onEnter, 420); };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: w.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "32px 24px",
      opacity: exiting ? 0 : 1,
      transition: "background 0.7s ease, opacity 0.42s ease",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes spUp { from { opacity:0; transform:translateY(12px);} to { opacity:1; transform:translateY(0);} }
        .sp-in { animation: spUp 0.7s ease forwards; opacity:0; }
        @keyframes pulse { 0%,100% { transform:scale(1);} 50% { transform:scale(1.04);} }
      `}</style>

      {/* Giant ghost watermark */}
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        pointerEvents: "none", userSelect: "none",
        opacity: fade ? 0.055 : 0, transition: "opacity 0.28s ease",
      }}>
        <span style={{
          fontSize: "clamp(70px, 20vw, 220px)", fontWeight: 900,
          color: w.color, letterSpacing: "-4px", lineHeight: 1, whiteSpace: "nowrap",
        }}>{w.name}</span>
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 540 }}>
        {/* Wordmark */}
        <div className="sp-in" style={{ animationDelay: "0s", marginBottom: 52 }}>
          <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 300, fontSize: 17, letterSpacing: "0.3px", fontFamily: "system-ui, -apple-system, sans-serif" }}>Agent</span>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: "0.3px", fontFamily: "system-ui, -apple-system, sans-serif" }}>Verse</span>
        </div>

        {/* Cycling world */}
        <div style={{
          marginBottom: 18,
          opacity: fade ? 1 : 0, transform: fade ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 0.28s ease, transform 0.28s ease",
        }}>
          <div style={{
            fontSize: "clamp(38px, 8vw, 78px)", fontWeight: 900,
            letterSpacing: "-2px", lineHeight: 1, color: w.color,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}>{w.name}</div>
          <div style={{ color: w.color + "70", fontSize: 14, marginTop: 10, fontWeight: 400, fontFamily: "system-ui, sans-serif" }}>
            {w.sub}
          </div>
        </div>

        {/* Dots */}
        <div className="sp-in" style={{ animationDelay: "0.25s", marginTop: 30, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {WORLDS_CYCLE.map((_, i) => (
              <div key={i} style={{
                width: i === idx ? 22 : 6, height: 6, borderRadius: 3,
                background: i === idx ? w.color : "rgba(255,255,255,0.2)",
                transition: "all 0.3s ease",
              }} />
            ))}
          </div>
        </div>

        {/* Tagline */}
        <div className="sp-in" style={{ animationDelay: "0.35s", marginBottom: 32 }}>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.65, fontFamily: "system-ui, sans-serif" }}>
            Deploy an agent. Watch it inhabit a world. Earn per API call.
          </p>
        </div>

        {/* CTA */}
        <div className="sp-in" style={{ animationDelay: "0.45s" }}>
          <button onClick={enter} style={{
            padding: "13px 42px", borderRadius: 12,
            border: `1.5px solid ${w.color}`,
            background: "transparent", color: w.color,
            fontSize: 14, fontWeight: 700,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
            transition: "background 0.15s, color 0.15s",
            marginBottom: 14,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = w.color; e.currentTarget.style.color = "#000"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = w.color; }}
          >
            Enter AgentVerse
          </button>
          <div style={{ color: "rgba(255,255,255,0.22)", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>
            Free to deploy · Pay per call · Open to all
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Nav config ─────────────────────────────────────────────────────────────────

const NAV = [
  { id: "playground",  label: "Playground",  icon: "◈" },
  { id: "city",        label: "Worlds",       icon: "⬡" },
  { id: "marketplace", label: "Store",        icon: "◉" },
  { id: "challenges",  label: "Challenges",   icon: "◆" },
  { id: "developer",   label: "Developer",    icon: "⚙" },
];

// ── Credits HUD ────────────────────────────────────────────────────────────────

function CreditsHUD() {
  const { walletBalance: balance } = useAuth({ fetchWallet: true });

  if (balance === null) return null;

  const credits = Math.round(balance * 100);
  const color   = credits < 500 ? "#f87171" : credits < 2000 ? "#fbbf24" : "#34d399";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: `${color}12`, border: `1px solid ${color}35`,
      borderRadius: 8, padding: "5px 12px",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 500 }}>Credits</span>
      <span style={{ color, fontSize: 12, fontWeight: 800 }}>{credits.toLocaleString()}</span>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab,         setTab]         = useState("playground");
  const [activeLobby, setActiveLobby] = useState(null);
  const [showSplash,  setShowSplash]  = useState(false);

  useEffect(() => {
    if (localStorage.getItem("av_entered") !== "v4") setShowSplash(true);
  }, []);

  const handleEnter = () => {
    localStorage.setItem("av_entered", "v4");
    setShowSplash(false);
  };

  const handleTabChange = (id) => {
    if (id !== "city") setActiveLobby(null);
    setTab(id);
  };

  const inCity = tab === "city" && activeLobby !== null;

  return (
    <>
      {showSplash && <SplashScreen onEnter={handleEnter} />}
      <div style={{
        display: "flex", flexDirection: "column", height: "100vh",
        background: "#0a0a0f", overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        <style>{`
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: #0a0a0f; }
          ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 3px; }
          .nav-tab { transition: all 0.15s; }
          .nav-tab:hover { background: rgba(255,255,255,0.05) !important; }
        `}</style>

        {/* ── Top nav ───────────────────────────────────────────────────────── */}
        <nav style={{
          display: "flex", alignItems: "center",
          padding: "0 20px", height: 56, flexShrink: 0,
          background: "rgba(10,10,15,0.95)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(16px)",
          zIndex: 100,
        }}>
          {/* Logo */}
          <div style={{
            display: "flex", alignItems: "center", gap: 0,
            marginRight: 28, cursor: "default", userSelect: "none",
          }}>
            <span style={{
              background: "linear-gradient(135deg, #818cf8, #34d399)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px",
            }}>AgentVerse</span>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2 }}>
            {NAV.map(n => {
              const active = tab === n.id;
              return (
                <button
                  key={n.id}
                  className="nav-tab"
                  onClick={() => handleTabChange(n.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 8, border: "none",
                    cursor: "pointer", fontSize: 13, fontWeight: 600,
                    background: active ? "rgba(255,255,255,0.08)" : "transparent",
                    color: active ? "#f1f5f9" : "rgba(255,255,255,0.38)",
                    position: "relative",
                  }}
                >
                  <span style={{
                    fontSize: 11,
                    color: active ? "#818cf8" : "rgba(255,255,255,0.25)",
                  }}>{n.icon}</span>
                  {n.label}
                  {active && (
                    <div style={{
                      position: "absolute", bottom: 0, left: "50%",
                      transform: "translateX(-50%)",
                      width: 20, height: 2, borderRadius: 1,
                      background: "linear-gradient(90deg, #818cf8, #34d399)",
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* World breadcrumb */}
          {inCity && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>›</span>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: `${activeLobby.color}18`,
                border: `1px solid ${activeLobby.color}40`,
                borderRadius: 8, padding: "4px 10px",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: activeLobby.color }} />
                <span style={{ color: activeLobby.color, fontSize: 12, fontWeight: 700 }}>
                  {activeLobby.label}
                </span>
              </div>
              <button onClick={() => setActiveLobby(null)} style={{
                background: "transparent", border: "none",
                color: "rgba(255,255,255,0.3)", fontSize: 12,
                cursor: "pointer", padding: "3px 8px",
                borderRadius: 6, fontWeight: 500,
                fontFamily: "inherit",
              }}>← Worlds</button>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Credits */}
          <CreditsHUD />

          {/* Build CTA */}
          <a href="/build" style={{
            display: "flex", alignItems: "center", gap: 6,
            color: "#818cf8", fontSize: 12, fontWeight: 700,
            textDecoration: "none", padding: "6px 14px",
            background: "rgba(129,140,248,0.1)",
            border: "1px solid rgba(129,140,248,0.25)",
            borderRadius: 8, marginLeft: 10,
            transition: "all 0.15s",
            fontFamily: "inherit",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(129,140,248,0.18)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(129,140,248,0.1)"; }}
          >
            <span style={{ fontSize: 11 }}>+</span>
            Build
          </a>
        </nav>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <ErrorBoundary key={`${tab}-${activeLobby?.id}`}>
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {tab === "playground"  && <Playground />}
            {tab === "city" && activeLobby === null && (
              <LobbySelect onEnter={setActiveLobby} />
            )}
            {tab === "city" && activeLobby !== null && !["experimental","data","analysis","defi","trading","all"].includes(activeLobby.id) && (
              <AgentCity
                key={activeLobby.id}
                lobbyId={activeLobby.id}
                lobbyCategories={activeLobby.categories}
                lobbyLabel={activeLobby.label}
                lobbyColor={activeLobby.color}
                theme={activeLobby.theme}
              />
            )}
            {tab === "city" && activeLobby?.id === "experimental" && <ExperimentalWorld key="experimental" />}
            {tab === "city" && activeLobby?.id === "data"         && <MatrixWorld       key="data" />}
            {tab === "city" && activeLobby?.id === "analysis"     && <SimsWorld         key="analysis" />}
            {tab === "city" && activeLobby?.id === "defi"         && <TomorrowlandWorld key="defi" />}
            {tab === "city" && activeLobby?.id === "trading"      && <LasVegasWorld     key="trading" />}
            {tab === "city" && activeLobby?.id === "all"          && <HogwartsWorld     key="all" />}
            {tab === "city" && activeLobby !== null && (
              <WorldOverlay
                worldId={activeLobby.id}
                onWorldSwitch={(id) => {
                  const lobby = LOBBIES.find(l => l.id === id);
                  if (lobby) setActiveLobby(lobby);
                }}
              />
            )}
            {tab === "challenges"  && <ChallengesView />}
            {tab === "marketplace" && <MarketplaceView />}
            {tab === "developer"   && <DeveloperView />}
          </div>
        </ErrorBoundary>
      </div>
    </>
  );
}
