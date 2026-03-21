"use client";
import { useState, useEffect } from "react";
import { API } from "@/app/lib/config";

/**
 * Shared auth hook — reads av_token / av_user from localStorage
 * and optionally fetches wallet balance.
 *
 * Returns: { user, token, walletBalance, reload }
 */
export function useAuth({ fetchWallet = false } = {}) {
  const [user,          setUser]          = useState(null);
  const [token,         setToken]         = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);

  const reload = () => {
    const t = localStorage.getItem("av_token");
    const u = localStorage.getItem("av_user");
    setToken(t || null);
    try { setUser(u ? JSON.parse(u) : null); } catch { setUser(null); }
  };

  useEffect(() => {
    reload();
    const onStorage = (e) => {
      if (e.key === "av_token" || e.key === "av_user") reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!fetchWallet) return;
    const load = () => {
      const t = localStorage.getItem("av_token");
      const u = localStorage.getItem("av_user");
      if (t && u) {
        try {
          const parsed = JSON.parse(u);
          const walletId = parsed.wallet_id || parsed.id;
          if (walletId) {
            fetch(`${API}/wallets/${walletId}`, {
              headers: { Authorization: `Bearer ${t}` },
            })
              .then(r => r.ok ? r.json() : null)
              .then(w => { if (w) setWalletBalance(w.balance); })
              .catch(() => {});
            return;
          }
        } catch {}
      }
      // fallback to demo wallet
      fetch(`${API}/wallets/demo`)
        .then(r => r.json())
        .then(w => setWalletBalance(w.balance))
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [fetchWallet]);

  return { user, token, walletBalance, reload };
}
