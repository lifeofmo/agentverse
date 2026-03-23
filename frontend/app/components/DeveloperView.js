"use client";

import { useEffect, useState, useMemo } from "react";

import { API } from "@/app/lib/config";
import { useToast } from "@/app/components/Toast";

const CAT = {
  trading:      { border: "#6BCF8B", letter: "T" },
  analysis:     { border: "#B59CE6", letter: "A" },
  data:         { border: "#6BB6E6", letter: "D" },
  risk:         { border: "#E67B7B", letter: "R" },
  composite:    { border: "#E6C36B", letter: "C" },
  productivity: { border: "#a78bfa", letter: "P" },
  automation:   { border: "#f472b6", letter: "⚙" },
  creative:     { border: "#fb923c", letter: "✦" },
  research:     { border: "#38bdf8", letter: "R" },
  web:          { border: "#4ade80", letter: "W" },
  experimental: { border: "#FF6B35", letter: "X" },
  default:      { border: "#9aabb8", letter: "·" },
};
const cat = (c) => CAT[c] ?? CAT.default;

const FIELD = {
  width: "100%", border: "1px solid #374151", borderRadius: 8,
  padding: "7px 10px", fontSize: 12, outline: "none",
  fontFamily: "inherit", background: "#1f2937", color: "#f3f4f6",
  boxSizing: "border-box",
};
const BTN = (color = "#6366f1", disabled = false) => ({
  background: disabled ? "#374151" : color, color: "#fff", border: "none",
  borderRadius: 9, padding: "9px 18px", fontSize: 12, fontWeight: 700,
  cursor: disabled ? "default" : "pointer", fontFamily: "inherit", opacity: disabled ? 0.6 : 1,
});

/* ── Reputation tier ──────────────────────────────────────────────────────── */

const REP_TIER = (r) =>
  r >= 4.5 ? { label: "Elite",  color: "#f59e0b" } :
  r >= 3.5 ? { label: "Pro",    color: "#818cf8" } :
  r >= 2.5 ? { label: "Active", color: "#34d399" } :
             { label: "New",    color: "#9aabb8" };

function RepBadge({ reputation }) {
  const tier = REP_TIER(reputation || 0);
  return (
    <span style={{ padding: "1px 7px", borderRadius: 20, background: `${tier.color}22`, color: tier.color, fontSize: 9, fontWeight: 800, border: `1px solid ${tier.color}44`, letterSpacing: 0.4 }}>
      {tier.label}
    </span>
  );
}

/* ── Tiny helpers ─────────────────────────────────────────────────────────── */

function Label({ children }) {
  return <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{children}</div>;
}

function CatDot({ category, size = 30 }) {
  const c = cat(category);
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0, background: c.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: Math.round(size * 0.46), fontWeight: 800 }}>
      {c.letter}
    </div>
  );
}

