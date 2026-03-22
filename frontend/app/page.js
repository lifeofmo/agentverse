"use client";

import { useState, useEffect, useRef } from "react";
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
import { useToast } from "@/app/components/Toast";
import { WS } from "@/app/lib/config";

// ── Splash ─────────────────────────────────────────────────────────────────────

function SplashScreen({ onEnter }) {
  const [exiting, setExiting] = useState(false);
  const enter = () => { setExiting(true); setTimeout(onEnter, 500); };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#04040a",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "env(safe-area-inset-top) 28px env(safe-area-inset-bottom)",
      opacity: exiting ? 0 : 1,
      transition: "opacity 0.5s ease",
      overflow: "hidden",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes orbPulse {
          0%,100% { transform: scale(1);   opacity: 0.55; }
          50%      { transform: scale(1.06); opacity: 0.75; }
        }
        @keyframes orbPulse2 {
          0%,100% { transform: scale(1);   opacity: 0.3; }
          50%      { transform: scale(1.1); opacity: 0.45; }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes gridScroll {
          from { transform: translateY(0); }
          to   { transform: translateY(40px); }
        }
        .sp-fade { animation: fadeUp 0.7s ease forwards; opacity: 0; }
        .sp-cta:hover { background: #7c6af7 !important; transform: translateY(-1px); box-shadow: 0 8px 32px #6366f155 !important; }
        .sp-cta:active { transform: translateY(0); }
      `}</style>

      {/* ── Background: grid + orbs ── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>

        {/* Subtle grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(rgba(99,102,241,0.045) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(99,102,241,0.045) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          animation: "gridScroll 8s linear infinite",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        }} />

        {/* WorldChain orb — outer glow */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%, -60%)",
          width: "min(560px, 110vw)", height: "min(560px, 110vw)",
          borderRadius: "50%",
          background: "radial-gradient(circle, #4338ca22 0%, #312e8114 35%, transparent 70%)",
          animation: "orbPulse2 6s ease-in-out infinite",
          filter: "blur(1px)",
        }} />

        {/* WorldChain orb — core */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%, -60%)",
          width: "min(320px, 80vw)", height: "min(320px, 80vw)",
          borderRadius: "50%",
          background: "radial-gradient(circle at 38% 38%, #6366f130 0%, #4338ca18 40%, transparent 70%)",
          boxShadow: "0 0 120px 40px #4338ca18, inset 0 0 60px #6366f110",
          animation: "orbPulse 5s ease-in-out infinite",
          border: "1px solid rgba(99,102,241,0.12)",
        }} />

        {/* Orb meridian lines (WorldChain globe feel) */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%, -60%)",
          width: "min(320px, 80vw)", height: "min(320px, 80vw)",
          borderRadius: "50%",
          border: "1px solid rgba(99,102,241,0.08)",
          boxShadow: "0 0 0 40px rgba(99,102,241,0.03), 0 0 0 80px rgba(99,102,241,0.015)",
        }} />

        {/* Stripe-style purple beam */}
        <div style={{
          position: "absolute", bottom: 0, left: "50%",
          transform: "translateX(-50%)",
          width: "60%", height: "40%",
          background: "radial-gradient(ellipse at 50% 100%, #6366f118 0%, transparent 70%)",
          filter: "blur(20px)",
        }} />
      </div>

      {/* ── Content ── */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 520, width: "100%" }}>

        {/* Wordmark */}
        <div className="sp-fade" style={{ animationDelay: "0.05s", marginBottom: 44 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg, #6366f1, #4338ca)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, boxShadow: "0 2px 12px #6366f150",
            }}>⬡</div>
            <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 300, fontSize: 16, letterSpacing: "0.5px" }}>Agent</span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: "0.5px", marginLeft: -6 }}>Verse</span>
          </div>
        </div>

        {/* Hero headline */}
        <div className="sp-fade" style={{ animationDelay: "0.15s", marginBottom: 18 }}>
          <h1 style={{
            margin: 0,
            fontSize: "clamp(32px, 7vw, 60px)",
            fontWeight: 800,
            letterSpacing: "-1.5px",
            lineHeight: 1.1,
            color: "#fff",
          }}>
            The AI Agent<br />
            <span style={{
              background: "linear-gradient(90deg, #818cf8 0%, #a78bfa 50%, #818cf8 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>Economy</span>
          </h1>
        </div>

        {/* Sub */}
        <div className="sp-fade" style={{ animationDelay: "0.25s", marginBottom: 36 }}>
          <p style={{
            margin: 0, color: "rgba(255,255,255,0.45)",
            fontSize: "clamp(13px, 2.5vw, 16px)", lineHeight: 1.7,
          }}>
            Deploy agents. Earn per API call.<br />
            Pay with card or USDC — verified by World ID.
          </p>
        </div>

        {/* Integration badges */}
        <div className="sp-fade" style={{ animationDelay: "0.32s", marginBottom: 36 }}>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>
            Powered by
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>

            {/* Stripe */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(99,91,255,0.08)", border: "1px solid rgba(99,91,255,0.25)",
              borderRadius: 10, padding: "8px 14px",
            }}>
              <img src="/stripe-logo.svg" width="18" height="18" alt="Stripe" style={{ flexShrink: 0 }} />
              <div style={{ textAlign: "left" }}>
                <div style={{ color: "#635bff", fontWeight: 800, fontSize: 12, letterSpacing: "-0.2px" }}>Stripe</div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>Card payments</div>
              </div>
            </div>

            {/* x402 */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.22)",
              borderRadius: 10, padding: "8px 14px",
            }}>
              <img src="/x402-logo.svg" width="52" height="19" alt="x402" style={{ flexShrink: 0, display: "block" }} />
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>HTTP micropayments</div>
            </div>

            {/* World ID */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10, padding: "8px 14px",
            }}>
              <img src="/worldid-logo.svg" width="20" height="20" alt="World ID" style={{ flexShrink: 0 }} />
              <div style={{ textAlign: "left" }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 12, letterSpacing: "-0.2px" }}>World ID</div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>Proof of humanity</div>
              </div>
            </div>

          </div>
        </div>

        {/* CTA */}
        <div className="sp-fade" style={{ animationDelay: "0.4s" }}>
          <button
            className="sp-cta"
            onClick={enter}
            style={{
              padding: "14px 48px", borderRadius: 12,
              background: "#6366f1", color: "#fff",
              border: "none", fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.18s ease",
              boxShadow: "0 4px 20px #6366f135",
              marginBottom: 14, display: "inline-block",
            }}
          >
            Enter AgentVerse →
          </button>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
            500 free credits to start · No credit card required
          </div>
        </div>
      </div>

      {/* ── Bottom stat bar ── */}
      <div className="sp-fade" style={{
        animationDelay: "0.55s",
        position: "absolute", bottom: "max(28px, env(safe-area-inset-bottom))",
        left: 0, right: 0,
        display: "flex", justifyContent: "center", gap: 28,
        borderTop: "1px solid rgba(255,255,255,0.04)",
        paddingTop: 18,
      }}>
        {[
          ["agents live", "50+"],
          ["per-call payments", "x402"],
          ["verified humans", "World ID"],
        ].map(([label, val]) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ color: "#818cf8", fontWeight: 700, fontSize: 14 }}>{val}</div>
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Guide overlay ──────────────────────────────────────────────────────────────

const GUIDE_STEPS = [
  {
    icon: "◉",
    color: "#818cf8",
    title: "Browse the Store",
    body: "Discover AI agents built by the community. Each agent does one job — price feeds, sentiment analysis, risk scoring, and more. Try any agent live before using it.",
    action: "marketplace",
    cta: "Open Store →",
  },
  {
    icon: "◈",
    color: "#34d399",
    title: "Build a Pipeline",
    body: "Chain multiple agents together in the Pipeline Builder. The output of each step becomes the input for the next — combine a price feed → sentiment → momentum for a full trading signal.",
    action: "build",
    cta: "Open Builder →",
  },
  {
    icon: "⬡",
    color: "#f59e0b",
    title: "Watch agents live in a World",
    body: "Each World is a real-time visualization of agents running. Las Vegas shows trading agents, the Matrix shows data pipelines, Hogwarts hosts all agents at once.",
    action: "city",
    cta: "Enter a World →",
  },
  {
    icon: "⚙",
    color: "#a78bfa",
    title: "Deploy your own agent",
    body: "Have an API? Register it as an agent in under 60 seconds. Set a price per call in USDC — you earn 90% of every call, platform takes 10%. Verified with World ID for Sybil resistance.",
    action: "developer",
    cta: "Developer Dashboard →",
  },
  {
    icon: "◆",
    color: "#e6c36b",
    title: "Enter Missions & win rewards",
    body: "Challenges ask you to build the best-scoring pipeline for a specific goal. Submit your pipeline, run it, and climb the leaderboard. Top scores share the reward pool.",
    action: "challenges",
    cta: "See Missions →",
  },
];

function GuideModal({ onClose, onGoTo }) {
  const [step, setStep] = useState(0);
  const s = GUIDE_STEPS[step];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 22, width: "100%", maxWidth: 440, padding: "32px 28px", boxShadow: "0 40px 100px rgba(0,0,0,0.8)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 5, marginBottom: 28 }}>
          {GUIDE_STEPS.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{ flex: i === step ? 2 : 1, height: 3, borderRadius: 2, background: i === step ? s.color : i < step ? `${s.color}50` : "rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.3s" }} />
          ))}
        </div>

        {/* Icon */}
        <div style={{ width: 52, height: 52, borderRadius: 14, background: `${s.color}15`, border: `1px solid ${s.color}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: s.color, marginBottom: 20 }}>{s.icon}</div>

        {/* Content */}
        <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 20, letterSpacing: "-0.3px", marginBottom: 10 }}>{s.title}</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>{s.body}</div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => { onGoTo(s.action); onClose(); }}
            style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: s.color, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >{s.cta}</button>
          {step < GUIDE_STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Next</button>
          ) : (
            <button onClick={onClose} style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Done</button>
          )}
        </div>

        {/* Step counter */}
        <div style={{ marginTop: 16, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 11 }}>{step + 1} of {GUIDE_STEPS.length}</div>
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

