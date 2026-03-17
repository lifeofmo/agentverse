#!/usr/bin/env python3
"""
AgentVerse Seed Script
Registers all demo agents and creates demo pipelines.

Usage:
  1. Start the backend:   cd backend && uvicorn main:app --port 8000
  2. Start agent server:  cd agents  && uvicorn server:app --port 8001
  3. Run this script:     python seed.py
"""
import sys
import requests

API    = "http://127.0.0.1:8000"
AGENTS = "http://127.0.0.1:8001"

# ── Agent definitions ──────────────────────────────────────────────────────────

SEED_AGENTS = [
    # Trading
    {
        "name":              "MomentumAgent",
        "description":       "Momentum signal generator. Returns BUY/SELL/HOLD with confidence score based on price action.",
        "endpoint":          f"{AGENTS}/momentum/run",
        "category":          "trading",
        "price_per_request": 0.004,
        "developer_name":    "AgentVerse",
        "developer_color":   "#58D68D",
    },
    {
        "name":              "ArbitrageAgent",
        "description":       "Detects cross-exchange arbitrage opportunities and estimates net profit after fees.",
        "endpoint":          f"{AGENTS}/arbitrage/run",
        "category":          "trading",
        "price_per_request": 0.006,
        "developer_name":    "AgentVerse",
        "developer_color":   "#58D68D",
    },
    {
        "name":              "SentimentAgent",
        "description":       "Aggregates social and on-chain signals into a Fear & Greed score (0–100).",
        "endpoint":          f"{AGENTS}/sentiment/run",
        "category":          "trading",
        "price_per_request": 0.003,
        "developer_name":    "AgentVerse",
        "developer_color":   "#58D68D",
    },
    {
        "name":              "VolatilityScanner",
        "description":       "Computes implied and realized volatility. Returns regime classification and hedging recommendation.",
        "endpoint":          f"{AGENTS}/volatility/run",
        "category":          "trading",
        "price_per_request": 0.005,
        "developer_name":    "AgentVerse",
        "developer_color":   "#58D68D",
    },
    # Data
    {
        "name":              "PriceFeedAgent",
        "description":       "Real-time price feed with 24h stats. Covers BTC, ETH, SOL, AVAX, BNB.",
        "endpoint":          f"{AGENTS}/price-feed/run",
        "category":          "data",
        "price_per_request": 0.001,
        "developer_name":    "AgentVerse",
        "developer_color":   "#5DADE2",
    },
    {
        "name":              "NewsFeedAgent",
        "description":       "Aggregates crypto headlines and scores their sentiment impact on price.",
        "endpoint":          f"{AGENTS}/news-feed/run",
        "category":          "data",
        "price_per_request": 0.002,
        "developer_name":    "AgentVerse",
        "developer_color":   "#5DADE2",
    },
    {
        "name":              "MarketDepthAgent",
        "description":       "Measures order book depth, bid-ask spread, and liquidity score across venues.",
        "endpoint":          f"{AGENTS}/market-depth/run",
        "category":          "data",
        "price_per_request": 0.003,
        "developer_name":    "AgentVerse",
        "developer_color":   "#5DADE2",
    },
    # Analysis
    {
        "name":              "TrendAnalyzer",
        "description":       "Multi-timeframe trend detection using EMA crossovers and ADX strength.",
        "endpoint":          f"{AGENTS}/trend/run",
        "category":          "analysis",
        "price_per_request": 0.004,
        "developer_name":    "AgentVerse",
        "developer_color":   "#BB8FCE",
    },
    {
        "name":              "PatternDetector",
        "description":       "Identifies chart patterns (flags, triangles, head & shoulders) with confidence scores.",
        "endpoint":          f"{AGENTS}/pattern/run",
        "category":          "analysis",
        "price_per_request": 0.005,
        "developer_name":    "AgentVerse",
        "developer_color":   "#BB8FCE",
    },
    {
        "name":              "CorrelationAgent",
        "description":       "Measures cross-asset correlations and identifies risk-on / risk-off market regimes.",
        "endpoint":          f"{AGENTS}/correlation/run",
        "category":          "analysis",
        "price_per_request": 0.003,
        "developer_name":    "AgentVerse",
        "developer_color":   "#BB8FCE",
    },
    # Risk
    {
        "name":              "RiskAgent",
        "description":       "Portfolio risk scoring with VaR, max drawdown estimation, and position sizing recommendation.",
        "endpoint":          f"{AGENTS}/risk/run",
        "category":          "risk",
        "price_per_request": 0.005,
        "developer_name":    "AgentVerse",
        "developer_color":   "#EC7063",
    },
    {
        "name":              "PortfolioOptimizer",
        "description":       "Runs mean-variance optimization to compute optimal allocation and Sharpe ratio.",
        "endpoint":          f"{AGENTS}/portfolio/run",
        "category":          "risk",
        "price_per_request": 0.008,
        "developer_name":    "AgentVerse",
        "developer_color":   "#EC7063",
    },
]

