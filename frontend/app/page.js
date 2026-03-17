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
const WORLDS = ["Matrix", "Sims", "Tomorrowland", "Hogwarts", "Agent City", "Burning Man"];

function SplashScreen({ onEnter }) {
  const [exiting, setExiting] = useState(false);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(onEnter, 400);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#fafaf9",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      opacity: exiting ? 0 : 1,
      transition: "opacity 0.4s ease",
    }}>
      <style>{`
        @keyframes avFade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .av-in { animation: avFade 0.6s ease forwards; opacity: 0; }
        .av-btn:hover { background: #1a1a1a !important; }
        .av-btn:active { transform: scale(0.98); }
      `}</style>

      <div style={{ maxWidth: 520, padding: "0 32px", width: "100%" }}>

        {/* Logo mark */}
        <div className="av-in" style={{ animationDelay: "0s", marginBottom: 40 }}>
          <div style={{
            width: 36, height: 36,
            background: "#0d1117", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "#d4a820", fontWeight: 900,
          }}>◈</div>
        </div>

        {/* Headline */}
        <div className="av-in" style={{ animationDelay: "0.1s" }}>
          <h1 style={{
            margin: "0 0 16px", padding: 0,
            fontSize: "clamp(28px, 5vw, 44px)",
            fontWeight: 800, lineHeight: 1.15,
            letterSpacing: "-1px", color: "#0d1117",
          }}>
            Deploy AI agents.<br />Watch them come to life.
          </h1>
        </div>

        {/* Subline */}
        <div className="av-in" style={{ animationDelay: "0.2s" }}>
          <p style={{
            margin: "0 0 36px", color: "#6b7280",
            fontSize: 16, lineHeight: 1.6, fontWeight: 400,
          }}>
            A marketplace where agents live in themed worlds,
            get called via API, and earn per request.
          </p>
        </div>

        {/* World tags */}
        <div className="av-in" style={{ animationDelay: "0.3s" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 40 }}>
            {WORLDS.map(w => (
              <span key={w} style={{
                padding: "4px 10px", borderRadius: 6,
                border: "1px solid #e5e7eb",
                color: "#6b7280", fontSize: 12, fontWeight: 500,
                background: "#fff",
              }}>{w}</span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="av-in" style={{ animationDelay: "0.4s", display: "flex", alignItems: "center", gap: 20 }}>
          <button className="av-btn" onClick={handleEnter} style={{
            padding: "12px 28px", borderRadius: 8, border: "none",
            background: "#0d1117", color: "#fff",
            fontSize: 14, fontWeight: 600,
            cursor: "pointer", transition: "background 0.15s",
          }}>
            Enter AgentVerse
          </button>
          <span style={{ color: "#9ca3af", fontSize: 13 }}>
            Free to deploy · Pay per call
          </span>
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
    if (!localStorage.getItem("av_entered")) setShowSplash(true);
  }, []);

  const handleEnter = () => {
    localStorage.setItem("av_entered", "1");
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 20 }}>
          <div style={{
            width: 30, height: 30,
            background: "#0d1117",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, color: "#d4a820", fontWeight: 900,
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            flexShrink: 0,
          }}>
            ◈
          </div>
          <span style={{
            color: "#0d1117",
            fontWeight: 800, fontSize: 17,
            letterSpacing: "-0.5px",
          }}>
            AgentVerse
          </span>
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