function CreditsHUD({ onTopUp }) {
  const { walletBalance: balance } = useAuth({ fetchWallet: true });

  if (balance === null) return null;

  const credits = Math.round(balance * 100);
  const low     = credits < 500;
  const color   = low ? "#f87171" : credits < 2000 ? "#fbbf24" : "#34d399";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: `${color}12`, border: `1px solid ${color}35`,
      borderRadius: 8, padding: "5px 12px",
      fontFamily: "system-ui, sans-serif",
      cursor: low ? "pointer" : "default",
    }} onClick={low ? onTopUp : undefined} title={low ? "Credits low — click to top up" : undefined}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%", background: color,
        animation: low ? "pulse 1.5s ease-in-out infinite" : "none",
      }} />
      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 500 }}>Credits</span>
      <span style={{ color, fontSize: 12, fontWeight: 800 }}>{credits.toLocaleString()}</span>
      {low && <span style={{ color, fontSize: 10, fontWeight: 700 }}>· Top up →</span>}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab,         setTab]         = useState("playground");
  const [activeLobby, setActiveLobby] = useState(null);
  const [showSplash,  setShowSplash]  = useState(false);
  const [showGuide,   setShowGuide]   = useState(false);
  const { show: showToast, ToastContainer } = useToast();
  const wsRef = useRef(null);

  useEffect(() => {
    if (localStorage.getItem("av_entered") !== "v4") setShowSplash(true);
  }, []);

  // ── Global WebSocket notifications ─────────────────────────────────────────
  useEffect(() => {
    let retryTimer;
    function connect() {
      const ws = new WebSocket(WS);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "pipeline_done") {
            showToast(`Pipeline complete — ${msg.steps ?? 0} steps`, "success");
          } else if (msg.type === "pipeline_timeout") {
            showToast("Pipeline timed out", "warning");
          } else if (msg.type === "challenge_entry") {
            showToast(`New challenge entry — score ${msg.score}`, "success");
          } else if (msg.type === "agent_registered") {
            showToast(`Agent "${msg.name}" registered`, "success");
          } else if (msg.type === "battle_end") {
            const winner = msg.winner === "a" ? msg.agent_a : msg.agent_b;
            showToast(`Battle over — ${winner} wins!`, "success");
          }
        } catch {}
      };
      ws.onclose = () => { retryTimer = setTimeout(connect, 5000); };
    }
    connect();
    return () => {
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnter = () => {
    localStorage.setItem("av_entered", "v4");
    setShowSplash(false);
  };

  const handleTabChange = (id) => {
    if (id === "build") { window.location.href = "/build"; return; }
    if (id !== "city") setActiveLobby(null);
    setTab(id);
  };

  const inCity = tab === "city" && activeLobby !== null;

  return (
    <>
      <ToastContainer />
      {showSplash && <SplashScreen onEnter={handleEnter} />}
      {showGuide && (
        <GuideModal
          onClose={() => setShowGuide(false)}
          onGoTo={(id) => handleTabChange(id)}
        />
      )}
      <div style={{
        display: "flex", flexDirection: "column",
        height: "100dvh",           /* dvh = dynamic viewport height — fixes iOS Safari URL bar */
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
          @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
          .desktop-only { display: flex; }
          .mobile-only  { display: none; }
          @media (max-width: 640px) {
            .desktop-only { display: none !important; }
            .mobile-only  { display: flex !important; }
            .nav-tabs-desktop { display: none !important; }
            /* bottom-tab height (60px) + iPhone home indicator */
            .main-content { padding-bottom: calc(60px + env(safe-area-inset-bottom)) !important; }
          }
        `}</style>

        {/* ── Top nav ───────────────────────────────────────────────────────── */}
        <nav style={{
          display: "flex", alignItems: "center",
          /* paddingTop covers iPhone status bar / Dynamic Island in standalone mode */
          padding: "env(safe-area-inset-top) 14px 0",
          height: "calc(52px + env(safe-area-inset-top))",
          flexShrink: 0,
          background: "rgba(10,10,15,0.97)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          zIndex: 100,
        }}>
          {/* Logo — click to return to splash */}
          <div onClick={() => setShowSplash(true)} style={{ marginRight: 20, cursor: "pointer", userSelect: "none", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
            <span style={{
              background: "linear-gradient(135deg, #818cf8, #34d399)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              fontWeight: 800, fontSize: 15, letterSpacing: "-0.3px",
            }}>AgentVerse</span>
          </div>

          {/* Desktop tabs */}
          <div className="nav-tabs-desktop" style={{ display: "flex", gap: 2 }}>
            {NAV.map(n => {
              const active = tab === n.id;
              return (
                <button key={n.id} className="nav-tab" onClick={() => handleTabChange(n.id)} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: 8, border: "none",
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  color: active ? "#f1f5f9" : "rgba(255,255,255,0.38)",
                  position: "relative", fontFamily: "inherit",
                }}>
                  <span style={{ fontSize: 11, color: active ? "#818cf8" : "rgba(255,255,255,0.25)" }}>{n.icon}</span>
                  {n.label}
                  {active && <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 20, height: 2, borderRadius: 1, background: "linear-gradient(90deg, #818cf8, #34d399)" }} />}
                </button>
              );
            })}
          </div>

          {/* World breadcrumb (desktop) */}
          {inCity && (
            <div className="desktop-only" style={{ alignItems: "center", gap: 8, marginLeft: 10 }}>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>›</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${activeLobby.color}18`, border: `1px solid ${activeLobby.color}40`, borderRadius: 8, padding: "4px 10px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: activeLobby.color }} />
                <span style={{ color: activeLobby.color, fontSize: 12, fontWeight: 700 }}>{activeLobby.label}</span>
              </div>
              <button onClick={() => setActiveLobby(null)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", padding: "3px 8px", borderRadius: 6, fontWeight: 500, fontFamily: "inherit" }}>← Worlds</button>
            </div>
          )}

          {/* Mobile: current tab label */}
          <div className="mobile-only" style={{ alignItems: "center", flex: 1 }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600 }}>
              {inCity ? activeLobby.label : NAV.find(n => n.id === tab)?.label || ""}
            </span>
            {inCity && (
              <button onClick={() => setActiveLobby(null)} style={{ marginLeft: 10, background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
            )}
          </div>

          <div className="desktop-only" style={{ flex: 1 }} />

          {/* Guide button */}
          <button onClick={() => setShowGuide(true)} title="How it works" className="desktop-only" style={{
            width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent", color: "rgba(255,255,255,0.35)", fontSize: 13,
            fontWeight: 700, cursor: "pointer", marginRight: 8, fontFamily: "inherit",
            alignItems: "center", justifyContent: "center",
          }}>?</button>

          {/* Credits HUD */}
          <CreditsHUD onTopUp={() => handleTabChange("developer")} />

          {/* Build CTA (desktop only) */}
          <a href="/build" className="desktop-only" style={{
            alignItems: "center", gap: 5, color: "#818cf8", fontSize: 12, fontWeight: 700,
            textDecoration: "none", padding: "5px 12px",
            background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.25)",
            borderRadius: 8, marginLeft: 8, fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 11 }}>+</span> Build
          </a>
        </nav>

        {/* ── Mobile bottom tab bar ─────────────────────────────────────────── */}
        <nav className="mobile-only" style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
          background: "rgba(10,10,15,0.97)", borderTop: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          /* height = 60px tabs + iPhone home indicator safe area */
          paddingBottom: "env(safe-area-inset-bottom)",
          alignItems: "flex-start", justifyContent: "space-around",
          padding: "0 4px", paddingBottom: "env(safe-area-inset-bottom)",
        }}>
          {NAV.map(n => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => handleTabChange(n.id)} style={{
                flex: 1, minHeight: 52, background: "none", border: "none",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 3, cursor: "pointer", fontFamily: "inherit",
                color: active ? "#818cf8" : "rgba(255,255,255,0.35)",
                WebkitTapHighlightColor: "transparent",
                transition: "color 0.15s",
              }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{n.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, letterSpacing: 0.2 }}>{n.label}</span>
                {active && <div style={{ position: "absolute", bottom: "calc(env(safe-area-inset-bottom) + 0px)", width: 20, height: 2, borderRadius: 1, background: "#818cf8" }} />}
              </button>
            );
          })}
          <a href="/build" style={{
            flex: 1, minHeight: 52, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 3,
            textDecoration: "none", color: "#818cf8",
            WebkitTapHighlightColor: "transparent",
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>✦</span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>Build</span>
          </a>
        </nav>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <ErrorBoundary key={`${tab}-${activeLobby?.id}`}>
          <div className="main-content" style={{ flex: 1, overflow: "hidden", position: "relative" }}>
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
