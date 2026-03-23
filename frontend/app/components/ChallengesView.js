"use client";

import { useEffect, useState, useCallback } from "react";

import { API } from "@/app/lib/config";
import { useAuth } from "@/app/lib/useAuth";

const FIELD_OPTIONS = ["confidence", "volatility", "bullish_score", "change_24h_pct"];

const FIELD_LABELS = {
  confidence:     "Highest confidence score wins",
  volatility:     "Highest volatility score wins",
  bullish_score:  "Highest bullish score wins",
  change_24h_pct: "Highest 24h price change wins",
};

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
  width: "100%", background: "#1f2937", border: "1px solid #374151",
  borderRadius: 8, color: "#f3f4f6", padding: "8px 12px",
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
  const [submitting,  setSubmitting]  = useState(false);
  const [lastResult,  setLastResult]  = useState(null); // { score, latency_ms }
  const top = board?.[0];
  const fieldColor = FIELD_COLOR[c.scoring_field] ?? "#9aabb8";
  const isOpen = c.status === "open";

  return (
    <div style={{
      background: "#111827",
      border: "1px solid #1f2937",
      borderTop: `3px solid ${isOpen ? "#E6C36B" : "#374151"}`,
      borderRadius: 16, padding: "22px 20px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
    }}>

      {/* Top row */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
        {/* Status dot + title */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: isOpen ? "rgba(196,153,60,0.12)" : "#1a1a2e",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${isOpen ? "rgba(196,153,60,0.3)" : "#374151"}`,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: "50%",
            background: isOpen ? "#E6C36B" : "#c0b8ae",
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 15, lineHeight: 1.25, marginBottom: 6 }}>
            {c.title}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              background: `${fieldColor}14`, color: fieldColor,
              border: `1px solid ${fieldColor}30`,
              borderRadius: 5, padding: "2px 9px", fontSize: 10, fontWeight: 600,
            }}>
              {FIELD_LABELS[c.scoring_field] ?? c.scoring_field}
            </span>
            <span style={{
              background: isOpen ? "rgba(74,184,122,0.1)" : "#1a1a2e",
              color:      isOpen ? "#4ab87a" : "#9aabb8",
              border: `1px solid ${isOpen ? "rgba(74,184,122,0.25)" : "#374151"}`,
              borderRadius: 5, padding: "2px 9px", fontSize: 10, fontWeight: 600,
            }}>
              {isOpen ? "open" : "closed"}
            </span>
          </div>
        </div>

        {/* Reward badge */}
        <div style={{
          flexShrink: 0,
          background: "#451a03",
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
          background: "#0d1117", border: "1px solid #1f2937",
          borderRadius: 10, padding: "10px 13px", marginBottom: 14,
        }}>
          <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 7, fontWeight: 600 }}>Top Pipeline</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 13 }}>
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
          background: "#0d1117", border: "1px solid #1f2937",
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
            background: isOpen ? "rgba(139,111,212,0.1)" : "#1a1a2e",
            color:      isOpen ? "#B59CE6" : "#6b7280",
            border: `1px solid ${isOpen ? "rgba(139,111,212,0.3)" : "#374151"}`,
          }}>
          {submitting ? "Cancel" : "Submit Pipeline"}
        </button>
        <button onClick={() => onBoard(c.id)} style={{
          flex: 1, borderRadius: 10, padding: "9px",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          background: boardOpen ? "rgba(74,159,212,0.1)" : "#1a1a2e",
          color: boardOpen ? "#6BB6E6" : "#9aabb8",
          border: `1px solid ${boardOpen ? "rgba(74,159,212,0.3)" : "#374151"}`,
        }}>
          {boardOpen ? "Hide Board" : "Leaderboard"}
        </button>
      </div>

      {/* Pipeline picker */}
      {submitting && (
        <div style={{
          background: "#0d1117", border: "1px solid #1f2937",
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
            <div key={p.id} onClick={async () => { setSubmitting(false); const r = await onSubmit(c.id, p.id); if (r) setLastResult({ score: r.score, latency_ms: r.latency_ms }); }}
              style={{
                padding: "8px 11px", borderRadius: 8, marginBottom: 5, cursor: "pointer",
                background: "#1a1a2e", border: "1px solid #374151",
                color: "#9ca3af", fontSize: 12,
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#B59CE6"; e.currentTarget.style.color = "#B59CE6"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#374151"; e.currentTarget.style.color = "#9ca3af"; }}>
              {p.name}
            </div>
          ))}
        </div>
      )}

      {/* Submit result flash */}
      {lastResult && (
        <div style={{
          background: "rgba(107,207,139,0.08)", border: "1px solid rgba(107,207,139,0.25)",
          borderRadius: 9, padding: "9px 13px", marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ color: "#6BCF8B", fontSize: 12, fontWeight: 700 }}>
            Submitted! Score: {lastResult.score}
          </span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }}>
            {lastResult.latency_ms != null ? `${lastResult.latency_ms}ms` : ""}
          </span>
        </div>
      )}

      {/* Full leaderboard */}
      {boardOpen && (
        <div style={{ borderTop: "1px solid #1f2937", paddingTop: 14, marginTop: 4 }}>
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
              background: i === 0 ? "rgba(196,153,60,0.08)" : "#1a1a2e",
              border: `1px solid ${i === 0 ? "rgba(196,153,60,0.25)" : "#1f2937"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RankBadge rank={i + 1} />
                <div>
                  <span style={{ color: "#e5e7eb", fontWeight: i === 0 ? 700 : 500, fontSize: 13 }}>
                    {entry.pipeline_name}
                  </span>
                  {entry.total_latency_ms != null && (
                    <div style={{ color: "#9aabb8", fontSize: 9, fontFamily: "monospace", marginTop: 1 }}>
                      {entry.total_latency_ms}ms
                    </div>
                  )}
                </div>
              </div>
              <span style={{
                color: i === 0 ? "#E6C36B" : "#9aabb8",
                fontWeight: 700, fontSize: 12,
                background: "#0d1117", borderRadius: 5, padding: "2px 8px",
                border: "1px solid #1f2937",
              }}>
                {typeof entry.score === "number" ? entry.score.toFixed(4) : entry.score}
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
  const [form,    setForm]    = useState({ title: "", description: "", reward: 100, scoring_field: "confidence" });
  const [busy,    setBusy]    = useState(false);
  const [formErr, setFormErr] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePost = async () => {
    if (!form.title.trim()) { setFormErr("Mission title is required."); return; }
    setBusy(true); setFormErr("");
    await onPost(form, setFormErr);
    setBusy(false);
  };

  return (
    <div style={{
      background: "#111827",
      border: "1px solid #1f2937",
      borderTop: "3px solid #8b5cf6",
      borderRadius: 16, padding: "22px 20px", maxWidth: 560, marginBottom: 28,
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    }}>
      <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 15, marginBottom: 16 }}>
        Post New Mission
      </div>
      <input placeholder="Mission title *" value={form.title}
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
      {formErr && (
        <div style={{ background: "#450a0a", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>{formErr}</div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handlePost} disabled={busy} style={{
          flex: 1, background: busy ? "#374151" : "#6366f1", color: "#fff",
          border: "none", borderRadius: 9,
          padding: "9px", fontSize: 13, cursor: busy ? "default" : "pointer", fontWeight: 700,
        }}>{busy ? "Posting…" : "Post Mission"}</button>
        <button onClick={onCancel} style={{
          flex: 1, background: "transparent", color: "#9ca3af",
          border: "1px solid #374151", borderRadius: 9,
          padding: "9px", fontSize: 13, cursor: "pointer", fontWeight: 600,
        }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ChallengesView() {
  const { token } = useAuth();
  const [challenges,   setChallenges]   = useState([]);
  const [pipelines,    setPipelines]    = useState([]);
  const [leaderboards, setLeaderboards] = useState({});
  const [openBoard,    setOpenBoard]    = useState(null);
  const [showForm,     setShowForm]     = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [c, p] = await Promise.all([
        fetch(`${API}/challenges`).then((r) => r.json()),
        fetch(`${API}/pipelines`).then((r) => r.json()),
      ]);
      setChallenges(Array.isArray(c) ? c : []);
      setPipelines(Array.isArray(p) ? p : []);
    } catch { setLoadError(true); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadBoard = async (id) => {
    try {
      const res = await fetch(`${API}/challenges/${id}/leaderboard`);
      const rows = res.ok ? await res.json() : [];
      setLeaderboards((p) => ({ ...p, [id]: Array.isArray(rows) ? rows : [] }));
    } catch {
      setLeaderboards((p) => ({ ...p, [id]: [] }));
    }
  };

  const postChallenge = async (form, setFormErr) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFormErr?.(d.detail || "Failed to post mission — try again.");
        return;
      }
      const saved = await res.json();
      setChallenges((c) => [...c, saved]);
      setShowForm(false);
    } catch {
      setFormErr?.("Could not reach the server — check your connection.");
    }
  };

  const submit = async (challengeId, pipelineId) => {
    if (!token) { alert("Sign in to submit a pipeline to a challenge."); return null; }
    try {
      const res = await fetch(`${API}/challenges/${challengeId}/submit/${pipelineId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : null;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Submission failed — try again.");
        return null;
      }
      loadBoard(challengeId);
      setOpenBoard(challengeId);
      return data;
    } catch {
      loadBoard(challengeId);
      setOpenBoard(challengeId);
      return null;
    }
  };

  const toggleBoard = (id) => {
    const next = openBoard === id ? null : id;
    setOpenBoard(next);
    if (next) loadBoard(next);
  };

  return (
    <div style={{
      height: "100%", overflowY: "auto",
      background: "#0a0a0f", padding: "clamp(16px,5vw,32px) clamp(14px,5vw,40px)",
      fontFamily: "inherit",
    }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <PlazaTree size={36} />
          <div>
            <div style={{ color: "#f9fafb", fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>
              Missions
            </div>
            <div style={{ color: "#9aabb8", fontSize: 13, marginTop: 5, lineHeight: 1.5 }}>
              Compete to build the best AI pipeline. Top score wins the reward.
            </div>
          </div>
          <PlazaTree size={26} />
        </div>
        {token && (
          <button onClick={() => setShowForm((v) => !v)} style={{
            background: showForm ? "rgba(99,102,241,0.1)" : "rgba(196,153,60,0.1)",
            color:      showForm ? "#818cf8" : "#E6C36B",
            border: `1px solid ${showForm ? "rgba(99,102,241,0.3)" : "rgba(196,153,60,0.3)"}`,
            borderRadius: 20, padding: "9px 20px", fontSize: 13,
            cursor: "pointer", fontWeight: 700,
          }}>
            {showForm ? "Cancel" : "+ Post Mission"}
          </button>
        )}
      </div>

      {/* How it works */}
      <div style={{
        background: "#111827", border: "1px solid #1f2937", borderRadius: 12,
        padding: "14px 18px", marginBottom: 24,
        display: "flex", gap: 24, flexWrap: "wrap",
      }}>
        {[
          ["1. Pick a mission", "Each mission has a goal — like getting the highest confidence score or detecting volatility."],
          ["2. Build a pipeline", "Go to Playground or Pipeline Builder, chain agents together, and save it."],
          ["3. Submit & compete", "Come back here, click Submit Pipeline, and select your saved pipeline. The highest score wins."],
        ].map(([title, body]) => (
          <div key={title} style={{ flex: "1 1 180px" }}>
            <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{title}</div>
            <div style={{ color: "#9aabb8", fontSize: 11, lineHeight: 1.6 }}>{body}</div>
          </div>
        ))}
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

        {loading && challenges.length === 0 && (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 14, padding: "22px 20px", minHeight: 160, opacity: 0.5 + i * 0.1 }}>
              <div style={{ height: 14, borderRadius: 4, background: "#1f2937", width: "60%", marginBottom: 10 }} />
              <div style={{ height: 10, borderRadius: 4, background: "#1a1a2e", width: "85%", marginBottom: 6 }} />
              <div style={{ height: 10, borderRadius: 4, background: "#1a1a2e", width: "70%" }} />
            </div>
          ))
        )}
        {!loading && loadError && (
          <div style={{
            background: "#0d1117", border: "1px dashed #7f1d1d", borderRadius: 14,
            padding: "48px 32px", color: "#f87171", fontSize: 14,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span>Could not load missions.</span>
            <button onClick={load} style={{ background: "none", border: "1px solid #7f1d1d", color: "#f87171", borderRadius: 8, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Retry</button>
          </div>
        )}
        {!loading && !loadError && challenges.length === 0 && !showForm && (
          <div style={{
            background: "#0d1117", border: "1px dashed #1f2937", borderRadius: 14,
            padding: "48px 32px", color: "#9ca3af", fontSize: 14, fontStyle: "italic",
          }}>
            No missions posted yet — be the first to create a challenge.
          </div>
        )}
      </div>
    </div>
  );
}
