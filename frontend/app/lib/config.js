/**
 * Central API/WS URL configuration.
 * Set NEXT_PUBLIC_API_URL in .env.local (or deployment env) to point at your backend.
 * Falls back to localhost for local development.
 */
export const API     = process.env.NEXT_PUBLIC_API_URL || "https://agentverse-production.up.railway.app";
export const WS      = process.env.NEXT_PUBLIC_WS_URL  || "wss://agentverse-production.up.railway.app/ws";
export const WS_BASE = WS.replace(/\/ws$/, "");
