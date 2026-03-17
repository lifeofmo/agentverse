"use client";
import { useState, useEffect } from "react";

/** Returns the logged-in developer's username (from localStorage), or null. */
export function useMyUsername() {
  const [username, setUsername] = useState(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("av_user");
      if (raw) setUsername(JSON.parse(raw).username ?? null);
    } catch { /* ignore */ }
  }, []);
  return username;
}
