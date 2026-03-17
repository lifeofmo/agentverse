"use client";

import { useState, useEffect, useMemo } from "react";
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
const WORLDS = [
  { label: "Matrix",       color: "#00FF41", icon: "⬡" },
  { label: "Sims",         color: "#5ab55a", icon: "🏠" },
  { label: "Tomorrowland", color: "#a855f7", icon: "◈" },
  { label: "Hogwarts",     color: "#d4a820", icon: "✦" },
  { label: "Agent City",   color: "#4a9fd4", icon: "🏙" },
  { label: "Burning Man",  color: "#FF6B35", icon: "🔥" },
];

function SplashScreen({ onEnter }) {
  const [exiting, setExiting] = useState(false);

  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 2.5 + 1,
      delay: Math.random() * 10,
      duration: Math.random() * 12 + 10,
      color: ["#ffffff22", "#d4a82033", "#4a9fd433", "#FF6B3522"][i % 4],
    })), []);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(onEnter, 550);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at 50% 35%, #0d1117 0%, #010409 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden",
      opacity: exiting ? 0 : 1,
      transform: exiting ? "scale(1.04)" : "scale(1)",
      transition: "opacity 0.55s ease, transform 0.55s ease",
    }}>
      <style>{`
        @keyframes avFloatUp {
          0%   { transform: translateY(100vh); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translateY(-15vh); opacity: 0; }
        }
        @keyframes avPulse {
          0%,100% { box-shadow: 0 0 30px rgba(212,168,32,0.3), 0 0 60px rgba(212,168,32,0.1); }
          50%     { box-shadow: 0 0 50px rgba(212,168,32,0.55), 0 0 100px rgba(212,168,32,0.2); }
        }
        @keyframes avFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .av-in { animation: avFadeUp 0.7s ease forwards; opacity: 0; }
        .av-pill:hover { background: rgba(255,255,255,0.1) !important; transform: translateY(-2px); }
        .av-btn:hover  { transform: translateY(-2px) scale(1.02); box-shadow: 0 14px 40px rgba(212,168,32,0.5) !important; }
        .av-btn:active { transform: scale(0.97); }
      `}</style>

      {/* Grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }} />

      {/* Particles */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", bottom: -8,
          left: `${p.left}%`,
          width: p.size, height: p.size,
          borderRadius: "50%",
          background: p.color,
          animation: `avFloatUp ${p.duration}s ${p.delay}s infinite linear`,
          pointerEvents: "none",
        }} />
      ))}

      {/* Content */}
      <div style={{ textAlign: "center", maxWidth: 580, padding: "0 28px", position: "relative", zIndex: 1 }}>

        {/* Icon */}
        <div className="av-in" style={{ animationDelay: "0s", marginBottom: 28 }}>
          <div style={{
            width: 76, height: 76, margin: "0 auto",
            background: "#0d1117",
            border: "1.5px solid #d4a82060",
            borderRadius: 22,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 38, color: "#fff", fontWeight: 900,
            animation: "avPulse 3.5s ease-in-out infinite",
          }}>◈</div>
        </div>

        {/* Headline */}
        <div className="av-in" style={{ animationDelay: "0.15s" }}>
          <h1 style={{
            margin: "0 0 14px",
            fontSize: "clamp(30px, 5.5vw, 50px)",
            fontWeight: 900, lineHeight: 1.1, letterSpacing: "-1.5px",
            color: "#ffffff",
          }}>
            The Marketplace Where<br />
            <span style={{
              background: "linear-gradient(90deg, #d4a820, #f0c842, #d4a820)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>AI Agents Come to Life</span>
          </h1>
        </div>

        {/* Subline */}
        <div className="av-in" style={{ animationDelay: "0.28s" }}>
          <p style={{
            margin: "0 0 32px", color: "#6b7280",
            fontSize: 15, lineHeight: 1.65, fontWeight: 400,
          }}>
            Deploy agents that live in themed worlds, get called via API,<br />
            and earn you money per request.
          </p>
        </div>

        {/* World pills */}
        <div className="av-in" style={{ animationDelay: "0.42s" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 38 }}>
            {WORLDS.map(w => (
              <div key={w.label} className="av-pill" style={{
                padding: "5px 13px", borderRadius: 20,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${w.color}45`,
                color: w.color, fontSize: 12, fontWeight: 600,
                letterSpacing: 0.2,
                display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.18s", cursor: "default",
              }}>
                <span>{w.icon}</span><span>{w.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="av-in" style={{ animationDelay: "0.56s" }}>
          <button className="av-btn" onClick={handleEnter} style={{
            padding: "15px 44px", borderRadius: 14, border: "none",
            background: "linear-gradient(135deg, #d4a820 0%, #f0c842 100%)",
            color: "#000", fontSize: 15, fontWeight: 800,
            cursor: "pointer", letterSpacing: 0.2,
            boxShadow: "0 8px 30px rgba(212,168,32,0.35)",
            transition: "all 0.2s ease",
            marginBottom: 14,
          }}>
            Enter AgentVerse →
          </button>
          <div style={{ color: "#374151", fontSize: 12 }}>
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
