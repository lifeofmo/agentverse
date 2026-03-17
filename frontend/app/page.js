"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Playground from "./components/Playground";
import ChallengesView from "./components/ChallengesView";
import MarketplaceView from "./components/MarketplaceView";
import DeveloperView from "./components/DeveloperView";
import LobbySelect from "./components/LobbySelect";
import ErrorBoundary from "./components/ErrorBoundary";
import { WalletProvider } from "./components/WalletProvider";
import WalletButton from "./components/WalletButton";

const ExperimentalWorld = dynamic(() => import("./components/ExperimentalWorld"), { ssr: false });
const MatrixWorld       = dynamic(() => import("./components/MatrixWorld"),       { ssr: false });
const SimsWorld         = dynamic(() => import("./components/SimsWorld"),         { ssr: false });
const TomorrowlandWorld = dynamic(() => import("./components/TomorrowlandWorld"), { ssr: false });
const LasVegasWorld     = dynamic(() => import("./components/LasVegasWorld"),     { ssr: false });
const HogwartsWorld     = dynamic(() => import("./components/HogwartsWorld"),     { ssr: false });

import { API } from "@/app/lib/config";

// ── Splash screen ─────────────────────────────────────────────────────────────
const WORLDS_CYCLE = [
  { name: "Matrix",       bg: "#010d01", color: "#00FF41", sub: "Data agents in a digital grid"        },
  { name: "Hogwarts",     bg: "#110d02", color: "#d4a820", sub: "Wizards casting spells on data"       },
  { name: "Tomorrowland", bg: "#0a0018", color: "#c084fc", sub: "Festival of signals and beats"        },
  { name: "Sims",         bg: "#1a2e10", color: "#7ec87e", sub: "Agents with homes, jobs and neighbors"},
  { name: "Las Vegas",    bg: "#0d0005", color: "#ff2d78", sub: "High-stakes trading agents on the strip" },
  { name: "Burning Man",  bg: "#180800", color: "#FF6B35", sub: "Art installations on the playa"       },
];

