"use client";

import { useState } from "react";
import Link from "next/link";

const SECTIONS = [
  {
    id: "start",
    icon: "🚀",
    title: "Getting Started",
    color: "#818cf8",
    steps: [
      {
        title: "Create your account",
        body: "Sign up with an email and password. You'll get 500 free credits ($5) to explore the platform — no card required.",
      },
      {
        title: "Top up credits",
        body: "Credits are the platform currency. 100 credits = $1. Top up anytime in the Developer tab using a card. Each agent call costs a few credits.",
      },
      {
        title: "Try an agent",
        body: "Head to the Store, pick any agent, and click TRY →. Type a market (e.g. BTC, ETH) and hit Run. The result appears instantly.",
      },
    ],
  },
  {
    id: "store",
    icon: "🤖",
    title: "Store",
    color: "#34d399",
    steps: [
      {
        title: "What are agents?",
        body: "Agents are AI-powered API endpoints. Each one does a specific task — price feeds, trading signals, sentiment analysis, risk scanning, and more.",
      },
      {
        title: "Demo vs. live agents",
        body: "Built-in agents (marked with a yellow D badge) return simulated data for testing. Agents with a green ✓ are connected to real data sources. You can deploy your own real agent in the Developer tab.",
      },
      {
        title: "How billing works",
        body: "Each agent call deducts a small number of credits from your balance. The cost is shown on every card (e.g. '1 cr / call'). You only pay when you actually run an agent.",
      },
    ],
  },
  {
    id: "playground",
    icon: "⚡",
    title: "Playground",
    color: "#f59e0b",
    steps: [
      {
        title: "Building a pipeline",
        body: "Drag agents from the library panel on the left onto the canvas. Connect them by dragging from the right handle (output) of one node to the left handle (input) of another.",
      },
      {
        title: "Running a pipeline",
        body: "Click Run Pipeline at the top. The output of each agent flows into the next. Results appear on each node in real time. Each step costs credits based on the agent's price.",
      },
      {
        title: "Saving & deploying",
        body: "Save a pipeline to reuse it. You can also register a saved pipeline as a composite agent — it shows up in the Store so others can call it too.",
      },
    ],
  },
  {
    id: "worlds",
    icon: "🌍",
    title: "Worlds",
    color: "#a78bfa",
    steps: [
      {
        title: "What are Worlds?",
        body: "Worlds are live 3D visualizations of agents running on the platform. You can watch agents earning, firing calls, and receiving payments in real time.",
      },
      {
        title: "Choosing a World",
        body: "Each world has a different theme and focuses on different agent categories — Las Vegas for trading, The Matrix for data pipelines, Hogwarts for running all agents at once.",
      },
      {
        title: "Interacting",
        body: "Click on any agent in the world to see its live stats — calls made, earnings, uptime. The WorldOverlay panel on the left shows a summary of all active agents.",
      },
    ],
  },
  {
    id: "developer",
    icon: "💸",
    title: "Developer Hub",
    color: "#f87171",
    steps: [
      {
        title: "Deploying an agent",
        body: "Have an API endpoint? Go to Developer → Register Agent. Give it a name, paste your endpoint URL, set a price per call, and submit. Your agent goes live in the Store immediately.",
      },
      {
        title: "Earning from your agent",
        body: "Every time someone calls your agent, you earn 90% of the price. 10% goes to the platform. Earnings accumulate in your wallet and can be withdrawn as USDC to a Base wallet.",
      },
      {
        title: "Adding a Base wallet",
        body: "To receive crypto earnings, connect a Base-compatible wallet (e.g. MetaMask, Coinbase Wallet) in the Developer tab. Earnings are paid in USDC on the Base network.",
      },
      {
        title: "Challenges",
        body: "Challenges are bounties posted by the community. Complete a challenge by deploying an agent that meets its requirements and claim the reward.",
      },
    ],
  },
];

function Section({ section, open, onToggle }) {
  return (
    <div style={{
      background: "#0d1117",
      border: `1px solid ${open ? section.color + "40" : "#1f2937"}`,
      borderRadius: 16,
      overflow: "hidden",
      transition: "border-color 0.2s",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 14,
          padding: "18px 20px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: section.color + "18", border: `1px solid ${section.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>{section.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#f9fafb", fontWeight: 700, fontSize: 15 }}>{section.title}</div>
          <div style={{ color: "#4b5563", fontSize: 12, marginTop: 2 }}>{section.steps.length} topics</div>
        </div>
        <div style={{
          color: open ? section.color : "#4b5563",
          fontSize: 18, transition: "transform 0.2s",
          transform: open ? "rotate(180deg)" : "none",
        }}>⌄</div>
      </button>

      {/* Steps */}
      {open && (
        <div style={{ borderTop: `1px solid #1f2937` }}>
          {section.steps.map((step, i) => (
            <div key={i} style={{
              display: "flex", gap: 14, padding: "16px 20px",
              borderBottom: i < section.steps.length - 1 ? "1px solid #111827" : "none",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: section.color + "18", border: `1px solid ${section.color}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: section.color, fontSize: 11, fontWeight: 800, marginTop: 1,
              }}>{i + 1}</div>
              <div>
                <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{step.title}</div>
                <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.65 }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const [open, setOpen] = useState("start");

  const toggle = (id) => setOpen(prev => prev === id ? null : id);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040a",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "env(safe-area-inset-top) 0 env(safe-area-inset-bottom)",
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .docs-fade { animation: fadeUp 0.5s ease forwards; }
      `}</style>

      {/* Header */}
      <div style={{
        maxWidth: 680, margin: "0 auto",
        padding: "48px clamp(16px,5vw,32px) 32px",
      }}>
        <Link href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: "#4b5563", fontSize: 13, fontWeight: 600,
          textDecoration: "none", marginBottom: 32,
        }}>
          ← Back to AgentVerse
        </Link>

        <div className="docs-fade">
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>
            Documentation
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(26px,5vw,36px)", fontWeight: 800, color: "#f9fafb", letterSpacing: "-0.5px", lineHeight: 1.2, marginBottom: 12 }}>
            How AgentVerse works
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "#6b7280", lineHeight: 1.7, maxWidth: 520 }}>
            AgentVerse is a marketplace where AI agents earn money per API call. You can try agents, build pipelines, and deploy your own agents to earn USDC.
          </p>
        </div>

        {/* Quick nav pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 28 }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setOpen(s.id)} style={{
              padding: "6px 14px", borderRadius: 20,
              border: `1px solid ${open === s.id ? s.color + "60" : "#1f2937"}`,
              background: open === s.id ? s.color + "14" : "transparent",
              color: open === s.id ? s.color : "#6b7280",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", transition: "all 0.15s",
            }}>
              {s.icon} {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div style={{
        maxWidth: 680, margin: "0 auto",
        padding: "0 clamp(16px,5vw,32px) 80px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {SECTIONS.map(s => (
          <Section key={s.id} section={s} open={open === s.id} onToggle={() => toggle(s.id)} />
        ))}

        {/* Footer note */}
        <div style={{
          marginTop: 24, padding: "16px 20px",
          background: "#818cf808", border: "1px solid #818cf820",
          borderRadius: 12, display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.65 }}>
            <strong style={{ color: "#9ca3af" }}>New here?</strong> The fastest way to understand the platform is: try an agent in the Store → build a 2-node pipeline in the Playground → watch it run in a World. Takes about 5 minutes.
          </div>
        </div>
      </div>
    </div>
  );
}
