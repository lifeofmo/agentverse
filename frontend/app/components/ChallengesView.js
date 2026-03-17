"use client";

import { useEffect, useState, useCallback } from "react";

import { API } from "@/app/lib/config";

const FIELD_OPTIONS = ["confidence", "volatility", "bullish_score", "change_24h_pct"];

const FIELD_COLOR = {
  confidence:     "#6BCF8B",
  volatility:     "#E67B7B",
  bullish_score:  "#6BB6E6",
  change_24h_pct: "#E6C36B",
};

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

// ── Shared input style ─────────────────────────────────────────────────────────

const inp = {
  width: "100%", background: "#f8f6f2", border: "1px solid #e6d6bd",
  borderRadius: 8, color: "#2d3a4a", padding: "8px 12px",
  fontSize: 13, boxSizing: "border-box", marginBottom: 10,
  outline: "none", fontFamily: "inherit",
};

// ── Rank badge ─────────────────────────────────────────────────────────────────

function RankBadge({ rank }) {
  const colors = ["#E6C36B", "#8a9bb0", "#a0764a"];
  const labels = ["1st", "2nd", "3rd"];
  const color = colors[rank - 1] ?? "#9aabb8";
  const label = labels[rank - 1] ?? `${rank}th`;
  return (
    <span style={{
      background: `${color}18`, color,
      borderRadius: 5, padding: "2px 8px",
      fontSize: 11, fontWeight: 700,
    }}>{label}</span>
  );
}

// ── Mission card ───────────────────────────────────────────────────────────────

