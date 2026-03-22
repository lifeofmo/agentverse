"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { API } from "@/app/lib/config";

function ResetPasswordForm() {
  const params   = useSearchParams();
  const router   = useRouter();
  const token    = params.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [busy,      setBusy]      = useState(false);
  const [msg,       setMsg]       = useState({ type: "", text: "" });

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8)         { setMsg({ type: "err", text: "Password must be at least 8 characters." }); return; }
    if (password !== confirm)        { setMsg({ type: "err", text: "Passwords do not match." }); return; }
    setBusy(true); setMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed");
      setMsg({ type: "ok", text: "Password updated! Redirecting to sign in…" });
      setTimeout(() => router.push("/?tab=developer"), 2000);
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const field = {
    width: "100%", background: "#1f2937", border: "1px solid #374151",
    borderRadius: 10, color: "#f9fafb", padding: "11px 14px",
    fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{
      minHeight: "100dvh", background: "#0a0a0f",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        background: "#111827", border: "1px solid #1f2937",
        borderRadius: 18, padding: "36px 32px",
        width: "100%", maxWidth: 420,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: "#f9fafb", fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Set new password</div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>Enter a new password for your AgentVerse account.</div>
        </div>

        {!token && (
          <div style={{ background: "#450a0a", border: "1px solid #ef4444", borderRadius: 10, padding: "12px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>
            No reset token found. Please click the link in your email again.
          </div>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ color: "#9aabb8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 5 }}>New password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={field} required minLength={8} autoFocus />
          </div>
          <div>
            <label style={{ color: "#9aabb8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 5 }}>Confirm password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={field} required minLength={8} />
          </div>

          {msg.text && (
            <div style={{ background: msg.type === "err" ? "#450a0a" : "#052e16", border: `1px solid ${msg.type === "err" ? "#ef4444" : "#22c55e"}`, borderRadius: 10, padding: "10px 14px", color: msg.type === "err" ? "#fca5a5" : "#4ade80", fontSize: 13 }}>
              {msg.text}
            </div>
          )}

          <button type="submit" disabled={busy || !token} style={{
            background: busy || !token ? "#374151" : "#818cf8",
            color: busy || !token ? "#6b7280" : "#fff",
            border: "none", borderRadius: 10, padding: "12px",
            fontSize: 14, fontWeight: 700, cursor: busy || !token ? "not-allowed" : "pointer",
            fontFamily: "inherit", transition: "background 0.15s",
          }}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
