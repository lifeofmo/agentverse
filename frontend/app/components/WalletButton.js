"use client";

import { useWallet } from "./WalletProvider";

export default function WalletButton() {
  const { account, connect, disconnect, connecting, error } = useWallet();

  if (account) {
    const short = `${account.slice(0, 6)}…${account.slice(-4)}`;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          title={`Connected: ${account}\nBase Sepolia — click to disconnect`}
          onClick={disconnect}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#d1fae518", border: "1px solid #6BCF8B40",
            borderRadius: 20, padding: "4px 12px",
            fontSize: 12, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6BCF8B", flexShrink: 0 }} />
          <span style={{ color: "#6BCF8B", fontWeight: 700 }}>{short}</span>
          <span style={{ color: "#9aabb8", fontSize: 10 }}>Base Sepolia</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={connect}
        disabled={connecting}
        title={error || "Connect MetaMask or Coinbase Wallet to make x402 payments"}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: connecting ? "#f8f6f2" : "#7c3aed14",
          border: "1px solid #7c3aed30",
          borderRadius: 20, padding: "4px 14px",
          fontSize: 12, cursor: connecting ? "default" : "pointer",
          fontFamily: "inherit", color: "#7c3aed", fontWeight: 700,
          opacity: connecting ? 0.6 : 1,
        }}
      >
        <span style={{ fontSize: 14 }}>⚡</span>
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && (
        <div style={{
          position: "absolute", top: 52, right: 16, zIndex: 200,
          background: "#fee2e2", border: "1px solid #fca5a5",
          borderRadius: 8, padding: "6px 12px",
          fontSize: 11, color: "#991b1b", maxWidth: 260,
        }}>{error}</div>
      )}
    </div>
  );
}
