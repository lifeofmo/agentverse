"use client";
import { useState, useEffect } from "react";

export function Toast({ message, type = "success", onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3800);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const color =
    type === "error"   ? "#ef4444" :
    type === "warning" ? "#f59e0b" :
                         "#10b981";

  return (
    <div style={{
      background: "#111827",
      border: `1px solid ${color}35`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
      padding: "12px 16px",
      color: "#f9fafb",
      fontSize: 13,
      fontWeight: 500,
      fontFamily: "system-ui, sans-serif",
      display: "flex",
      alignItems: "center",
      gap: 10,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      maxWidth: 340,
      animation: "toastIn 0.2s ease",
      cursor: "pointer",
    }} onClick={onDismiss}>
      <style>{`@keyframes toastIn { from { transform: translateX(16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      <span style={{ color: "#4b5563", fontSize: 16, lineHeight: 1 }}>×</span>
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = (message, type = "success") =>
    setToasts(t => [...t, { id: Date.now() + Math.random(), message, type }]);

  const dismiss = (id) => setToasts(t => t.filter(x => x.id !== id));

  function ToastContainer() {
    return (
      <div style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: "all" }}>
            <Toast {...t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    );
  }

  return { show, ToastContainer };
}