function MissionCard({ c, pipelines, onSubmit, onBoard, boardOpen, board }) {
  const [submitting, setSubmitting] = useState(false);
  const top = board?.[0];
  const fieldColor = FIELD_COLOR[c.scoring_field] ?? "#9aabb8";
  const isOpen = c.status === "open";

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e6d6bd",
      borderTop: `3px solid ${isOpen ? "#E6C36B" : "#c0b8ae"}`,
      borderRadius: 16, padding: "22px 20px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>

      {/* Top row */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
        {/* Status dot + title */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: isOpen ? "rgba(196,153,60,0.12)" : "#f0ece6",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${isOpen ? "rgba(196,153,60,0.3)" : "#e6d6bd"}`,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: "50%",
            background: isOpen ? "#E6C36B" : "#c0b8ae",
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 15, lineHeight: 1.25, marginBottom: 6 }}>
            {c.title}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              background: `${fieldColor}14`, color: fieldColor,
              border: `1px solid ${fieldColor}30`,
              borderRadius: 5, padding: "2px 9px", fontSize: 10, fontWeight: 600,
            }}>
              {c.scoring_field}
            </span>
            <span style={{
              background: isOpen ? "rgba(74,184,122,0.1)" : "#f0ece6",
              color:      isOpen ? "#4ab87a" : "#9aabb8",
              border: `1px solid ${isOpen ? "rgba(74,184,122,0.25)" : "#e6d6bd"}`,
              borderRadius: 5, padding: "2px 9px", fontSize: 10, fontWeight: 600,
            }}>
              {isOpen ? "open" : "closed"}
            </span>
          </div>
        </div>

        {/* Reward badge */}
        <div style={{
          flexShrink: 0,
          background: "#fffbf0",
          border: "1px solid rgba(196,153,60,0.3)",
          borderRadius: 12, padding: "8px 13px", textAlign: "center",
          minWidth: 60,
        }}>
          <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase",
            letterSpacing: 1, fontWeight: 700 }}>Reward</div>
          <div style={{ color: "#E6C36B", fontWeight: 800, fontSize: 20, lineHeight: 1.15 }}>
            ${c.reward}
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{ color: "#9aabb8", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
        {c.description || "Build the highest-scoring agent pipeline for this mission."}
      </div>

      {/* Top pipeline preview */}
      {top ? (
        <div style={{
          background: "#f8f6f2", border: "1px solid #e6d6bd",
          borderRadius: 10, padding: "10px 13px", marginBottom: 14,
        }}>
          <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 7, fontWeight: 600 }}>Top Pipeline</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#2d3a4a", fontWeight: 700, fontSize: 13 }}>
              {top.pipeline_name}
            </span>
            <span style={{
              color: "#E6C36B", fontSize: 12, fontWeight: 700,
              background: "rgba(196,153,60,0.1)", borderRadius: 6, padding: "2px 8px",
            }}>
              {top.score}
            </span>
          </div>
        </div>
      ) : (
        <div style={{
          background: "#f8f6f2", border: "1px solid #e6d6bd",
          borderRadius: 10, padding: "10px 13px", marginBottom: 14,
          color: "#9aabb8", fontSize: 12, fontStyle: "italic",
        }}>
          No submissions yet — be the first to claim the reward.
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: submitting ? 14 : 0 }}>
        <button
          disabled={!isOpen}
          onClick={() => setSubmitting((v) => !v)}
          style={{
            flex: 1, borderRadius: 10, padding: "9px",
            fontSize: 12, fontWeight: 700, cursor: isOpen ? "pointer" : "not-allowed",
            background: isOpen ? "rgba(139,111,212,0.1)" : "#f0ece6",
            color:      isOpen ? "#B59CE6" : "#c0b8ae",
            border: `1px solid ${isOpen ? "rgba(139,111,212,0.3)" : "#e6d6bd"}`,
          }}>
          {submitting ? "Cancel" : "Submit Pipeline"}
        </button>
        <button onClick={() => onBoard(c.id)} style={{
          flex: 1, borderRadius: 10, padding: "9px",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          background: boardOpen ? "rgba(74,159,212,0.1)" : "#f8f6f2",
          color: boardOpen ? "#6BB6E6" : "#9aabb8",
          border: `1px solid ${boardOpen ? "rgba(74,159,212,0.3)" : "#e6d6bd"}`,
        }}>
          {boardOpen ? "Hide Board" : "Leaderboard"}
        </button>
      </div>

      {/* Pipeline picker */}
      {submitting && (
        <div style={{
          background: "#f8f6f2", border: "1px solid #e6d6bd",
          borderRadius: 10, padding: "12px", marginBottom: 10,
        }}>
          <div style={{ color: "#9aabb8", fontSize: 10, textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 8, fontWeight: 600 }}>
            Choose a pipeline:
          </div>
          {pipelines.length === 0 ? (
            <div style={{ color: "#9aabb8", fontSize: 12, fontStyle: "italic" }}>
              No pipelines saved yet — build one in Playground.
            </div>
          ) : pipelines.map((p) => (
            <div key={p.id} onClick={() => { onSubmit(c.id, p.id); setSubmitting(false); }}
              style={{
                padding: "8px 11px", borderRadius: 8, marginBottom: 5, cursor: "pointer",
                background: "#fff", border: "1px solid #e6d6bd",
                color: "#6b7d92", fontSize: 12,
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#B59CE6"; e.currentTarget.style.color = "#B59CE6"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e6d6bd"; e.currentTarget.style.color = "#6b7d92"; }}>
              {p.name}
            </div>
          ))}
        </div>
      )}

      {/* Full leaderboard */}
      {boardOpen && (
        <div style={{ borderTop: "1px solid #e6d6bd", paddingTop: 14, marginTop: 4 }}>
          <div style={{ color: "#9aabb8", fontSize: 10, textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 10, fontWeight: 600 }}>
            Full Standings
          </div>
          {(!board || board.length === 0) ? (
            <div style={{ color: "#9aabb8", fontSize: 12, fontStyle: "italic" }}>
              No entries yet.
            </div>
          ) : board.map((entry, i) => (
            <div key={entry.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "7px 10px", marginBottom: 5, borderRadius: 8,
              background: i === 0 ? "rgba(196,153,60,0.06)" : "#f8f6f2",
              border: `1px solid ${i === 0 ? "rgba(196,153,60,0.2)" : "#e6d6bd"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RankBadge rank={i + 1} />
                <span style={{ color: "#2d3a4a", fontWeight: i === 0 ? 700 : 500, fontSize: 13 }}>
                  {entry.pipeline_name}
                </span>
              </div>
              <span style={{
                color: i === 0 ? "#E6C36B" : "#9aabb8",
                fontWeight: 700, fontSize: 12,
                background: "#fff", borderRadius: 5, padding: "2px 8px",
                border: "1px solid #e6d6bd",
              }}>
                {entry.score}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Post challenge form ────────────────────────────────────────────────────────

function PostForm({ onPost, onCancel }) {
  const [form, setForm] = useState({
    title: "", description: "", reward: 100, scoring_field: "confidence",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e6d6bd",
      borderTop: "3px solid #B59CE6",
      borderRadius: 16, padding: "22px 20px", maxWidth: 560, marginBottom: 28,
      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    }}>
      <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 15, marginBottom: 16 }}>
        Post New Mission
      </div>
      <input placeholder="Mission title" value={form.title}
        onChange={(e) => set("title", e.target.value)} style={inp} />
      <input placeholder="Description (optional)" value={form.description}
        onChange={(e) => set("description", e.target.value)} style={inp} />
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <input type="number" placeholder="Reward $" value={form.reward}
          onChange={(e) => set("reward", parseFloat(e.target.value))}
          style={{ ...inp, marginBottom: 0, width: "50%" }} />
        <select value={form.scoring_field}
          onChange={(e) => set("scoring_field", e.target.value)}
          style={{ ...inp, marginBottom: 0, width: "50%", cursor: "pointer" }}>
          {FIELD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { if (form.title) onPost(form); }} style={{
          flex: 1, background: "rgba(139,111,212,0.12)", color: "#B59CE6",
          border: "1px solid rgba(139,111,212,0.3)", borderRadius: 10,
          padding: "9px", fontSize: 13, cursor: "pointer", fontWeight: 700,
        }}>Post Mission</button>
        <button onClick={onCancel} style={{
          flex: 1, background: "#f8f6f2", color: "#9aabb8",
          border: "1px solid #e6d6bd", borderRadius: 10,
          padding: "9px", fontSize: 13, cursor: "pointer", fontWeight: 600,
        }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ChallengesView() {
  const [challenges,   setChallenges]   = useState([]);
  const [pipelines,    setPipelines]    = useState([]);
  const [leaderboards, setLeaderboards] = useState({});
  const [openBoard,    setOpenBoard]    = useState(null);
  const [showForm,     setShowForm]     = useState(false);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      fetch(`${API}/challenges`).then((r) => r.json()),
      fetch(`${API}/pipelines`).then((r) => r.json()),
    ]);
    setChallenges(c); setPipelines(p);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadBoard = async (id) => {
    const rows = await fetch(`${API}/challenges/${id}/leaderboard`).then((r) => r.json());
    setLeaderboards((p) => ({ ...p, [id]: rows }));
  };

  const postChallenge = async (form) => {
    const saved = await fetch(`${API}/challenges`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((r) => r.json());
    setChallenges((c) => [...c, saved]);
    setShowForm(false);
  };

  const submit = async (challengeId, pipelineId) => {
    await fetch(`${API}/challenges/${challengeId}/submit/${pipelineId}`, { method: "POST" });
    loadBoard(challengeId);
    setOpenBoard(challengeId);
  };

  const toggleBoard = (id) => {
    const next = openBoard === id ? null : id;
    setOpenBoard(next);
    if (next) loadBoard(next);
  };

  return (
    <div style={{
      height: "100%", overflowY: "auto",
      background: "#f4e7d0", padding: "32px 40px",
      fontFamily: "inherit",
    }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 30 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <PlazaTree size={36} />
          <div>
            <div style={{ color: "#2d3a4a", fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>
              Missions
            </div>
            <div style={{ color: "#9aabb8", fontSize: 13, marginTop: 5, lineHeight: 1.5 }}>
              Compete by building the best agent pipeline for each task.
              <br />Top pipeline claims the reward.
            </div>
          </div>
          <PlazaTree size={26} />
        </div>
        <button onClick={() => setShowForm((v) => !v)} style={{
          background: showForm ? "rgba(139,111,212,0.1)" : "rgba(196,153,60,0.1)",
          color:      showForm ? "#B59CE6" : "#E6C36B",
          border: `1px solid ${showForm ? "rgba(139,111,212,0.3)" : "rgba(196,153,60,0.3)"}`,
          borderRadius: 20, padding: "9px 20px", fontSize: 13,
          cursor: "pointer", fontWeight: 700,
        }}>
          {showForm ? "Cancel" : "+ Post Mission"}
        </button>
      </div>

      {/* Post form */}
      {showForm && (
        <PostForm onPost={postChallenge} onCancel={() => setShowForm(false)} />
      )}

      {/* Mission grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px,1fr))", gap: 18 }}>
        {challenges.map((c) => (
          <MissionCard key={c.id}
            c={c}
            pipelines={pipelines}
            onSubmit={submit}
            onBoard={toggleBoard}
            boardOpen={openBoard === c.id}
            board={leaderboards[c.id]}
          />
        ))}

        {challenges.length === 0 && !showForm && (
          <div style={{
            background: "#fff", border: "1px solid #e6d6bd", borderRadius: 14,
            padding: "48px 32px", color: "#9aabb8", fontSize: 14, fontStyle: "italic",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}>
            No missions posted yet — be the first to create a challenge.
          </div>
        )}
      </div>
    </div>
  );
}