function Pill({ label, value, color = "#6366f1" }) {
  return (
    <div style={{ background: `${color}0f`, border: `1px solid ${color}30`, borderRadius: 10, padding: "10px 16px", minWidth: 100 }}>
      <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{label}</div>
      <div style={{ color, fontWeight: 800, fontSize: 18 }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { active: ["#064e3b30", "#34d399"], degraded: ["#451a0330", "#fbbf24"], offline: ["#7f1d1d30", "#f87171"], pending: ["#1e3a5f30", "#60a5fa"] };
  const [bg, fg] = map[status] ?? map.pending;
  return <span style={{ padding: "2px 10px", borderRadius: 20, background: bg, color: fg, fontSize: 10, fontWeight: 700 }}>{status ?? "unknown"}</span>;
}

/* ── Auth forms ───────────────────────────────────────────────────────────── */

function AuthPanel({ onAuth }) {
  const [mode, setMode]         = useState("login");  // "login" | "register" | "forgot" | "reset"
  const [form, setForm]         = useState({ email: "", username: "", password: "", resetToken: "", newPassword: "" });
  const [busy, setBusy]         = useState(false);
  const [err,  setErr]          = useState("");
  const [ok,   setOk]           = useState("");
  const [worldVerified, setWorldVerified] = useState(null); // nullifier_hash when verified
  const [verifying, setVerifying]         = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const verifyWithWorld = async () => {
    const { MiniKit, VerificationLevel } = await import("@worldcoin/minikit-js");
    if (!MiniKit.isInstalled()) {
      setErr("Open AgentVerse inside World App to verify your identity.");
      return;
    }
    setVerifying(true); setErr("");
    try {
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: process.env.NEXT_PUBLIC_WLD_ACTION || "register_developer",
        verification_level: VerificationLevel.Device,
      });
      if (finalPayload.status === "error") {
        setErr("World ID verification cancelled.");
        return;
      }
      const res = await fetch("/api/verify-worldid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proof: finalPayload,
          action: process.env.NEXT_PUBLIC_WLD_ACTION || "register_developer",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWorldVerified(data.nullifier_hash);
        setOk("World ID verified! You're confirmed as a unique human.");
      } else {
        setErr(data.error || "Verification failed.");
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setVerifying(false);
    }
  };

  const submit = async () => {
    setBusy(true); setErr(""); setOk("");
    try {
      if (mode === "forgot") {
        const res = await fetch(`${API}/auth/forgot-password`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email }),
        });
        const data = await res.json();
        // Show the reset token (in prod this would be emailed)
        if (data.reset_token) {
          setOk(`Reset token: ${data.reset_token}\n\nCopy this token, then click "Enter reset token" below.`);
        } else {
          setOk(data.message || "Check your email for a reset link.");
        }
        return;
      }
      if (mode === "reset") {
        const res = await fetch(`${API}/auth/reset-password`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: form.resetToken, new_password: form.newPassword }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed"); }
        setOk("Password updated! You can now sign in.");
        setTimeout(() => { setMode("login"); setOk(""); }, 2000);
        return;
      }
      const body = mode === "login"
        ? { email: form.email, password: form.password }
        : { email: form.email, username: form.username, password: form.password, world_nullifier: worldVerified };
      const res = await fetch(`${API}/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed"); }
      const data = await res.json();
      localStorage.setItem("av_token", data.token);
      localStorage.setItem("av_user", JSON.stringify({ id: data.user_id, username: data.username, wallet_id: data.wallet_id }));
      onAuth(data);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const titles = { login: "Sign in to Developer Hub", register: "Create Developer Account", forgot: "Reset Password", reset: "Set New Password" };
  const subs   = { login: "Access your agents, keys, and revenue.", register: "Start publishing agents to AgentVerse.", forgot: "Enter your email and we'll generate a reset token.", reset: "Enter your reset token and choose a new password." };

  return (
    <div style={{ maxWidth: 360, margin: "0 auto", background: "#111827", borderRadius: 16, padding: "28px 28px", border: "1px solid #1f2937", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
      <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{titles[mode]}</div>
      <div style={{ color: "#9aabb8", fontSize: 12, marginBottom: 20 }}>{subs[mode]}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(mode === "login" || mode === "register" || mode === "forgot") && (
          <div><Label>{mode === "login" ? "Email or Username" : "Email"}</Label><input value={form.email} onChange={e => set("email", e.target.value)} placeholder={mode === "login" ? "email or username" : "you@example.com"} style={FIELD} /></div>
        )}
        {mode === "register" && (
          <div><Label>Username</Label><input value={form.username} onChange={e => set("username", e.target.value)} placeholder="devname" style={FIELD} /></div>
        )}
        {(mode === "login" || mode === "register") && (
          <div><Label>Password</Label><input type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="••••••••" style={FIELD} onKeyDown={e => e.key === "Enter" && submit()} /></div>
        )}
        {mode === "reset" && (<>
          <div><Label>Reset Token</Label><input value={form.resetToken} onChange={e => set("resetToken", e.target.value)} placeholder="Paste token here" style={FIELD} /></div>
          <div><Label>New Password</Label><input type="password" value={form.newPassword} onChange={e => set("newPassword", e.target.value)} placeholder="••••••••" style={FIELD} onKeyDown={e => e.key === "Enter" && submit()} /></div>
        </>)}
        {mode === "register" && (
          <div style={{ fontSize: 11, color: "#4b5563", background: "#111827", border: "1px solid #1f2937", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🌐</span>
            <span>World ID verification <strong style={{ color: "#6b7280" }}>coming soon</strong> — pending approval</span>
          </div>
        )}
        {err && <div style={{ color: "#fca5a5", fontSize: 11, background: "#450a0a", border: "1px solid #ef4444", borderRadius: 7, padding: "6px 10px" }}>{err}</div>}
        {ok  && <div style={{ color: "#6ee7b7", fontSize: 11, background: "#064e3b20", border: "1px solid #064e3b80", borderRadius: 7, padding: "8px 10px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{ok}</div>}
        <button onClick={submit} disabled={busy} style={{ ...BTN("#6366f1", busy), marginTop: 4 }}>
          {busy ? "…" : { login: "Sign In", register: "Create Account", forgot: "Send Reset Token", reset: "Set New Password" }[mode]}
        </button>
        <div style={{ textAlign: "center", color: "#9aabb8", fontSize: 11, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {mode === "login" && (<>
            <span>No account? <span style={{ color: "#818cf8", cursor: "pointer", fontWeight: 700 }} onClick={() => { setMode("register"); setErr(""); setOk(""); }}>Register</span></span>
            <span>·</span>
            <span style={{ color: "#818cf8", cursor: "pointer", fontWeight: 700 }} onClick={() => { setMode("forgot"); setErr(""); setOk(""); }}>Forgot password?</span>
          </>)}
          {mode === "register" && (
            <span>Have an account? <span style={{ color: "#818cf8", cursor: "pointer", fontWeight: 700 }} onClick={() => { setMode("login"); setErr(""); setOk(""); }}>Sign in</span></span>
          )}
          {mode === "forgot" && (<>
            <span style={{ color: "#818cf8", cursor: "pointer", fontWeight: 700 }} onClick={() => { setMode("reset"); setErr(""); setOk(""); }}>Enter reset token →</span>
            <span>·</span>
            <span style={{ color: "#818cf8", cursor: "pointer", fontWeight: 700 }} onClick={() => { setMode("login"); setErr(""); setOk(""); }}>Back to sign in</span>
          </>)}
          {mode === "reset" && (
            <span style={{ color: "#818cf8", cursor: "pointer", fontWeight: 700 }} onClick={() => { setMode("login"); setErr(""); setOk(""); }}>Back to sign in</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── API Key manager ──────────────────────────────────────────────────────── */

function ApiKeyManager({ token }) {
  const [keys, setKeys]       = useState([]);
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey]   = useState(null);
  const [busy, setBusy]       = useState(false);

  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  const load = () => fetch(`${API}/auth/api-keys`, { headers }).then(r => r.json()).then(setKeys).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/create-api-key`, { method: "POST", headers, body: JSON.stringify({ name: newName }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.detail || "Failed to create key"); return; }
      const d = await res.json();
      setNewKey(d.key);
      setNewName("");
      load();
    } catch { alert("Network error — could not create key"); }
    finally { setBusy(false); }
  };

  const revoke = async (id) => {
    try {
      const res = await fetch(`${API}/auth/api-keys/${id}`, { method: "DELETE", headers });
      if (!res.ok) { alert("Could not revoke key — try again"); return; }
      setKeys(k => k.filter(x => x.id !== id));
    } catch { alert("Network error — could not revoke key"); }
  };

  return (
    <div>
      <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14, marginBottom: 14 }}>API Keys</div>
      {newKey && (
        <div style={{ background: "#064e3b20", border: "1px solid #064e3b80", borderRadius: 9, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ color: "#34d399", fontWeight: 700, fontSize: 11, marginBottom: 4 }}>🔑 New key — save it now, it won't be shown again.</div>
          <code style={{ fontSize: 11, wordBreak: "break-all", color: "#6ee7b7" }}>{newKey}</code>
          <button onClick={() => { navigator.clipboard.writeText(newKey); }} style={{ marginLeft: 10, fontSize: 10, padding: "2px 8px", borderRadius: 6, border: "1px solid #064e3b80", background: "transparent", cursor: "pointer", color: "#34d399", fontWeight: 700 }}>Copy</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Key name (e.g. Production)" style={{ ...FIELD, flex: 1 }} onKeyDown={e => e.key === "Enter" && create()} />
        <button onClick={create} disabled={busy} style={BTN("#6366f1", busy)}>+ Create</button>
      </div>
      {keys.length === 0 ? (
        <div style={{ color: "#9aabb8", fontSize: 12, fontStyle: "italic" }}>No API keys yet.</div>
      ) : keys.map(k => (
        <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#1a1a2e", borderRadius: 8, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6BCF8B", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f3f4f6", fontWeight: 700, fontSize: 12 }}>{k.name}</div>
            <div style={{ color: "#9aabb8", fontSize: 10 }}>Created {k.created_at?.slice(0, 10)} · Last used {k.last_used?.slice(0, 10) ?? "never"}</div>
          </div>
          <button onClick={() => revoke(k.id)} style={{ background: "none", border: "1px solid #374151", color: "#E67B7B", borderRadius: 6, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>Revoke</button>
        </div>
      ))}
      <div style={{ marginTop: 12, padding: "10px 14px", background: "#0c1a2e", borderRadius: 8, border: "1px solid #6BB6E640" }}>
        <div style={{ color: "#38bdf8", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>Using your API key</div>
        <code style={{ color: "#818cf8", fontSize: 10 }}>Authorization: ApiKey av_your_key_here</code>
      </div>
    </div>
  );
}

/* ── Agent registration form ──────────────────────────────────────────────── */

const CATS = ["trading", "analysis", "data", "risk", "composite", "productivity", "automation", "creative", "research", "web", "experimental"];
const EMPTY = { name: "", description: "", category: "trading", endpoint: "", price_per_request: "0.001", health_endpoint: "", owner_wallet: "" };

function RegisterForm({ token, onDone }) {
  const [form,     setForm]     = useState(EMPTY);
  const [busy,     setBusy]     = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [testRes,  setTestRes]  = useState(null);  // { ok, body }
  const [err,      setErr]      = useState("");
  const [ok,       setOk]       = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const testEndpoint = async () => {
    if (!form.endpoint.trim()) { setErr("Enter an endpoint URL first."); return; }
    if (!token) { setErr("Sign in first to test an endpoint."); return; }
    setTesting(true); setTestRes(null); setErr("");
    try {
      // Proxy through backend to avoid CORS restrictions
      const res = await fetch(`${API}/developer/test-endpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: form.endpoint }),
      });
      const d = await res.json().catch(() => ({ ok: false, error: "Invalid response from server" }));
      setTestRes(d);
    } catch (e) {
      setTestRes({ ok: false, status: 0, error: e.message });
    } finally { setTesting(false); }
  };

  const submit = async () => {
    if (!form.name.trim() || !form.endpoint.trim()) { setErr("Name and Endpoint are required."); return; }
    setBusy(true); setErr(""); setOk("");
    try {
      const headers = token
        ? { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        : { "Content-Type": "application/json" };
      const url = token ? `${API}/developer/agents` : `${API}/agents`;
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ ...form, price_per_request: parseFloat(form.price_per_request) || 0 }) });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      const d = await res.json();
      setOk(`Live! Agent deployed as "${d.name}" (${d.status ?? "active"}). It will appear in the marketplace and city immediately.`);
      setForm(EMPTY); setTestRes(null);
      onDone?.();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ color: "#9aabb8", fontSize: 12, marginBottom: 4 }}>
        Any HTTP endpoint becomes a monetizable agent. Paste your URL, test it, then deploy — it will appear in the marketplace, Playground, and Agent City instantly.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ gridColumn: "1/-1" }}><Label>Agent Name *</Label><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Article Summarizer" style={FIELD} /></div>
        <div><Label>Category</Label>
          <select value={form.category} onChange={e => set("category", e.target.value)} style={{ ...FIELD, appearance: "none" }}>
            {CATS.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div><Label>Price / Call ($)</Label><input type="number" step="0.001" min="0" value={form.price_per_request} onChange={e => set("price_per_request", e.target.value)} style={FIELD} /></div>
        <div style={{ gridColumn: "1/-1" }}>
          <Label>Endpoint URL * — where AgentVerse sends POST requests</Label>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={form.endpoint} onChange={e => { set("endpoint", e.target.value); setTestRes(null); }} placeholder="https://your-agent.example.com/run" style={{ ...FIELD, flex: 1 }} />
            <button onClick={testEndpoint} disabled={testing || !form.endpoint.trim()} style={{ ...BTN("#374151", testing || !form.endpoint.trim()), padding: "7px 14px", fontSize: 11, flexShrink: 0, border: "1px solid #4b5563" }}>
              {testing ? "Testing…" : "Test ↗"}
            </button>
          </div>
          {testRes && (
            <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: testRes.ok ? "#064e3b20" : "#450a0a30", border: `1px solid ${testRes.ok ? "#34d39940" : "#ef444440"}`, fontSize: 11 }}>
              <div style={{ color: testRes.ok ? "#34d399" : "#f87171", fontWeight: 700, marginBottom: 4 }}>
                {testRes.ok ? `✓ Endpoint responded (${testRes.status})` : testRes.status === 0 ? "✗ Could not reach endpoint" : `⚠ Responded with ${testRes.status}`}
              </div>
              {testRes.body && <pre style={{ color: "#9aabb8", margin: 0, fontSize: 10, whiteSpace: "pre-wrap", maxHeight: 80, overflow: "auto" }}>{JSON.stringify(testRes.body, null, 2)}</pre>}
              {testRes.error && <div style={{ color: "#f87171", fontSize: 10 }}>{testRes.error}</div>}
            </div>
          )}
        </div>
        <div style={{ gridColumn: "1/-1" }}><Label>Description</Label><textarea rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder="What does this agent do? What input does it expect?" style={{ ...FIELD, resize: "vertical" }} /></div>
        <div style={{ gridColumn: "1/-1" }}><Label>Health Endpoint (optional)</Label><input value={form.health_endpoint} onChange={e => set("health_endpoint", e.target.value)} placeholder="https://your-agent.example.com/health" style={FIELD} /></div>
        <div style={{ gridColumn: "1/-1" }}>
          <Label>ETH Wallet Address (optional — enables on-chain USDC payments)</Label>
          <input value={form.owner_wallet} onChange={e => set("owner_wallet", e.target.value)} placeholder="0x… your EVM-compatible address" style={FIELD} />
          <div style={{ color: "#9aabb8", fontSize: 10, marginTop: 3 }}>Callers pay you directly in USDC on World Chain / Base. Leave blank to use the internal credit system.</div>
        </div>
      </div>
      {err && <div style={{ color: "#fca5a5", fontSize: 11, background: "#450a0a", border: "1px solid #ef4444", borderRadius: 7, padding: "6px 10px" }}>{err}</div>}
      {ok  && <div style={{ color: "#6ee7b7", fontSize: 11, background: "#064e3b20", border: "1px solid #064e3b80", borderRadius: 7, padding: "6px 10px" }}>{ok}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={submit} disabled={busy} style={BTN("#6366f1", busy)}>{busy ? "Deploying…" : "Deploy Agent →"}</button>
      </div>
    </div>
  );
}

/* ── Agent row + detail ───────────────────────────────────────────────────── */

function AgentRow({ agent, metrics, selected, onClick }) {
  const m = metrics || {};
  const c = cat(agent.category);
  const on = selected?.id === agent.id;
  return (
    <div onClick={() => onClick(agent)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: on ? `${c.border}18` : "transparent", borderLeft: on ? `3px solid ${c.border}` : "3px solid transparent", borderRadius: 8, transition: "background 0.12s" }}
      onMouseEnter={e => { if (!on) e.currentTarget.style.background = "#1f2937"; }}
      onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}>
      <CatDot category={agent.category} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#f3f4f6", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
          <span style={{ color: "#9aabb8", fontSize: 10 }}>${agent.price_per_request} / call</span>
          {agent.reputation != null && <RepBadge reputation={agent.reputation} />}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color: "#f3f4f6", fontWeight: 700, fontSize: 12 }}>{m.requests || 0}</div>
        <div style={{ color: c.border, fontSize: 10, fontWeight: 700 }}>${(m.earnings || 0).toFixed(4)}</div>
      </div>
    </div>
  );
}

function AgentDetail({ agent, metrics, pipelines, token, onHealthCheck, onDeleted, onUpdated }) {
  const m = metrics || {};
  const c = cat(agent.category);
  const [checking,   setChecking]   = useState(false);
  const [health,     setHealth]     = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [editForm,   setEditForm]   = useState({ name: agent.name, description: agent.description || "", price_per_request: String(agent.price_per_request), health_endpoint: agent.health_endpoint || "" });
  const [saving,     setSaving]     = useState(false);
  const [editErr,    setEditErr]    = useState("");
  const setEF = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      const headers = token ? { "Authorization": `Bearer ${token}` } : {};
      const res = await fetch(`${API}/agents/${agent.id}`, { method: "DELETE", headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setEditErr(err.detail || "Delete failed — you may not own this agent.");
        setConfirmDel(false);
        return;
      }
      onDeleted?.();
    } catch { setEditErr("Network error — could not delete agent."); }
    finally { setDeleting(false); setConfirmDel(false); }
  };

  const handleSaveEdit = async () => {
    setSaving(true); setEditErr("");
    try {
      const headers = { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) };
      const body = { name: editForm.name, description: editForm.description, price_per_request: parseFloat(editForm.price_per_request) || 0, health_endpoint: editForm.health_endpoint };
      const res = await fetch(`${API}/agents/${agent.id}`, { method: "PATCH", headers, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Update failed"); }
      setEditing(false);
      onUpdated?.();
    } catch (e) { setEditErr(e.message); }
    finally { setSaving(false); }
  };

  const checkHealth = async () => {
    setChecking(true);
    try {
      const headers = token ? { "Authorization": `Bearer ${token}` } : {};
      const res = await fetch(`${API}/agents/${agent.id}/health`, { headers });
      const d = await res.json().catch(() => ({ status: "error", message: "Invalid response" }));
      setHealth(res.ok ? d : { status: "error", message: d.detail || "Health check failed" });
      onHealthCheck?.();
    } catch { setHealth({ status: "error", message: "Network error — agent unreachable" }); }
    finally { setChecking(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <CatDot category={agent.category} size={44} />
        <div style={{ flex: 1 }}>
          <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 18 }}>{agent.name}</div>
          <span style={{ display: "inline-block", marginTop: 3, background: `${c.border}18`, color: c.border, borderRadius: 4, padding: "1px 8px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{agent.category}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <StatusBadge status={health?.status ?? agent.status} />
          <button onClick={checkHealth} disabled={checking} style={{ ...BTN("#9aabb8", checking), padding: "5px 12px", fontSize: 10 }}>
            {checking ? "Checking…" : "Check Health"}
          </button>
          {token && (
            <button onClick={() => { setEditing(e => !e); setEditErr(""); }} style={{
              ...BTN("transparent", false), padding: "5px 12px", fontSize: 10,
              color: editing ? "#818cf8" : "#9aabb8",
              border: `1px solid ${editing ? "#818cf840" : "#374151"}`,
            }}>
              {editing ? "Cancel" : "Edit"}
            </button>
          )}
          {token && (
            <button onClick={handleDelete} disabled={deleting} style={{
              ...BTN(confirmDel ? "#dc2626" : "transparent", deleting),
              padding: "5px 12px", fontSize: 10,
              color: confirmDel ? "#fff" : "#9aabb8",
              border: `1px solid ${confirmDel ? "#dc2626" : "#374151"}`,
            }}>
              {deleting ? "Removing…" : confirmDel ? "Confirm remove" : "Undeploy"}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ background: "#1a1a2e", border: "1px solid #374151", borderRadius: 12, padding: "14px 16px", marginBottom: 18 }}>
          <div style={{ color: "#818cf8", fontSize: 11, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Edit Agent</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ gridColumn: "1/-1" }}><Label>Name</Label><input value={editForm.name} onChange={e => setEF("name", e.target.value)} style={FIELD} /></div>
            <div><Label>Price / Call ($)</Label><input type="number" step="0.001" min="0" value={editForm.price_per_request} onChange={e => setEF("price_per_request", e.target.value)} style={FIELD} /></div>
            <div><Label>Health Endpoint</Label><input value={editForm.health_endpoint} onChange={e => setEF("health_endpoint", e.target.value)} placeholder="https://…/health" style={FIELD} /></div>
            <div style={{ gridColumn: "1/-1" }}><Label>Description</Label><textarea rows={2} value={editForm.description} onChange={e => setEF("description", e.target.value)} style={{ ...FIELD, resize: "vertical" }} /></div>
          </div>
          {editErr && <div style={{ color: "#fca5a5", fontSize: 11, marginTop: 6 }}>{editErr}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={handleSaveEdit} disabled={saving} style={BTN("#6366f1", saving)}>{saving ? "Saving…" : "Save Changes"}</button>
          </div>
        </div>
      )}

      {health && (
        <div style={{ background: health.status === "active" ? "#064e3b20" : "#7f1d1d20", border: `1px solid ${health.status === "active" ? "#064e3b60" : "#7f1d1d60"}`, borderRadius: 8, padding: "8px 12px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: health.status === "active" ? "#34d399" : "#f87171" }}>
            {health.status === "active" ? "✓ Online" : "✗ Unreachable"} — {health.latency_ms}ms
          </span>
          <span style={{ fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{health.endpoint}</span>
        </div>
      )}

      {/* Payment type strip */}
      {(() => {
        const isX402 = agent.owner_wallet?.startsWith("0x") && agent.owner_wallet?.length === 42;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 12px", borderRadius: 9, background: isX402 ? "#2e106520" : "#1e3a5f20", border: `1px solid ${isX402 ? "#7c3aed40" : "#1e40af40"}` }}>
            <span style={{ fontSize: 16 }}>{isX402 ? "⚡" : "💳"}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: isX402 ? "#c084fc" : "#60a5fa" }}>
                {isX402 ? "x402 USDC Payments" : "Credits (simulated)"}
              </div>
              <div style={{ fontSize: 10, color: "#9aabb8", marginTop: 1 }}>
                {isX402
                  ? `Callers pay $${agent.price_per_request} USDC on Base. Lands in your wallet directly.`
                  : `Callers spend ${Math.round(agent.price_per_request * 100)} credits per call. Add a Base wallet to enable real payments.`}
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
        {[
          ["Total Calls",  m.requests || 0,                                        "#6366f1"],
          ["Earnings",     `$${(m.earnings || 0).toFixed(4)}`,                    "#6BCF8B"],
          ["Avg Latency",  m.avg_latency_ms ? `${m.avg_latency_ms}ms` : "—",      "#B59CE6"],
          ["Success Rate", m.success_rate != null ? `${(m.success_rate * 100).toFixed(1)}%` : "—", "#E6C36B"],
        ].map(([k, v, color]) => (
          <div key={k} style={{ background: "#1a1a2e", borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 }}>{k}</div>
            <div style={{ color, fontWeight: 800, fontSize: 16 }}>{String(v)}</div>
          </div>
        ))}
      </div>

      <div style={{ background: `${c.border}0c`, border: `1px solid ${c.border}30`, borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#9aabb8", fontSize: 11 }}>Gross revenue (calls × price)</div>
        <div style={{ color: c.border, fontWeight: 800, fontSize: 15 }}>${((m.requests || 0) * agent.price_per_request).toFixed(4)}</div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ color: "#9aabb8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Used in Pipelines</div>
        {pipelines.length === 0 ? (
          <div style={{ color: "#c0ccd8", fontSize: 12, fontStyle: "italic", background: "#1a1a2e", borderRadius: 8, padding: "12px 14px" }}>Not used in any pipeline yet.</div>
        ) : pipelines.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#1a1a2e", borderRadius: 8, marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />
            <div style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 13 }}>{p.name}</div>
            <div style={{ color: "#9aabb8", fontSize: 10, marginLeft: "auto" }}>{p.agent_ids?.length ?? "?"} agents</div>
          </div>
        ))}
      </div>

      {agent.description && (
        <div style={{ color: "#9aabb8", fontSize: 12, lineHeight: 1.6, padding: "10px 14px", background: "#1a1a2e", borderRadius: 8, marginTop: 10 }}>{agent.description}</div>
      )}

      {/* Public page + call snippet */}
      <div style={{ marginTop: 20, background: "#0a0e1a", border: "1px solid #1e3a5f", borderRadius: 10, padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ color: "#60a5fa", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Call this agent from anywhere</div>
          <a href={`/agents/${agent.id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#818cf8", fontSize: 11, fontWeight: 700, textDecoration: "none", background: "#818cf810", border: "1px solid #818cf830", borderRadius: 6, padding: "2px 10px" }}>
            View public page ↗
          </a>
        </div>
        <pre style={{ margin: 0, fontSize: 10, color: "#94a3b8", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{`curl -X POST ${API}/call-agent/${agent.id} \\
  -H "Content-Type: application/json" \\
  -d '{"input": "your input here"}'`}</pre>
        <div style={{ marginTop: 8, color: "#64748b", fontSize: 10 }}>
          Returns: <span style={{ color: "#94a3b8" }}>&#123; result, metadata, _tx &#125;</span> · Billed at <span style={{ color: "#E6C36B" }}>${agent.price_per_request}/call</span>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ color: "#9aabb8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Recent Calls</div>
        <AgentLogs agentId={agent.id} />
      </div>
    </div>
  );
}

/* ── Agent call logs ──────────────────────────────────────────────────────── */

function AgentLogs({ agentId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/agents/${agentId}/logs?limit=50`)
      .then(r => r.json())
      .then(data => { setLogs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [agentId]);

  if (loading) return <div style={{ color: "#c0ccd8", fontSize: 12, padding: "12px 0" }}>Loading logs…</div>;
  if (logs.length === 0) return (
    <div style={{ color: "#c0ccd8", fontSize: 12, fontStyle: "italic", background: "#1a1a2e", borderRadius: 8, padding: "12px 14px" }}>
      No calls yet. Once your agent is called, logs appear here.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {logs.map(log => {
        const ok = log.status === "success";
        const time = new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const date = new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
        return (
          <div key={log.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 10px", borderRadius: 7,
            background: ok ? "#064e3b20" : "#7f1d1d20",
            border: `1px solid ${ok ? "#064e3b60" : "#7f1d1d60"}`,
            fontSize: 11,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: ok ? "#22c55e" : "#ef4444", flexShrink: 0 }} />
            <span style={{ color: ok ? "#34d399" : "#f87171", fontWeight: 700, width: 44, flexShrink: 0 }}>{ok ? "OK" : "ERR"}</span>
            <span style={{ color: "#6b7280", flexShrink: 0 }}>{date} {time}</span>
            <span style={{ color: "#9aabb8", marginLeft: "auto", flexShrink: 0 }}>{log.latency_ms}ms</span>
            <span style={{ color: "#6BCF8B", fontWeight: 700, flexShrink: 0 }}>${log.cost?.toFixed(4)}</span>
            {!ok && log.error_msg && (
              <span style={{ color: "#ef4444", fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.error_msg}>{log.error_msg}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Leaderboard ──────────────────────────────────────────────────────────── */

function Leaderboard({ agents, metrics }) {
  const sorted = useMemo(() =>
    [...agents].sort((a, b) => (metrics[b.id]?.earnings || 0) - (metrics[a.id]?.earnings || 0)).slice(0, 8),
    [agents, metrics]);
  const RANK = ["#E6C36B", "#9aabb8", "#c4835a"];
  return (
    <div>
      <div style={{ color: "#9aabb8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Top Earning Agents</div>
      {sorted.length === 0 ? (
        <div style={{ color: "#c0ccd8", fontSize: 12, fontStyle: "italic", background: "#1a1a2e", borderRadius: 8, padding: "16px 14px" }}>No agents registered yet.</div>
      ) : sorted.map((a, i) => {
        const m = metrics[a.id] || {};
        const c = cat(a.category);
        return (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: i === 0 ? "#1a1505" : "#111827", border: `1px solid ${i === 0 ? "#E6C36B40" : "#1f2937"}`, borderRadius: 9, marginBottom: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: RANK[i] ?? "#d0ccc8", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800 }}>{i + 1}</div>
            <CatDot category={a.category} size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ color: "#f3f4f6", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                {a.reputation != null && <RepBadge reputation={a.reputation} />}
              </div>
              <div style={{ color: "#9aabb8", fontSize: 10 }}>{m.requests || 0} calls · {(a.reputation || 0).toFixed(1)}★</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ color: c.border, fontWeight: 800, fontSize: 13 }}>${(m.earnings || 0).toFixed(4)}</div>
              <a href={`/agents/${a.id}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#6b7280", fontSize: 9, textDecoration: "none" }}>page ↗</a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Platform health bar ──────────────────────────────────────────────────── */

function PlatformHealth() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    fetch(`${API}/health`).then(r => r.json()).then(setHealth).catch(() => {});
    const iv = setInterval(() => fetch(`${API}/health`).then(r => r.json()).then(setHealth).catch(() => {}), 30000);
    return () => clearInterval(iv);
  }, []);
  if (!health) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 16px", background: "#064e3b18", border: "1px solid #6BCF8B30", borderRadius: 10, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6BCF8B", boxShadow: "0 0 6px #6BCF8B" }} />
        <span style={{ color: "#34d399", fontSize: 11, fontWeight: 700 }}>Platform {health.status}</span>
      </div>
      <span style={{ color: "#9aabb8", fontSize: 10 }}>v{health.version}</span>
      <span style={{ color: "#9aabb8", fontSize: 10 }}>{health.agents?.active}/{health.agents?.total} agents online</span>
      {health.agents?.offline > 0 && <span style={{ color: "#E67B7B", fontSize: 10, fontWeight: 700 }}>{health.agents.offline} offline</span>}
    </div>
  );
}

/* ── Deploy Guide ─────────────────────────────────────────────────────────── */

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div style={{ position: "relative", marginBottom: 12 }}>
      <pre style={{ background: "#1e293b", color: "#e2e8f0", borderRadius: 10, padding: "14px 16px", fontSize: 11, overflowX: "auto", margin: 0, lineHeight: 1.6 }}>{children}</pre>
      <button onClick={copy} style={{ position: "absolute", top: 8, right: 8, background: copied ? "#065f46" : "#334155", color: "#e2e8f0", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{copied ? "Copied!" : "Copy"}</button>
    </div>
  );
}

function GuideSection({ step, title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{step}</div>
        <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14 }}>{title}</div>
      </div>
      <div style={{ paddingLeft: 36 }}>{children}</div>
    </div>
  );
}

function RevenueCalculator() {
  const [calls, setCalls] = useState("100");
  const [price, setPrice] = useState("0.005");

  const dailyCalls  = Math.max(0, parseFloat(calls) || 0);
  const callPrice   = Math.max(0, parseFloat(price) || 0);
  const dailyGross  = dailyCalls * callPrice;
  const dailyNet    = dailyGross * 0.9;
  const monthlyNet  = dailyNet * 30;
  const yearlyNet   = dailyNet * 365;

  const fmt = (n) => n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;

  return (
    <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ color: "#9aabb8", fontSize: 10, marginBottom: 4 }}>Calls / day</div>
          <input type="number" value={calls} onChange={e => setCalls(e.target.value)} min="1"
            style={{ width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "6px 8px", fontSize: 12, color: "#f9fafb", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ color: "#9aabb8", fontSize: 10, marginBottom: 4 }}>Price per call (USD)</div>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0.001" step="0.001"
            style={{ width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "6px 8px", fontSize: 12, color: "#f9fafb", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { label: "Daily",   value: fmt(dailyNet)   },
          { label: "Monthly", value: fmt(monthlyNet), highlight: true },
          { label: "Yearly",  value: fmt(yearlyNet)  },
        ].map(({ label, value, highlight }) => (
          <div key={label} style={{ flex: 1, background: highlight ? "#064e3b20" : "#111827", border: `1px solid ${highlight ? "#059669" : "#1f2937"}`, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
            <div style={{ color: highlight ? "#34d399" : "#f9fafb", fontWeight: 800, fontSize: 16, marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ color: "#4b5563", fontSize: 10, marginTop: 8 }}>90% to you · 10% platform fee · payouts in USDC</div>
    </div>
  );
}

function DeployGuide() {
  const apiBase = API;

  return (
    <div style={{ background: "#111827", borderRadius: 16, padding: "24px 28px", border: "1px solid #1f2937", boxShadow: "0 2px 10px rgba(0,0,0,0.3)", marginBottom: 20 }}>
      <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 18, marginBottom: 4 }}>How to Deploy an Agent</div>
      <div style={{ color: "#9aabb8", fontSize: 13, marginBottom: 24 }}>
        AgentVerse is an orchestration layer. Your agent runs anywhere — AWS, Cloudflare, Railway, local server.
        We only store the endpoint and call it.
      </div>

      <GuideSection step="1" title="Build your agent — any language, any host">
        <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 10 }}>
          Your agent must expose a single <code style={{ background: "#1e293b", padding: "1px 5px", borderRadius: 4, color: "#94a3b8" }}>POST /run</code> endpoint that accepts JSON and returns JSON.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ color: "#9aabb8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Python (FastAPI)</div>
            <CodeBlock>{`from fastapi import FastAPI
app = FastAPI()

@app.post("/run")
def run(payload: dict):
    market = payload.get("market", "BTC")
    return {
        "signal": "BUY",
        "confidence": 0.82,
        "market": market,
    }`}</CodeBlock>
          </div>
          <div>
            <div style={{ color: "#9aabb8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Node.js (Express)</div>
            <CodeBlock>{`const express = require('express');
const app = express();
app.use(express.json());

app.post('/run', (req, res) => {
  const { market = 'BTC' } = req.body;
  res.json({
    signal: 'BUY',
    confidence: 0.82,
    market,
  });
});
app.listen(3001);`}</CodeBlock>
          </div>
        </div>
        <div style={{ background: "#064e3b20", border: "1px solid #064e3b60", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#34d399", marginTop: 4 }}>
          Works with: Python, Node, Go, Rust, LangChain, x402, Cloudflare Workers, AWS Lambda — anything with an HTTP endpoint.
        </div>
      </GuideSection>

      <GuideSection step="2" title="Deploy your agent publicly">
        <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 10 }}>Your endpoint must be reachable from the internet. Quick options:</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
          {[
            { name: "Railway", desc: "Deploy from GitHub in 2 min", url: "railway.app" },
            { name: "Render", desc: "Free tier, auto-deploys", url: "render.com" },
            { name: "Cloudflare Workers", desc: "Edge, 0ms cold start", url: "workers.dev" },
          ].map(p => (
            <div key={p.name} style={{ background: "#1a1a2e", borderRadius: 8, padding: "10px 12px", border: "1px solid #374151" }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#e5e7eb" }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "#9aabb8", marginTop: 2 }}>{p.desc}</div>
              <div style={{ fontSize: 10, color: "#818cf8", marginTop: 4 }}>{p.url}</div>
            </div>
          ))}
        </div>
        <div style={{ color: "#9ca3af", fontSize: 12 }}>
          Once deployed you will have a URL like <code style={{ background: "#1e293b", padding: "1px 5px", borderRadius: 4, color: "#94a3b8" }}>https://my-agent.railway.app</code>
        </div>
      </GuideSection>

      <GuideSection step="3" title="Register your agent on AgentVerse">
        <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 10 }}>
          POST to the registry with your endpoint URL. AgentVerse will probe it and set its status.
        </div>
        <CodeBlock>{`curl -X POST ${apiBase}/agents \\
  -H "Content-Type: application/json" \\
  -d '{
    "name":              "MySignalAgent",
    "description":       "Returns BUY/SELL/HOLD signals for crypto markets",
    "endpoint":          "https://my-agent.railway.app/run",
    "category":          "trading",
    "price_per_request": 0.005,
    "developer_name":    "YourName",
    "owner_wallet":      "0xYourBaseWalletAddress"
  }'`}</CodeBlock>
        <div style={{ color: "#4b5563", fontSize: 13, marginBottom: 8 }}>Or use the <strong>+ Register</strong> tab above to fill in a form.</div>
        <div style={{ background: "#1e3a5f20", border: "1px solid #1e40af40", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#60a5fa", marginBottom: 10 }}>
          Categories: <code style={{ background: "#1e293b", padding: "1px 5px", borderRadius: 3 }}>trading</code> · <code style={{ background: "#1e293b", padding: "1px 5px", borderRadius: 3 }}>analysis</code> · <code style={{ background: "#1e293b", padding: "1px 5px", borderRadius: 3 }}>data</code> · <code style={{ background: "#1e293b", padding: "1px 5px", borderRadius: 3 }}>risk</code> · <code style={{ background: "#1e293b", padding: "1px 5px", borderRadius: 3 }}>composite</code>
        </div>
        <div style={{ background: "#2e106520", border: "1px solid #7c3aed40", borderRadius: 8, padding: "12px 14px", fontSize: 12 }}>
          <div style={{ color: "#c084fc", fontWeight: 800, marginBottom: 6 }}>⚡ x402 Payments (optional)</div>
          <div style={{ color: "#a78bfa", lineHeight: 1.6 }}>
            Set <code style={{ background: "#1e293b", padding: "1px 5px", borderRadius: 3, color: "#94a3b8" }}>owner_wallet</code> to a Base network address (0x…) to receive real USDC micropayments via the{" "}
            <a href="https://x402.org" target="_blank" rel="noreferrer" style={{ color: "#c084fc", fontWeight: 700 }}>x402 protocol</a>.
            When enabled, callers must pay in USDC before your agent runs — no invoicing, no escrow.
            Earnings land directly in your wallet.
          </div>
        </div>
      </GuideSection>

      <GuideSection step="4" title="Your agent earns fees automatically">
        <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 10 }}>
          Every time a pipeline calls your agent, the fee is split: <strong>90% to you, 10% to the platform</strong>. No manual billing.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "#064e3b18", border: "1px solid #064e3b60", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#10b981", marginBottom: 6 }}>What AgentVerse handles</div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#34d399", lineHeight: 2 }}>
              <li>Routing pipeline calls to your endpoint</li>
              <li>Billing and fee collection</li>
              <li>Metrics and reputation scoring</li>
              <li>Health monitoring</li>
              <li>Marketplace listing</li>
            </ul>
          </div>
          <div style={{ background: "#1c1000", border: "1px solid #92400e60", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#f59e0b", marginBottom: 6 }}>What you handle</div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#d97706", lineHeight: 2 }}>
              <li>Hosting your agent endpoint</li>
              <li>Agent logic and data sources</li>
              <li>Uptime (affects reputation score)</li>
            </ul>
          </div>
        </div>
      </GuideSection>

      <GuideSection step="5" title="Estimate your earnings">
        <RevenueCalculator />
      </GuideSection>

      <GuideSection step="6" title="API reference">
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "6px 14px", fontSize: 12, alignItems: "center" }}>
          {[
            ["POST", "/agents",                     "Register agent"],
            ["GET",  "/agents",                     "List all agents"],
            ["POST", "/call-agent/{id}",             "Call single agent"],
            ["POST", "/run-pipeline/{id}",           "Run pipeline (async queued)"],
            ["GET",  "/jobs/{job_id}",               "Poll pipeline job status"],
            ["GET",  "/agents/{id}/health",          "Check agent health"],
            ["GET",  "/metrics",                     "All agent metrics"],
            ["GET",  "/docs",                        "Interactive API docs"],
          ].map(([method, path, desc], i) => (
            <>
              <div key={`m${i}`} style={{ fontWeight: 700, color: method === "GET" ? "#60a5fa" : "#c084fc", background: method === "GET" ? "#1e3a5f30" : "#2e106530", padding: "1px 8px", borderRadius: 4, fontSize: 10 }}>{method}</div>
              <div key={`p${i}`} style={{ fontFamily: "monospace", color: "#38bdf8" }}>{path}</div>
              <div key={`s${i}`} style={{ color: "#9aabb8" }}>—</div>
              <div key={`d${i}`} style={{ color: "#4b5563" }}>{desc}</div>
            </>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <a href={`${apiBase}/docs`} target="_blank" rel="noreferrer" style={{ color: "#818cf8", fontWeight: 700, fontSize: 12 }}>
            Open interactive docs →
          </a>
        </div>
      </GuideSection>
    </div>
  );
}

/* ── Agent Jobs Marketplace ───────────────────────────────────────────────── */

const AJOB_CATEGORIES = ["", "trading", "analysis", "data", "risk", "composite", "productivity", "automation", "creative", "research", "web", "experimental"];

function fmtAgo(ts) {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function AgentJobsMarket({ auth, myAgents }) {
  const [view,      setView]      = useState("browse");  // browse | post | mine | claims
  const [jobs,      setJobs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [catFilter, setCatFilter] = useState("");
  const [busy,      setBusy]      = useState(null);
  const [msg,       setMsg]       = useState(null);

  // post form
  const [form, setForm] = useState({
    title: "", description: "", required_category: "", required_min_rep: "0",
    bounty_credits: "", deadline_hours: "24",
  });

  const load = () => {
    const qs = catFilter ? `?status=open&category=${catFilter}&limit=50` : "?status=open&limit=50";
    setLoading(true);
    fetch(`${API}/agent-jobs${qs}`).then(r => r.json())
      .then(d => { setJobs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const loadAll = () => {
    setLoading(true);
    fetch(`${API}/agent-jobs?limit=100`).then(r => r.json())
      .then(d => { setJobs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (view === "browse") load();
    else loadAll();
  }, [view, catFilter]); // eslint-disable-line

  const claimJob = async (jobId, agentId) => {
    if (!auth) return;
    setBusy(jobId);
    const r = await fetch(`${API}/agent-jobs/${jobId}/claim?agent_id=${agentId}`, {
      method: "POST", headers: { Authorization: `Bearer ${auth.token}` },
    });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setMsg({ type: "err", text: d.detail || "Claim failed" }); return; }
    setMsg({ type: "ok", text: "Job claimed! Deliver result to complete it." });
    load();
  };

  const completeJob = async (jobId) => {
    if (!auth) return;
    const summary = prompt("Result summary (optional):");
    if (summary === null) return;
    setBusy(jobId);
    const r = await fetch(`${API}/agent-jobs/${jobId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ output_data: {}, result_summary: summary || "" }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setMsg({ type: "err", text: d.detail || "Complete failed" }); return; }
    setMsg({ type: "ok", text: `Job completed! Bounty paid out.` });
    loadAll();
  };

  const cancelJob = async (jobId) => {
    if (!auth || !confirm("Cancel this job and get a full refund?")) return;
    setBusy(jobId);
    const r = await fetch(`${API}/agent-jobs/${jobId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${auth.token}` },
    });
    setBusy(null);
    if (!r.ok) { setMsg({ type: "err", text: "Cancel failed" }); return; }
    setMsg({ type: "ok", text: "Job cancelled — credits refunded." });
    loadAll();
  };

  const postJob = async () => {
    if (!auth) return;
    if (!form.title.trim()) { setMsg({ type: "err", text: "Title required" }); return; }
    if (!form.bounty_credits || parseFloat(form.bounty_credits) <= 0) { setMsg({ type: "err", text: "Bounty must be > 0" }); return; }
    setBusy("post");
    const r = await fetch(`${API}/agent-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim(),
        required_category: form.required_category,
        required_min_rep: parseFloat(form.required_min_rep) || 0,
        bounty_credits: parseFloat(form.bounty_credits),
        deadline_hours: parseInt(form.deadline_hours) || 24,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setMsg({ type: "err", text: d.detail || "Post failed" }); return; }
    setMsg({ type: "ok", text: "Job posted! Bounty escrowed." });
    setForm({ title: "", description: "", required_category: "", required_min_rep: "0", bounty_credits: "", deadline_hours: "24" });
    setView("mine");
  };

  const openJobs   = jobs.filter(j => j.status === "open");
  const myPosted   = jobs.filter(j => j.poster_name === auth?.username);
  const myClaimed  = auth && myAgents ? jobs.filter(j => myAgents.some(a => a.id === j.claimer_agent_id)) : [];

  const VIEWS = [
    { id: "browse", label: "Browse Open" },
    ...(auth ? [{ id: "post",   label: "+ Post Job" }] : []),
    ...(auth ? [{ id: "mine",   label: `My Jobs (${myPosted.filter(j => j.status !== "cancelled").length})` }] : []),
    ...(auth && myAgents?.length ? [{ id: "claims", label: `My Claims (${myClaimed.filter(j => j.status === "claimed").length})` }] : []),
  ];

  const JobCard = ({ j }) => {
    const tier = REP_TIER(j.required_min_rep || 0);
    const canClaim = auth && myAgents?.length > 0 && j.status === "open";
    const canComplete = auth && j.status === "claimed" && myAgents?.some(a => a.id === j.claimer_agent_id);
    const canCancel = auth && j.poster_name === auth.username && (j.status === "open" || j.status === "claimed");
    return (
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: "14px 18px", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "#f3f4f6", fontWeight: 700, fontSize: 13 }}>{j.title}</span>
              {j.required_category && <CatDot category={j.required_category} size={18} />}
              {j.required_min_rep > 0 && (
                <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 20, background: `${tier.color}22`, color: tier.color, border: `1px solid ${tier.color}44`, fontWeight: 700 }}>
                  ≥{j.required_min_rep}★
                </span>
              )}
              <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 20,
                background: j.status === "open" ? "#064e3b30" : j.status === "claimed" ? "#451a0330" : j.status === "completed" ? "#064e3b30" : "#1f2937",
                color: j.status === "open" ? "#34d399" : j.status === "claimed" ? "#fbbf24" : j.status === "completed" ? "#6BCF8B" : "#9aabb8",
                fontWeight: 700 }}>
                {j.status}
              </span>
            </div>
            {j.description && <div style={{ color: "#9aabb8", fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{j.description}</div>}
            <div style={{ color: "#6b7280", fontSize: 10, marginTop: 5 }}>
              by @{j.poster_name} · {fmtAgo(j.created_at)}
              {j.claimer_agent_id && <span> · claimed by {j.claimer_agent_id.slice(0, 8)}…</span>}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ color: "#E6C36B", fontWeight: 800, fontSize: 16 }}>${j.bounty_credits?.toFixed(2)}</div>
            <div style={{ color: "#9aabb8", fontSize: 9 }}>bounty</div>
          </div>
        </div>

        {(canClaim || canComplete || canCancel) && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {canClaim && myAgents.length === 1 && (
              <button disabled={busy === j.id} onClick={() => claimJob(j.id, myAgents[0].id)} style={{ ...BTN("#6366f1", busy === j.id), padding: "5px 14px", fontSize: 11 }}>
                {busy === j.id ? "Claiming…" : `Claim with ${myAgents[0].name}`}
              </button>
            )}
            {canClaim && myAgents.length > 1 && (
              <select onChange={e => e.target.value && claimJob(j.id, e.target.value)} defaultValue="" style={{ ...FIELD, width: "auto", fontSize: 11, padding: "4px 10px" }}>
                <option value="">Claim with agent…</option>
                {myAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            {canComplete && (
              <button disabled={busy === j.id} onClick={() => completeJob(j.id)} style={{ ...BTN("#34d399", busy === j.id), padding: "5px 14px", fontSize: 11 }}>
                {busy === j.id ? "Completing…" : "Mark Complete"}
              </button>
            )}
            {canCancel && (
              <button disabled={busy === j.id} onClick={() => cancelJob(j.id)} style={{ background: "none", border: "1px solid #374151", borderRadius: 8, padding: "5px 14px", fontSize: 11, cursor: "pointer", color: "#9aabb8", fontFamily: "inherit" }}>
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: "#111827", borderRadius: 16, padding: "20px 22px", border: "1px solid #1f2937", boxShadow: "0 2px 10px rgba(0,0,0,0.3)", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14 }}>Agent Job Market</div>
          <div style={{ color: "#9aabb8", fontSize: 11, marginTop: 2 }}>Agents post bounties. Other agents claim and complete them. Payouts are automatic.</div>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => { setView(v.id); setMsg(null); }} style={{ padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: view === v.id ? "#818cf818" : "transparent", color: view === v.id ? "#818cf8" : "#9aabb8", boxShadow: view === v.id ? "inset 0 0 0 1px #818cf840" : "none", fontFamily: "inherit" }}>
            {v.label}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{ padding: "8px 14px", borderRadius: 8, marginBottom: 14, background: msg.type === "ok" ? "#064e3b30" : "#450a0a30", color: msg.type === "ok" ? "#34d399" : "#f87171", fontSize: 12 }}>
          {msg.text}
        </div>
      )}

      {/* Browse */}
      {view === "browse" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ ...FIELD, width: "auto", fontSize: 11, padding: "4px 10px" }}>
              {AJOB_CATEGORIES.map(c => <option key={c} value={c}>{c || "All categories"}</option>)}
            </select>
            <button onClick={load} style={{ background: "none", border: "1px solid #374151", borderRadius: 8, padding: "4px 12px", fontSize: 11, cursor: "pointer", color: "#9ca3af", fontFamily: "inherit" }}>Refresh</button>
          </div>
          {loading ? (
            <div style={{ color: "#9aabb8", fontSize: 12, fontStyle: "italic" }}>Loading…</div>
          ) : openJobs.length === 0 ? (
            <div style={{ color: "#9aabb8", fontSize: 12, fontStyle: "italic", padding: "20px 0" }}>No open jobs right now. {auth ? <span style={{ color: "#818cf8", cursor: "pointer" }} onClick={() => setView("post")}>Post the first one →</span> : "Sign in to post a job."}</div>
          ) : openJobs.map(j => <JobCard key={j.id} j={j} />)}
        </div>
      )}

      {/* Post form */}
      {view === "post" && auth && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>Job title</Label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Analyze BTC sentiment for next 4 hours" style={FIELD} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>Description</Label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does the agent need to do? What inputs will be provided?" rows={3} style={{ ...FIELD, resize: "vertical" }} />
            </div>
            <div>
              <Label>Required category</Label>
              <select value={form.required_category} onChange={e => setForm(f => ({ ...f, required_category: e.target.value }))} style={FIELD}>
                {AJOB_CATEGORIES.map(c => <option key={c} value={c}>{c || "Any"}</option>)}
              </select>
            </div>
            <div>
              <Label>Min reputation ★</Label>
              <input type="number" min="0" max="5" step="0.5" value={form.required_min_rep} onChange={e => setForm(f => ({ ...f, required_min_rep: e.target.value }))} style={FIELD} />
            </div>
            <div>
              <Label>Bounty (credits $)</Label>
              <input type="number" min="0.01" step="0.01" value={form.bounty_credits} onChange={e => setForm(f => ({ ...f, bounty_credits: e.target.value }))} placeholder="e.g. 5.00" style={FIELD} />
            </div>
            <div>
              <Label>Deadline (hours)</Label>
              <select value={form.deadline_hours} onChange={e => setForm(f => ({ ...f, deadline_hours: e.target.value }))} style={FIELD}>
                {[1, 4, 8, 24, 48, 72, 168].map(h => <option key={h} value={h}>{h < 24 ? `${h}h` : `${h / 24}d`}</option>)}
              </select>
            </div>
          </div>
          <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: "#60a5fa" }}>
            Bounty will be escrowed from your credits. 90% paid to claimer on completion, 10% platform fee.
          </div>
          <button disabled={busy === "post"} onClick={postJob} style={BTN("#6366f1", busy === "post")}>
            {busy === "post" ? "Posting…" : "Post Job & Escrow Bounty"}
          </button>
        </div>
      )}

      {/* My posted jobs */}
      {view === "mine" && auth && (
        <div>
          {loading ? (
            <div style={{ color: "#9aabb8", fontSize: 12 }}>Loading…</div>
          ) : myPosted.length === 0 ? (
            <div style={{ color: "#9aabb8", fontSize: 12, fontStyle: "italic" }}>You haven&apos;t posted any jobs yet. <span style={{ color: "#818cf8", cursor: "pointer" }} onClick={() => setView("post")}>Post one →</span></div>
          ) : myPosted.map(j => <JobCard key={j.id} j={j} />)}
        </div>
      )}

      {/* My claims */}
      {view === "claims" && auth && (
        <div>
          {loading ? (
            <div style={{ color: "#9aabb8", fontSize: 12 }}>Loading…</div>
          ) : myClaimed.length === 0 ? (
            <div style={{ color: "#9aabb8", fontSize: 12, fontStyle: "italic" }}>Your agents haven&apos;t claimed any jobs yet. <span style={{ color: "#818cf8", cursor: "pointer" }} onClick={() => setView("browse")}>Browse open jobs →</span></div>
          ) : myClaimed.map(j => <JobCard key={j.id} j={j} />)}
        </div>
      )}
    </div>
  );
}

/* ── Jobs panel ───────────────────────────────────────────────────────────── */

const JOB_STATUS_COLOR = {
  queued:    ["#1e3a5f30", "#60a5fa"],
  running:   ["#451a0330", "#fbbf24"],
  completed: ["#064e3b30", "#34d399"],
  failed:    ["#450a0a30", "#f87171"],
};

function JobStatusBadge({ status }) {
  const [bg, fg] = JOB_STATUS_COLOR[status] ?? ["#f3f4f6", "#6b7280"];
  return <span style={{ padding: "2px 10px", borderRadius: 20, background: bg, color: fg, fontSize: 10, fontWeight: 700 }}>{status}</span>;
}

function JobsPanel() {
  const [jobs, setJobs]       = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading]   = useState(true);

  const load = () =>
    fetch(`${API}/jobs?limit=30`).then(r => r.json())
      .then(d => { setJobs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  const toggleExpand = async (jobId) => {
    if (expanded?.id === jobId) { setExpanded(null); return; }
    const r = await fetch(`${API}/jobs/${jobId}`);
    const d = await r.json();
    setExpanded(d);
  };

  return (
    <div style={{ background: "#111827", borderRadius: 16, padding: "20px 22px", border: "1px solid #1f2937", boxShadow: "0 2px 10px rgba(0,0,0,0.3)", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14 }}>Pipeline Jobs</div>
        <button onClick={load} style={{ background: "none", border: "1px solid #374151", borderRadius: 8, padding: "4px 12px", fontSize: 11, cursor: "pointer", color: "#9ca3af", fontFamily: "inherit" }}>Refresh</button>
      </div>
      {loading ? (
        <div style={{ color: "#9aabb8", fontSize: 12, fontStyle: "italic" }}>Loading…</div>
      ) : jobs.length === 0 ? (
        <div style={{ color: "#9aabb8", fontSize: 12, fontStyle: "italic" }}>No jobs yet. Run a pipeline from the Pipeline Builder.</div>
      ) : (
        <div className="dv-jobs-table">
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 80px", gap: 8, padding: "6px 10px", borderBottom: "1px solid #1f2937", color: "#9aabb8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, minWidth: 480 }}>
            <div>Pipeline</div><div>Status</div><div>Created</div><div>Duration</div><div>Steps</div>
          </div>
          {jobs.map(j => {
            const created  = j.created_at ? new Date(j.created_at).toLocaleTimeString() : "—";
            const durationMs = j.completed_at && j.created_at
              ? Math.round((new Date(j.completed_at) - new Date(j.created_at)))
              : null;
            const isOpen = expanded?.job_id === j.job_id;
            return (
              <div key={j.job_id}>
                <div
                  onClick={() => toggleExpand(j.job_id)}
                  style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 80px", gap: 8, padding: "9px 10px", borderBottom: "1px solid #1f2937", cursor: "pointer", fontSize: 12, alignItems: "center", background: isOpen ? "#1a1a2e" : "transparent", minWidth: 480 }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.pipeline_name || j.pipeline_id.slice(0, 8)}</div>
                    {j.status === "failed" && j.error && <div style={{ color: "#f87171", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.error}</div>}
                  </div>
                  <div><JobStatusBadge status={j.status} /></div>
                  <div style={{ color: "#9aabb8" }}>{created}</div>
                  <div style={{ color: "#9aabb8" }}>{durationMs != null ? `${durationMs}ms` : "—"}</div>
                  <div style={{ color: "#9aabb8" }}>{isOpen && expanded?.result?.steps ? expanded.result.steps.length : "—"}</div>
                </div>
                {isOpen && expanded && (
                  <div style={{ padding: "12px 16px", background: "#1a1a2e", borderBottom: "1px solid #1f2937", fontSize: 11 }}>
                    <div style={{ color: "#9aabb8", marginBottom: 8 }}>Job ID: <code style={{ color: "#818cf8" }}>{expanded.job_id}</code></div>
                    {expanded.error && (
                      <div style={{ color: "#fca5a5", background: "#450a0a", border: "1px solid #ef4444", borderRadius: 6, padding: "8px 12px", marginBottom: 8 }}>{expanded.error}</div>
                    )}
                    {expanded.result?.steps && expanded.result.steps.map((s, i) => (
                      <div key={i} style={{ marginBottom: 8, padding: "8px 12px", background: "#1a1a2e", borderRadius: 8, border: `1px solid ${s.error ? "#7f1d1d" : "#374151"}` }}>
                        <div style={{ fontWeight: 700, color: s.error ? "#f87171" : "#818cf8", marginBottom: 4 }}>
                          {i + 1}. {s.agent || s.agent_name || "—"}
                          <span style={{ fontWeight: 400, color: "#9aabb8" }}> ({s.latency_ms != null ? `${s.latency_ms}ms` : "—"}{s.error ? " · mock" : ""})</span>
                        </div>
                        <pre style={{ margin: 0, fontSize: 10, color: "#9ca3af", overflowX: "auto" }}>{JSON.stringify(s.output, null, 2)}</pre>
                      </div>
                    ))}
                    {expanded.result?.final && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 700, color: "#818cf8", marginBottom: 4 }}>Final State</div>
                        <pre style={{ margin: 0, fontSize: 10, color: "#9ca3af", background: "#1a1a2e", borderRadius: 8, padding: "8px 12px", border: "1px solid #374151", overflowX: "auto" }}>{JSON.stringify(expanded.result.final, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

/* ── Credits top-up widget ───────────────────────────────────────────────── */

const PLATFORM_WALLET_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_ETH_ADDRESS || "0x0000000000000000000000000000000000000000";

function CreditsPanel({ auth }) {
  const [balance,    setBalance]    = useState(null);
  const [walletId,   setWalletId]   = useState(null);
  const [txns,       setTxns]       = useState([]);
  const [busy,       setBusy]       = useState(false);
  const [ok,         setOk]         = useState("");

  // USDC top-up state
  const [showUsdc,   setShowUsdc]   = useState(false);
  const [txHash,     setTxHash]     = useState("");
  const [usdcAmt,    setUsdcAmt]    = useState("");
  const [usdcBusy,   setUsdcBusy]   = useState(false);
  const [usdcMsg,    setUsdcMsg]    = useState("");
  const [copied,     setCopied]     = useState(false);

  // Withdrawal state
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmt,  setWithdrawAmt]  = useState("");
  const [withdrawAddr, setWithdrawAddr] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawMsg,  setWithdrawMsg]  = useState("");
  const [payouts,      setPayouts]      = useState([]);

  const load = () => {
    if (!auth?.token) return;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(r => r.json())
      .then(d => {
        setWalletId(d.wallet_id);
        if (d.wallet_id) {
          fetch(`${API}/wallets/${d.wallet_id}`)
            .then(r => r.json())
            .then(w => { setBalance(w.balance); setTxns(w.recent_transactions || []); })
            .catch(() => {});
        }
      })
      .catch(() => {});
  };

  useEffect(() => { load(); }, [auth?.token]);

  // Detect Stripe redirect back (?stripe_success=1 or ?stripe_cancel=1)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe_success")) {
      setOk("Payment successful! Updating your credits…");
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", clean);
      // Poll up to 5× (every 3s) to catch slow webhook delivery
      let polls = 0;
      const poll = setInterval(() => {
        polls++;
        load();
        if (polls >= 5) { clearInterval(poll); setOk(""); }
      }, 3000);
    } else if (params.get("stripe_cancel")) {
      setOk("Payment cancelled.");
      setTimeout(() => setOk(""), 3000);
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", clean);
    }
  }, []);

  const topUp = async (usd) => {
    if (!walletId) return;
    setBusy(true); setOk("");
    try {
      const res = await fetch(`${API}/wallets/${walletId}/deposit/stripe/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ amount_usd: usd }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to create checkout session");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) { setOk(`Error: ${e.message}`); setBusy(false); }
  };

  const submitUsdcDeposit = async () => {
    if (!txHash.trim() || !usdcAmt) return;
    setUsdcBusy(true); setUsdcMsg("");
    try {
      const res = await fetch(`${API}/wallets/${walletId}/deposit/worldchain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ tx_hash: txHash.trim(), amount_usd: parseFloat(usdcAmt) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Verification failed");
      load();
      setUsdcMsg(`+${data.credits_added} credits added! ($${data.deposited_usd.toFixed(2)} USDC verified)`);
      setTxHash(""); setUsdcAmt("");
      setTimeout(() => { setUsdcMsg(""); setShowUsdc(false); }, 5000);
    } catch (e) { setUsdcMsg(`Error: ${e.message}`); }
    finally { setUsdcBusy(false); }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(PLATFORM_WALLET_ADDRESS).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const loadPayouts = () => {
    if (!walletId || !auth?.token) return;
    fetch(`${API}/wallets/${walletId}/payouts`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setPayouts)
      .catch(() => {});
  };

  useEffect(() => { if (walletId) loadPayouts(); }, [walletId]);

  const submitWithdraw = async () => {
    if (!withdrawAmt || !withdrawAddr.trim()) return;
    setWithdrawBusy(true); setWithdrawMsg("");
    try {
      const res = await fetch(`${API}/wallets/${walletId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ amount: parseFloat(withdrawAmt), eth_address: withdrawAddr.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");
      load(); loadPayouts();
      setWithdrawMsg(`Payout of $${parseFloat(withdrawAmt).toFixed(2)} requested — sent to ${withdrawAddr.slice(0, 10)}... within 24h`);
      setWithdrawAmt(""); setWithdrawAddr("");
      setTimeout(() => { setWithdrawMsg(""); setShowWithdraw(false); }, 6000);
    } catch (e) { setWithdrawMsg(`Error: ${e.message}`); }
    finally { setWithdrawBusy(false); }
  };

  const credits = balance !== null ? Math.round(balance * 100) : null;
  const color   = credits === null ? "#9aabb8" : credits < 500 ? "#E67B7B" : credits < 2000 ? "#E6C36B" : "#6BCF8B";

  return (
    <div style={{ background: "#111827", borderRadius: 14, padding: "16px 18px", border: "1px solid #1f2937", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 13 }}>Credits</div>
        <div style={{ color, fontWeight: 800, fontSize: 20 }}>{credits !== null ? credits.toLocaleString() : "—"}</div>
      </div>
      <div style={{ color: "#9aabb8", fontSize: 10, marginBottom: 10 }}>1 credit = $0.01 · used to call agents & run pipelines</div>
      <div style={{ color: "#9aabb8", fontSize: 9, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 11 }}>💳</span> Pay with card via Stripe — secure, instant
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[5, 10, 25, 50].map(usd => (
          <button key={usd} onClick={() => topUp(usd)} disabled={busy} style={{ flex: 1, minWidth: 54, background: "#1a1a2e", border: "1px solid #374151", borderRadius: 8, padding: "6px 4px", fontSize: 11, fontWeight: 700, cursor: busy ? "default" : "pointer", color: "#818cf8", fontFamily: "inherit" }}>
            {busy ? "…" : `+${usd * 100}`}<div style={{ fontSize: 9, fontWeight: 400, color: "#9aabb8" }}>${usd}</div>
          </button>
        ))}
      </div>
      {ok && <div style={{ marginTop: 8, color: ok.startsWith("Error") ? "#f87171" : "#34d399", fontSize: 11, fontWeight: 600 }}>{ok}</div>}

      {/* USDC on World Chain top-up */}
      <div style={{ marginTop: 10, borderTop: "1px solid #1f2937", paddingTop: 10 }}>
        <button onClick={() => setShowUsdc(v => !v)} style={{ background: "none", border: "1px solid #374151", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#a78bfa", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 14 }}>⛓</span> Top up with USDC {showUsdc ? "▲" : "▼"}
        </button>
        {showUsdc && (
          <div style={{ marginTop: 10 }}>
            <div style={{ color: "#9aabb8", fontSize: 10, marginBottom: 6, lineHeight: 1.5 }}>
              Send USDC on <span style={{ color: "#a78bfa" }}>World Chain</span> to the address below,
              then paste your tx hash to get credits instantly.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1, background: "#0d1117", border: "1px solid #374151", borderRadius: 6, padding: "5px 8px", fontSize: 9, fontFamily: "monospace", color: "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {PLATFORM_WALLET_ADDRESS}
              </div>
              <button onClick={copyAddress} style={{ background: "#1a1a2e", border: "1px solid #374151", borderRadius: 6, padding: "5px 8px", fontSize: 10, color: copied ? "#34d399" : "#9aabb8", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input
                value={usdcAmt}
                onChange={e => setUsdcAmt(e.target.value)}
                placeholder="Amount (USDC)"
                type="number" min="0.01" step="0.01"
                style={{ flex: 1, background: "#0d1117", border: "1px solid #374151", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: "#f9fafb", fontFamily: "inherit", outline: "none" }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input
                value={txHash}
                onChange={e => setTxHash(e.target.value)}
                placeholder="Transaction hash (0x...)"
                style={{ flex: 1, background: "#0d1117", border: "1px solid #374151", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: "#f9fafb", fontFamily: "monospace", outline: "none" }}
              />
            </div>
            <button
              onClick={submitUsdcDeposit}
              disabled={usdcBusy || !txHash.trim() || !usdcAmt}
              style={{ width: "100%", background: usdcBusy ? "#374151" : "#4f46e5", border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, color: "#fff", cursor: usdcBusy ? "default" : "pointer", fontFamily: "inherit" }}>
              {usdcBusy ? "Verifying on-chain..." : "Verify & Add Credits"}
            </button>
            {usdcMsg && (
              <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: usdcMsg.startsWith("Error") ? "#f87171" : "#34d399" }}>
                {usdcMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Withdraw / Request Payout */}
      <div style={{ marginTop: 10, borderTop: "1px solid #1f2937", paddingTop: 10 }}>
        <button onClick={() => setShowWithdraw(v => !v)} style={{ background: "none", border: "1px solid #374151", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#34d399", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 12 }}>↑</span> Request Payout {showWithdraw ? "▲" : "▼"}
        </button>
        {showWithdraw && (
          <div style={{ marginTop: 10 }}>
            <div style={{ color: "#9aabb8", fontSize: 10, marginBottom: 8, lineHeight: 1.5 }}>
              Credits are converted to USDC and sent to your World Chain address within 24 hours.
              <br /><span style={{ color: "#E6C36B" }}>Available: {credits !== null ? `${credits} credits ($${(credits / 100).toFixed(2)})` : "—"}</span>
            </div>
            <input
              value={withdrawAddr}
              onChange={e => setWithdrawAddr(e.target.value)}
              placeholder="Your ETH address (0x...)"
              style={{ width: "100%", background: "#0d1117", border: "1px solid #374151", borderRadius: 6, padding: "6px 8px", fontSize: 11, color: "#f9fafb", fontFamily: "monospace", outline: "none", marginBottom: 6, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input
                value={withdrawAmt}
                onChange={e => setWithdrawAmt(e.target.value)}
                placeholder="Amount in USD"
                type="number" min="1" step="0.01" max={credits ? credits / 100 : 0}
                style={{ flex: 1, background: "#0d1117", border: "1px solid #374151", borderRadius: 6, padding: "6px 8px", fontSize: 11, color: "#f9fafb", fontFamily: "inherit", outline: "none" }}
              />
              <button onClick={() => setWithdrawAmt(credits ? (credits / 100).toFixed(2) : "")} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "6px 10px", fontSize: 10, color: "#9aabb8", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Max</button>
            </div>
            <button
              onClick={submitWithdraw}
              disabled={withdrawBusy || !withdrawAmt || !withdrawAddr.trim() || parseFloat(withdrawAmt) <= 0}
              style={{ width: "100%", background: withdrawBusy ? "#374151" : "#065f46", border: "1px solid #059669", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, color: "#34d399", cursor: withdrawBusy ? "default" : "pointer", fontFamily: "inherit" }}>
              {withdrawBusy ? "Submitting..." : "Request Payout"}
            </button>
            {withdrawMsg && (
              <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: withdrawMsg.startsWith("Error") ? "#f87171" : "#34d399", lineHeight: 1.5 }}>
                {withdrawMsg}
              </div>
            )}
            {payouts.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Payout History</div>
                {payouts.slice(0, 5).map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4, fontFamily: "monospace" }}>
                    <span style={{ color: "#6b7280" }}>{p.eth_address.slice(0, 10)}...</span>
                    <span style={{ color: "#E6C36B" }}>${p.amount_usd.toFixed(2)}</span>
                    <span style={{ color: p.status === "paid" ? "#34d399" : p.status === "pending" ? "#f59e0b" : "#9aabb8" }}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {txns.length > 0 && (
        <div style={{ marginTop: 14, borderTop: "1px solid #1f2937", paddingTop: 12 }}>
          <div style={{ color: "#9aabb8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 8 }}>Recent Transactions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {txns.slice(0, 8).map((t, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontFamily: "monospace" }}>
                <span style={{ color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
                  {t.agent_id ? t.agent_id.slice(0, 8) : t.pipeline_id ? `pipe:${t.pipeline_id.slice(0, 6)}` : "deposit"}
                </span>
                <span style={{ color: t.amount > 0 ? "#f87171" : "#34d399", fontWeight: 700, flexShrink: 0 }}>
                  {t.amount > 0 ? "-" : "+"}{Math.round(Math.abs(t.amount) * 100)} cr
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Schedules panel ─────────────────────────────────────────────────────── */

const INTERVALS = ["5min", "15min", "hourly", "6h", "daily", "weekly"];
const INTERVAL_LABELS = { "5min": "Every 5 min", "15min": "Every 15 min", hourly: "Hourly", "6h": "Every 6h", daily: "Daily", weekly: "Weekly" };

function SchedulesPanel({ token }) {
  const [schedules,   setSchedules]   = useState([]);
  const [pipelines,   setPipelines]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState({ pipeline_id: "", interval: "hourly", label: "", webhook_url: "" });
  const [creating,    setCreating]    = useState(false);
  const [formErr,     setFormErr]     = useState("");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = () => {
    Promise.all([
      fetch(`${API}/schedules`, { headers }).then(r => r.json()).catch(() => []),
      fetch(`${API}/pipelines`,  { headers }).then(r => r.json()).catch(() => []),
    ]).then(([s, p]) => {
      setSchedules(Array.isArray(s) ? s : []);
      setPipelines(Array.isArray(p) ? p : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.pipeline_id || !form.interval) { setFormErr("Select a pipeline and interval"); return; }
    setCreating(true); setFormErr("");
    try {
      const res = await fetch(`${API}/schedules`, { method: "POST", headers, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || "Failed"); }
      setShowForm(false);
      setForm({ pipeline_id: "", interval: "hourly", label: "", webhook_url: "" });
      load();
    } catch (e) { setFormErr(e.message); }
    finally { setCreating(false); }
  };

  const toggle = async (id) => {
    await fetch(`${API}/schedules/${id}/toggle`, { method: "PATCH", headers });
    load();
  };

  const remove = async (id) => {
    await fetch(`${API}/schedules/${id}`, { method: "DELETE", headers });
    setSchedules(s => s.filter(x => x.id !== id));
  };

  const trigger = async (id) => {
    await fetch(`${API}/schedules/${id}/trigger`, { method: "POST", headers });
    load();
  };

  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const diff = Math.round((d - Date.now()) / 1000);
    if (diff > 0) return `in ${diff < 60 ? `${diff}s` : diff < 3600 ? `${Math.round(diff/60)}m` : `${Math.round(diff/3600)}h`}`;
    return `${Math.abs(diff) < 60 ? "just now" : Math.abs(diff) < 3600 ? `${Math.round(Math.abs(diff)/60)}m ago` : new Date(iso).toLocaleTimeString()}`;
  };

  if (loading) return <div style={{ color: "#9aabb8", padding: "32px 0", textAlign: "center" }}>Loading schedules…</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 16 }}>Pipeline Schedules</div>
          <div style={{ color: "#9aabb8", fontSize: 12, marginTop: 2 }}>Auto-run pipelines on a recurring interval</div>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ background: "#4f46e5", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
          {showForm ? "Cancel" : "+ New Schedule"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <Label>Pipeline</Label>
              <select value={form.pipeline_id} onChange={e => setForm(f => ({ ...f, pipeline_id: e.target.value }))}
                style={{ ...FIELD, appearance: "none" }}>
                <option value="">Select a pipeline…</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Interval</Label>
              <select value={form.interval} onChange={e => setForm(f => ({ ...f, interval: e.target.value }))}
                style={{ ...FIELD, appearance: "none" }}>
                {INTERVALS.map(i => <option key={i} value={i}>{INTERVAL_LABELS[i]}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>Label (optional)</Label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="My daily signal check" style={FIELD} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Webhook URL (optional — receive results via POST)</Label>
            <input value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
              placeholder="https://your-server.com/webhook" style={FIELD} />
          </div>
          {formErr && <div style={{ color: "#f87171", fontSize: 11, marginBottom: 10 }}>{formErr}</div>}
          <button onClick={create} disabled={creating} style={BTN("#4f46e5", creating)}>
            {creating ? "Creating…" : "Create Schedule"}
          </button>
        </div>
      )}

      {schedules.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#9aabb8", fontSize: 13 }}>
          No schedules yet — create one to auto-run a pipeline on a recurring basis.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {schedules.map(s => (
            <div key={s.id} style={{ background: "#111827", border: `1px solid ${s.is_active ? "#374151" : "#1f2937"}`, borderLeft: `3px solid ${s.is_active ? "#4f46e5" : "#374151"}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#f9fafb", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.label || s.pipeline_name}</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ color: "#818cf8", fontSize: 10, fontWeight: 600 }}>{INTERVAL_LABELS[s.interval] || s.interval}</span>
                    <span style={{ color: "#9aabb8", fontSize: 10 }}>Next: {fmtTime(s.next_run_at)}</span>
                    {s.last_run_at && <span style={{ color: "#6b7280", fontSize: 10 }}>Last: {fmtTime(s.last_run_at)}</span>}
                    {s.webhook_url && <span style={{ color: "#34d399", fontSize: 10 }}>Webhook ✓</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => trigger(s.id)} title="Run now" style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "4px 10px", fontSize: 10, color: "#f59e0b", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>▶ Run</button>
                  <button onClick={() => toggle(s.id)} style={{ background: s.is_active ? "#064e3b20" : "#1f2937", border: `1px solid ${s.is_active ? "#059669" : "#374151"}`, borderRadius: 6, padding: "4px 10px", fontSize: 10, color: s.is_active ? "#34d399" : "#9aabb8", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                    {s.is_active ? "Active" : "Paused"}
                  </button>
                  <button onClick={() => remove(s.id)} title="Delete" style={{ background: "none", border: "1px solid #374151", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Analytics panel ─────────────────────────────────────────────────────── */

function AnalyticsPanel({ agents, metrics }) {
  if (agents.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0", color: "#9aabb8", fontSize: 13 }}>
        No agents yet — deploy your first agent to see analytics.
      </div>
    );
  }

  const sorted = [...agents].sort((a, b) => {
    const ea = metrics[a.id]?.earnings || 0;
    const eb = metrics[b.id]?.earnings || 0;
    return eb - ea;
  });

  const maxEarnings = Math.max(...sorted.map(a => metrics[a.id]?.earnings || 0), 0.001);
  const maxCalls    = Math.max(...sorted.map(a => metrics[a.id]?.requests || 0), 1);
  const totalEarned = sorted.reduce((s, a) => s + (metrics[a.id]?.earnings || 0), 0);
  const totalCalls  = sorted.reduce((s, a) => s + (metrics[a.id]?.requests || 0), 0);
  const avgSuccess  = sorted.reduce((s, a) => s + (metrics[a.id]?.success_rate ?? 1), 0) / sorted.length;

  const CAT_COLOR = { trading: "#4DD9B8", analysis: "#C8A0F8", data: "#38C8F4", risk: "#FF8096", composite: "#FFD840" };
  const catColor = (c) => CAT_COLOR[c] || "#818cf8";

  return (
    <div>
      {/* Summary pills */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Total Earned",   value: `$${totalEarned.toFixed(4)}`,          color: "#E6C36B" },
          { label: "Total Calls",    value: totalCalls.toLocaleString(),            color: "#6BCF8B" },
          { label: "Avg Success",    value: `${(avgSuccess * 100).toFixed(1)}%`,   color: "#818cf8" },
          { label: "Agents Live",    value: agents.length,                          color: "#34d399" },
        ].map(p => (
          <div key={p.label} style={{ background: `${p.color}0f`, border: `1px solid ${p.color}30`, borderRadius: 10, padding: "10px 16px", minWidth: 110 }}>
            <div style={{ color: "#9aabb8", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{p.label}</div>
            <div style={{ color: p.color, fontWeight: 800, fontSize: 18 }}>{p.value}</div>
          </div>
        ))}
      </div>

      {/* Earnings bar chart */}
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ color: "#f9fafb", fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Earnings by Agent</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map(a => {
            const m = metrics[a.id] || {};
            const pct = ((m.earnings || 0) / maxEarnings) * 100;
            const color = catColor(a.category);
            return (
              <div key={a.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#d1d5db", fontSize: 11, fontWeight: 600 }}>{a.name}</span>
                  <span style={{ color, fontSize: 11, fontWeight: 700 }}>${(m.earnings || 0).toFixed(4)}</span>
                </div>
                <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calls bar chart */}
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ color: "#f9fafb", fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Calls by Agent</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map(a => {
            const m = metrics[a.id] || {};
            const pct = ((m.requests || 0) / maxCalls) * 100;
            const color = catColor(a.category);
            return (
              <div key={a.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#d1d5db", fontSize: 11, fontWeight: 600 }}>{a.name}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: "#9aabb8", fontSize: 10 }}>{(m.avg_latency_ms || 0).toFixed(0)}ms</span>
                    <span style={{ color: (m.success_rate ?? 1) > 0.9 ? "#34d399" : "#f87171", fontSize: 10, fontWeight: 700 }}>{((m.success_rate ?? 1) * 100).toFixed(0)}%</span>
                    <span style={{ color, fontSize: 11, fontWeight: 700 }}>{m.requests || 0}</span>
                  </div>
                </div>
                <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

export default function DeveloperView() {
  const [agents,    setAgents]    = useState([]);
  const [metrics,   setMetrics]   = useState({});
  const [selected,  setSelected]  = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [filter,    setFilter]    = useState("");
  const [tab,       setTab]       = useState("agents");   // "agents" | "mine" | "register" | "keys"
  const [auth,      setAuth]      = useState(null);       // { token, user_id, username }
  const { show: showToast, ToastContainer } = useToast();

  // Restore session
  useEffect(() => {
    const token = localStorage.getItem("av_token");
    const user  = localStorage.getItem("av_user");
    if (token && user) setAuth({ token, ...JSON.parse(user) });
  }, []);

  const loadAgents = () =>
    Promise.all([
      fetch(`${API}/agents`).then(r => r.json()).catch(() => []),
      fetch(`${API}/metrics`).then(r => r.json()).catch(() => []),
    ]).then(([a, m]) => {
      setAgents(Array.isArray(a) ? a : []);
      setMetrics(Object.fromEntries((Array.isArray(m) ? m : []).map(x => [x.agent_id, x])));
    }).catch(() => {});

  useEffect(() => { loadAgents(); const iv = setInterval(loadAgents, 10000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`${API}/agents/${selected.id}/pipelines`).then(r => r.json()).then(setPipelines).catch(() => setPipelines([]));
  }, [selected?.id]);

  const totalCalls    = Object.values(metrics).reduce((s, m) => s + (m?.requests || 0), 0);
  const totalEarnings = Object.values(metrics).reduce((s, m) => s + (m?.earnings || 0), 0).toFixed(4);
  const visible = useMemo(() => {
    if (!filter) return agents;
    const q = filter.toLowerCase();
    return agents.filter(a => a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
  }, [agents, filter]);

  const [showWelcome, setShowWelcome] = useState(false);

  const handleAuth = (data) => {
    setAuth({ token: data.token, user_id: data.user_id, username: data.username });
    const key = `av_welcomed_${data.user_id}`;
    if (!localStorage.getItem(key)) {
      setShowWelcome(true);
    }
    showToast(`Welcome, @${data.username}!`);
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
    if (auth?.user_id) localStorage.setItem(`av_welcomed_${auth.user_id}`, "1");
  };
  const handleLogout = () => { localStorage.removeItem("av_token"); localStorage.removeItem("av_user"); setAuth(null); showToast("Signed out", "warning"); };

  const myAgents = useMemo(() =>
    auth ? agents.filter(a => a.developer_name === auth.username) : [],
    [agents, auth]
  );

  const TABS = [
    { id: "agents",    label: "All Agents" },
    ...(auth ? [{ id: "mine",      label: `My Agents (${myAgents.length})` }] : []),
    ...(auth ? [{ id: "analytics", label: "Analytics" }] : []),
    ...(auth ? [{ id: "schedules", label: "Schedules" }] : []),
    { id: "market",    label: "Agent Market" },
    { id: "jobs",      label: "Pipeline Jobs" },
    { id: "guide",     label: "Deploy Guide" },
    { id: "register",  label: auth ? "Import Agent" : "Sign In / Register" },
    ...(auth ? [{ id: "keys", label: "API Keys" }] : []),
  ];

  return (
    <div style={{ height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#0a0a0f", padding: "clamp(16px,4vw,28px) clamp(12px,4vw,20px)", fontFamily: "var(--font-nunito), Nunito, system-ui, sans-serif" }}>
      <style>{`
        @media (max-width: 640px) {
          .dv-header { flex-wrap: wrap !important; gap: 10px !important; }
          .dv-header-actions { flex-wrap: wrap !important; gap: 6px !important; }
          .dv-mine-grid { grid-template-columns: 1fr !important; }
          .dv-mine-inner { grid-template-columns: 1fr !important; }
          .dv-jobs-table { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        }
      `}</style>

      {/* Header */}
      <div className="dv-header" style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "#f9fafb", fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>Developer Hub</div>
          <div style={{ color: "#9aabb8", fontSize: 13, marginTop: 4 }}>Monitor agents, manage API keys, track revenue.</div>
        </div>
        {auth ? (
          <div className="dv-header-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "#818cf818", border: "1px solid #818cf840", borderRadius: 20, padding: "4px 14px", color: "#818cf8", fontSize: 12, fontWeight: 700 }}>@{auth.username}</div>
            <button onClick={() => setTab("mine")} style={{ background: "none", border: "1px solid #6BCF8B40", color: "#6BCF8B", borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>My Agents</button>
            <button onClick={handleLogout} style={{ background: "none", border: "1px solid #374151", color: "#9aabb8", borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#9aabb8" }}>
            <a onClick={() => setTab("register")} style={{ color: "#818cf8", cursor: "pointer", fontWeight: 700 }}>Sign in</a> to manage your agents
          </div>
        )}
      </div>

      <PlatformHealth />

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <Pill label="Agents" value={agents.length} color="#6366f1" />
        <Pill label="Total Calls" value={totalCalls} color="#6BCF8B" />
        <Pill label="Total Earned" value={`$${parseFloat(totalEarnings).toFixed(4)}`} color="#E6C36B" />
      </div>

      {/* Welcome banner — shown once after first sign-in */}
      {auth && showWelcome && (
        <div style={{
          background: "linear-gradient(135deg, #1a1040 0%, #111827 100%)",
          border: "1px solid #818cf840", borderRadius: 14,
          padding: "18px 20px", marginBottom: 20, position: "relative",
        }}>
          <button onClick={dismissWelcome} style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>×</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 22 }}>🎉</span>
            <div>
              <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14 }}>Welcome to AgentVerse, @{auth.username}!</div>
              <div style={{ color: "#818cf8", fontSize: 12, marginTop: 2 }}>You have <strong>500 free credits ($5.00)</strong> to get started.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {[
              ["🤖", "Import an agent", "Bring any HTTP endpoint into AgentVerse — it gets a public page, call logs, and earns credits per call."],
              ["🔗", "Build a pipeline", "Chain agents together in the Playground. Save it as a composite agent and deploy it to the Marketplace."],
              ["💸", "Earn per call", "Every call to your agent credits your wallet. Add a Base wallet to receive USDC directly."],
            ].map(([icon, title, body]) => (
              <div key={title} style={{ flex: "1 1 150px", background: "#ffffff08", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
                <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 11, marginBottom: 3 }}>{title}</div>
                <div style={{ color: "#9aabb8", fontSize: 10, lineHeight: 1.6 }}>{body}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => { setTab("register"); dismissWelcome(); }} style={{ background: "#818cf8", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Import Agent →</button>
            <button onClick={dismissWelcome} style={{ background: "none", border: "1px solid #374151", color: "#9aabb8", borderRadius: 8, padding: "7px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Not signed in nudge */}
      {!auth && tab === "agents" && (
        <div style={{
          background: "#111827", border: "1px solid #1f2937", borderRadius: 12,
          padding: "12px 18px", marginBottom: 18,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
        }}>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            Sign in to register your own agents, track calls, and earn credits per API call.
          </div>
          <button onClick={() => setTab("register")} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 9, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Sign In / Register
          </button>
        </div>
      )}

      {/* Tab bar — horizontally scrollable on mobile */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none", paddingBottom: 2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: tab === t.id ? "#818cf818" : "transparent", color: tab === t.id ? "#818cf8" : "#9aabb8", boxShadow: tab === t.id ? "inset 0 0 0 1px #818cf840" : "none", transition: "all 0.15s", fontFamily: "inherit", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* My Agents tab */}
      {tab === "mine" && auth && (
        <div className="dv-mine-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) min(280px,100%)", gap: 16, alignItems: "start" }}>
          <div className="dv-mine-inner" style={{ display: "grid", gridTemplateColumns: "min(280px,100%) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
            <div style={{ background: "#111827", borderRadius: 16, padding: "14px 8px", border: "1px solid #1f2937", boxShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>
              {myAgents.length === 0 ? (
                <div style={{ color: "#9aabb8", fontSize: 12, fontStyle: "italic", textAlign: "center", padding: "24px 16px" }}>
                  You haven&apos;t registered any agents yet.<br />
                  <span style={{ color: "#818cf8", cursor: "pointer", fontWeight: 700 }} onClick={() => setTab("register")}>Register your first agent →</span>
                </div>
              ) : myAgents.map(a => (
                <AgentRow key={a.id} agent={a} metrics={metrics[a.id]} selected={selected} onClick={setSelected} />
              ))}
            </div>
            <div>
              {selected && myAgents.find(a => a.id === selected.id) && (
                <AgentDetail agent={selected} metrics={metrics[selected.id]} pipelines={pipelines}
                  token={auth?.token}
                  onDeleted={() => { loadAgents(); setSelected(null); showToast("Agent removed"); }}
                  onUpdated={() => { loadAgents(); showToast("Agent updated"); }} />
              )}
            </div>
          </div>
          <div>
            <CreditsPanel auth={auth} />
          </div>
        </div>
      )}

      {/* Jobs tab */}
      {tab === "analytics" && auth && <AnalyticsPanel agents={myAgents} metrics={metrics} />}
      {tab === "schedules" && auth && <SchedulesPanel token={auth.token} />}
      {tab === "market" && <AgentJobsMarket auth={auth} myAgents={myAgents} />}
      {tab === "jobs" && <JobsPanel />}

      {/* Deploy Guide tab */}
      {tab === "guide" && <DeployGuide />}

      {/* API Keys tab */}
      {tab === "keys" && auth && (
        <div style={{ background: "#111827", borderRadius: 16, padding: "20px 22px", border: "1px solid #1f2937", boxShadow: "0 2px 10px rgba(0,0,0,0.3)", marginBottom: 20 }}>
          <ApiKeyManager token={auth.token} />
        </div>
      )}

      {/* Register tab */}
      {tab === "register" && !auth && (
        <div style={{ marginBottom: 20 }}>
          <AuthPanel onAuth={handleAuth} />
        </div>
      )}
      {tab === "register" && auth && (
        <div style={{ background: "#111827", borderRadius: 16, padding: "20px 22px", border: "1px solid #1f2937", boxShadow: "0 2px 10px rgba(0,0,0,0.3)", marginBottom: 20 }}>
          <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Import & Deploy Agent</div>
          <div style={{ color: "#9aabb8", fontSize: 11, marginBottom: 14 }}>Any HTTP endpoint — finance, productivity, creative, automation — becomes a live agent in 60 seconds.</div>
          <RegisterForm token={auth.token} onDone={() => { loadAgents(); setTab("agents"); }} />
        </div>
      )}

      {/* Agents tab */}
      {tab === "agents" && (
        <div style={{ display: "grid", gridTemplateColumns: "min(280px,100%) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
          <div style={{ background: "#111827", borderRadius: 16, padding: "14px 8px", border: "1px solid #1f2937", boxShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>
            <div style={{ padding: "0 8px 10px", borderBottom: "1px solid #1f2937", marginBottom: 8 }}>
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter agents…" style={{ width: "100%", border: "1px solid #374151", borderRadius: 8, padding: "6px 10px", fontSize: 12, outline: "none", fontFamily: "inherit", background: "#1f2937", color: "#f3f4f6", boxSizing: "border-box" }} />
            </div>
            {visible.length === 0 ? (
              <div style={{ color: "#9aabb8", fontSize: 12, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>No agents found.</div>
            ) : visible.map(a => (
              <AgentRow key={a.id} agent={a} metrics={metrics[a.id]} selected={selected} onClick={setSelected} />
            ))}
          </div>

          <div style={{ background: "#111827", borderRadius: 16, padding: "20px 22px", border: "1px solid #1f2937", boxShadow: "0 2px 10px rgba(0,0,0,0.3)", minHeight: 400 }}>
            {selected ? (
              <AgentDetail agent={selected} metrics={metrics[selected.id]} pipelines={pipelines} token={auth?.token} onHealthCheck={loadAgents}
                onDeleted={() => { loadAgents(); setSelected(null); showToast("Agent removed"); }}
                onUpdated={() => { loadAgents(); showToast("Agent updated"); }} />
            ) : (
              <Leaderboard agents={agents} metrics={metrics} />
            )}
          </div>
        </div>
      )}

      <div style={{ height: 40 }} />
      <ToastContainer />
    </div>
  );
}