# ── Pipeline definitions (built after agents are registered) ──────────────────

PIPELINE_TEMPLATES = [
    {
        "name":   "MarketPulse",
        "agents": ["PriceFeedAgent", "SentimentAgent", "MomentumAgent"],
    },
    {
        "name":   "RiskCheck",
        "agents": ["PriceFeedAgent", "VolatilityScanner", "RiskAgent"],
    },
    {
        "name":   "TrendAnalysis",
        "agents": ["PriceFeedAgent", "TrendAnalyzer", "PatternDetector", "MomentumAgent"],
    },
    {
        "name":   "AlphaSignal",
        "agents": ["NewsFeedAgent", "SentimentAgent", "CorrelationAgent", "MomentumAgent"],
    },
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def check_server(url, name):
    try:
        r = requests.get(url, timeout=3)
        r.raise_for_status()
        print(f"  ✓  {name} reachable")
        return True
    except Exception as e:
        print(f"  ✗  {name} not reachable: {e}")
        return False

def register_agent(agent_def):
    try:
        r = requests.post(f"{API}/agents", json=agent_def, timeout=8)
        r.raise_for_status()
        rec = r.json()
        print(f"  ✓  {rec['name']:<24}  id={rec['id'][:8]}…  ${agent_def['price_per_request']}/call")
        return rec
    except Exception as e:
        print(f"  ✗  {agent_def['name']}: {e}")
        return None

def create_pipeline(name, agent_ids):
    try:
        r = requests.post(f"{API}/pipelines", json={"name": name, "agent_ids": agent_ids}, timeout=8)
        r.raise_for_status()
        rec = r.json()
        print(f"  ✓  {rec['name']:<24}  id={rec['id'][:8]}…  ({len(agent_ids)} agents)")
        return rec
    except Exception as e:
        print(f"  ✗  {name}: {e}")
        return None

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("\n══════════════════════════════════════════")
    print("  AgentVerse Seed Script")
    print("══════════════════════════════════════════\n")

    print("Checking servers…")
    ok_api    = check_server(f"{API}/",    "Backend API  (port 8000)")
    ok_agents = check_server(f"{AGENTS}/", "Agent Server (port 8001)")

    if not ok_api or not ok_agents:
        print("\n  Start both servers before running this script:")
        print("    cd backend && uvicorn main:app --port 8000 --reload")
        print("    cd agents  && uvicorn server:app --port 8001 --reload")
        sys.exit(1)

    # Skip agents that are already registered
    print("\nFetching existing agents…")
    try:
        existing = requests.get(f"{API}/agents").json()
        existing_names = {a["name"] for a in existing}
        print(f"  {len(existing_names)} agent(s) already registered")
    except Exception:
        existing_names = set()

    # Register agents
    print(f"\nRegistering {len(SEED_AGENTS)} seed agents…")
    registered = {}
    for agent_def in SEED_AGENTS:
        if agent_def["name"] in existing_names:
            # Find the existing ID
            for ea in existing:
                if ea["name"] == agent_def["name"]:
                    registered[agent_def["name"]] = ea
                    print(f"  →  {agent_def['name']:<24}  already registered, skipping")
                    break
        else:
            rec = register_agent(agent_def)
            if rec:
                registered[rec["name"]] = rec

    # Create pipelines
    print(f"\nCreating demo pipelines…")
    try:
        existing_pipes = {p["name"] for p in requests.get(f"{API}/pipelines").json()}
    except Exception:
        existing_pipes = set()

    for tmpl in PIPELINE_TEMPLATES:
        if tmpl["name"] in existing_pipes:
            print(f"  →  {tmpl['name']:<24}  already exists, skipping")
            continue
        agent_ids = [registered[name]["id"] for name in tmpl["agents"] if name in registered]
        if len(agent_ids) == len(tmpl["agents"]):
            create_pipeline(tmpl["name"], agent_ids)
        else:
            missing = [n for n in tmpl["agents"] if n not in registered]
            print(f"  ✗  {tmpl['name']}: missing agents {missing}")

    # Summary
    print("\n══════════════════════════════════════════")
    total = len(registered)
    print(f"  {total} agent(s) ready in the marketplace")
    print(f"  {len(PIPELINE_TEMPLATES)} demo pipelines created")
    print(f"\n  Open http://localhost:3000 → Agent City")
    print("══════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