function SplashScreen({ onEnter }) {
  const [idx, setIdx]       = useState(0);
  const [fade, setFade]     = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % WORLDS_CYCLE.length);
        setFade(true);
      }, 300);
    }, 2600);
    return () => clearInterval(iv);
  }, []);

  const world = WORLDS_CYCLE[idx];

  const handleEnter = () => {
    setExiting(true);
    setTimeout(onEnter, 450);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: world.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "32px 24px",
      opacity: exiting ? 0 : 1,
      transition: "background 0.6s ease, opacity 0.45s ease",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes spFadeUp { from { opacity:0; transform:translateY(14px);} to { opacity:1; transform:translateY(0);} }
        .sp-ui { animation: spFadeUp 0.6s ease forwards; opacity: 0; }
        .sp-btn:hover  { opacity: 0.8; }
        .sp-btn:active { transform: scale(0.97); }
      `}</style>

      {/* Giant world name — full bleed background text */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none", userSelect: "none",
        opacity: fade ? 0.07 : 0,
        transition: "opacity 0.3s ease",
      }}>
        <span style={{
          fontSize: "clamp(80px, 18vw, 200px)",
          fontWeight: 900, letterSpacing: "-4px",
          color: world.color,
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}>{world.name}</span>
      </div>

      {/* Foreground content */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 560 }}>

        {/* Wordmark */}
        <div className="sp-ui" style={{ animationDelay: "0s", marginBottom: 48 }}>
          <span style={{ color: "#ffffff60", fontWeight: 300, fontSize: 18 }}>Agent</span>
          <span style={{ color: "#fff",      fontWeight: 800, fontSize: 18 }}>Verse</span>
        </div>

        {/* Cycling world name */}
        <div style={{
          marginBottom: 16,
          opacity: fade ? 1 : 0,
          transform: fade ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}>
          <div style={{
            fontSize: "clamp(36px, 7vw, 72px)",
            fontWeight: 900, letterSpacing: "-2px", lineHeight: 1,
            color: world.color,
          }}>{world.name}</div>
          <div style={{ color: world.color + "80", fontSize: 14, marginTop: 8, fontWeight: 400 }}>
            {world.sub}
          </div>
        </div>

        {/* Static headline */}
        <div className="sp-ui" style={{ animationDelay: "0.2s", marginTop: 40, marginBottom: 10 }}>
          <p style={{ margin: 0, color: "#ffffff90", fontSize: 15, lineHeight: 1.6 }}>
            Deploy an agent. Watch it inhabit a world. Earn per API call.
          </p>
        </div>

        {/* Dots */}
        <div className="sp-ui" style={{ animationDelay: "0.3s", marginBottom: 36 }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 20 }}>
            {WORLDS_CYCLE.map((_, i) => (
              <div key={i} style={{
                width: i === idx ? 20 : 6, height: 6,
                borderRadius: 3,
                background: i === idx ? world.color : "#ffffff30",
                transition: "all 0.3s ease",
              }} />
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="sp-ui" style={{ animationDelay: "0.4s" }}>
          <button className="sp-btn" onClick={handleEnter} style={{
            padding: "13px 38px", borderRadius: 10, border: `1.5px solid ${world.color}`,
            background: "transparent", color: world.color,
            fontSize: 14, fontWeight: 700,
            cursor: "pointer", transition: "opacity 0.15s",
            marginBottom: 14,
          }}>
            Enter AgentVerse
          </button>
          <div style={{ color: "#ffffff30", fontSize: 12 }}>
            Free to deploy · Pay per call · Open to all developers
          </div>
        </div>
      </div>
    </div>
  );
}

// Three.js cannot SSR
const AgentCity = dynamic(() => import("./components/AgentCity"), { ssr: false });

const NAV = [
  { id: "playground",  label: "Playground" },
  { id: "city",        label: "Agent City",  accent: "#6BCF8B" },
  { id: "challenges",  label: "Challenges"  },
  { id: "marketplace", label: "Marketplace" },
  { id: "developer",   label: "Developer",   accent: "#4a9fd4" },
];

function WalletHUD() {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    const load = () =>
      fetch(`${API}/wallets/demo`)
        .then((r) => r.json())
        .then((w) => setBalance(w.balance))
        .catch(() => {});
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, []);

  if (balance === null) return null;

  // 1 credit = $0.01  (so $100 demo balance = 10,000 credits)
  const credits = Math.round(balance * 100);
  const color   = credits < 500 ? "#E67B7B" : credits < 2000 ? "#E6C36B" : "#6BCF8B";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: `${color}14`, border: `1px solid ${color}40`,
      borderRadius: 20, padding: "4px 14px",
      fontSize: 12, fontFamily: "inherit",
      title: `$${balance.toFixed(2)} (demo credits — not real money)`,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
      <span style={{ color: "#6b7d92", fontWeight: 600 }}>Credits</span>
      <span style={{ color, fontWeight: 800 }}>{credits.toLocaleString()}</span>
    </div>
  );
}

export default function App() {
  const [tab,         setTab]         = useState("playground");
  const [activeLobby, setActiveLobby] = useState(null);
  const [showSplash,  setShowSplash]  = useState(false);

  useEffect(() => {
    if (localStorage.getItem("av_entered") !== "v3") setShowSplash(true);
  }, []);

  const handleEnter = () => {
    localStorage.setItem("av_entered", "v3");
    setShowSplash(false);
  };

  // Reset lobby when leaving the city tab
  const handleTabChange = (id) => {
    if (id !== "city") setActiveLobby(null);
    setTab(id);
  };

  const inCity = tab === "city" && activeLobby !== null;

  return (
    <WalletProvider>
    {showSplash && <SplashScreen onEnter={handleEnter} />}
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "linear-gradient(180deg, #cfe9ff 0%, #f4e7d0 14%, #f4e7d0 100%)",
      overflow: "hidden",
      fontFamily: "var(--font-nunito), Nunito, system-ui, sans-serif",
    }}>

      {/* ── Top nav ── */}
      <nav style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "0 20px", height: 52, flexShrink: 0,
        borderBottom: "1px solid #e6d6bd",
        background: "rgba(253,250,246,0.97)",
        backdropFilter: "blur(12px)",
        zIndex: 100,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginRight: 20 }}>
          <span style={{ color: "#2d5a7a", fontWeight: 300, fontSize: 17, letterSpacing: "-0.3px" }}>Agent</span>
          <span style={{ color: "#2d5a7a", fontWeight: 800, fontSize: 17, letterSpacing: "-0.3px" }}>Verse</span>
        </div>

        {/* Pill tabs */}
        {NAV.map((n) => {
          const active = tab === n.id;
          const color  = n.accent ?? "#4a9fd4";
          return (
            <button key={n.id} onClick={() => handleTabChange(n.id)} style={{
              padding: "5px 16px", borderRadius: 20, border: "none",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: active ? `${color}18` : "transparent",
              color: active ? color : "#9aabb8",
              boxShadow: active ? `inset 0 0 0 1px ${color}40` : "none",
              transition: "all 0.15s",
            }}>
              {n.label}
            </button>
          );
        })}

        {/* Active lobby breadcrumb */}
        {inCity && (
          <>
            <div style={{ color: "#c8d4e0", fontSize: 13, margin: "0 4px" }}>›</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 20,
              background: `${activeLobby.color}18`,
              border: `1px solid ${activeLobby.color}40`,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", background: activeLobby.color,
              }} />
              <span style={{ color: activeLobby.color, fontSize: 12, fontWeight: 700 }}>
                {activeLobby.label}
              </span>
            </div>
            <button
              onClick={() => setActiveLobby(null)}
              style={{
                background: "none", border: "none", color: "#9aabb8",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                padding: "4px 8px", borderRadius: 8,
              }}
            >← Worlds</button>
          </>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Wallet HUD */}
        <WalletHUD />

        {/* Web3 wallet connect (for x402 payments) */}
        <WalletButton />

        {/* Builder link */}
        <a href="/build" style={{
          color: "#B59CE6", fontSize: 12, fontWeight: 700,
          textDecoration: "none", padding: "5px 14px",
          background: "rgba(139,111,212,0.1)",
          border: "1px solid rgba(139,111,212,0.3)",
          borderRadius: 20, marginLeft: 6,
        }}>
          + Pipeline Builder
        </a>
      </nav>

      {/* ── Content ── */}
      <ErrorBoundary key={`${tab}-${activeLobby?.id}`}>
        <div style={{ flex: 1, overflow: "hidden", position: "relative", height: "100%" }}>
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
          {tab === "challenges"  && <ChallengesView />}
          {tab === "marketplace" && <MarketplaceView />}
          {tab === "developer"   && <DeveloperView />}
        </div>
      </ErrorBoundary>
    </div>
    </WalletProvider>
  );
}
