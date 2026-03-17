"use client";

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[AgentVerse] Render error:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          height: "100%", gap: 16,
          background: "linear-gradient(180deg, #cfe9ff 0%, #f4e7d0 100%)",
          fontFamily: "inherit",
        }}>
          <div style={{
            background: "#fff", border: "1px solid #e6d6bd",
            borderRadius: 16, padding: "32px 40px", textAlign: "center",
            maxWidth: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: "#2d3a4a", fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ color: "#9aabb8", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                background: "#4a9fd4", color: "#fff", border: "none",
                borderRadius: 10, padding: "9px 24px", fontSize: 13,
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
