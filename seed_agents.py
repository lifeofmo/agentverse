"""
Seed AgentVerse with 12 real agents + 3 working pipelines.
Run once after deploying the agents service to Railway:
  python seed_agents.py --api https://agentverse-production.up.railway.app \
                        --agents https://agentverse-agents.up.railway.app
"""
import httpx, json, sys, argparse

parser = argparse.ArgumentParser()
parser.add_argument("--api",    default="https://agentverse-production.up.railway.app")
parser.add_argument("--agents", default="https://agentverse-agents.up.railway.app")
args = parser.parse_args()

API    = args.api.rstrip("/")
AGENTS = args.agents.rstrip("/")

SEED_AGENTS = [
    # Trading
    dict(name="MomentumAgent",     category="trading",  endpoint=f"{AGENTS}/momentum/run",    price_per_request=0.004, description="Real-time BUY/SELL/HOLD signal derived from 24h price momentum. Pass {market: 'BTC'}.",  developer_name="AgentVerse", developer_color="#58D68D"),
    dict(name="ArbitrageAgent",    category="trading",  endpoint=f"{AGENTS}/arbitrage/run",   price_per_request=0.006, description="Detects cross-exchange arbitrage spread using live price data. Pass {market: 'ETH'}.", developer_name="AgentVerse", developer_color="#58D68D"),
    dict(name="SentimentAgent",    category="trading",  endpoint=f"{AGENTS}/sentiment/run",   price_per_request=0.003, description="Real Fear & Greed index from alternative.me. Pass {market: 'BTC'}.",                   developer_name="AgentVerse", developer_color="#58D68D"),
    dict(name="VolatilityScanner", category="trading",  endpoint=f"{AGENTS}/volatility/run",  price_per_request=0.005, description="Computes volatility regime from live 24h high/low range. Pass {market: 'BTC'}.",       developer_name="AgentVerse", developer_color="#58D68D"),
    # Data
    dict(name="PriceFeedAgent",    category="data",     endpoint=f"{AGENTS}/price-feed/run",  price_per_request=0.001, description="Live price, 24h change, volume and range via CoinGecko. Pass {market: 'SOL'}.",        developer_name="AgentVerse", developer_color="#5DADE2"),
    dict(name="NewsFeedAgent",     category="data",     endpoint=f"{AGENTS}/news-feed/run",   price_per_request=0.002, description="Crypto headline with live price context and sentiment score. Pass {market: 'BTC'}.",    developer_name="AgentVerse", developer_color="#5DADE2"),
    dict(name="MarketDepthAgent",  category="data",     endpoint=f"{AGENTS}/market-depth/run",price_per_request=0.003, description="Liquidity score and spread derived from live volume. Pass {market: 'ETH'}.",            developer_name="AgentVerse", developer_color="#5DADE2"),
    # Analysis
    dict(name="TrendAnalyzer",     category="analysis", endpoint=f"{AGENTS}/trend/run",       price_per_request=0.004, description="Live trend direction (UPTREND/DOWNTREND/SIDEWAYS) from 24h change. Pass {market: 'BTC'}.", developer_name="AgentVerse", developer_color="#BB8FCE"),
    dict(name="PatternDetector",   category="analysis", endpoint=f"{AGENTS}/pattern/run",     price_per_request=0.005, description="Chart pattern detection anchored to live price levels. Pass {market: 'BTC'}.",          developer_name="AgentVerse", developer_color="#BB8FCE"),
    dict(name="CorrelationAgent",  category="analysis", endpoint=f"{AGENTS}/correlation/run", price_per_request=0.003, description="Cross-asset correlation and risk regime using live BTC data. Pass {market: 'BTC'}.",    developer_name="AgentVerse", developer_color="#BB8FCE"),
    # Risk
    dict(name="RiskAgent",         category="risk",     endpoint=f"{AGENTS}/risk/run",        price_per_request=0.005, description="Risk score, VaR and max drawdown from live price range. Pass {market: 'BTC'}.",        developer_name="AgentVerse", developer_color="#EC7063"),
    dict(name="PortfolioOptimizer",category="risk",     endpoint=f"{AGENTS}/portfolio/run",   price_per_request=0.008, description="Optimal allocation and Sharpe ratio using live market conditions. Pass {market: 'BTC'}.", developer_name="AgentVerse", developer_color="#EC7063"),
]

SEED_PIPELINES = [
    dict(name="MarketPulse",   description="PriceFeed → Sentiment → Momentum — live market snapshot",      agents=["PriceFeedAgent",  "SentimentAgent",   "MomentumAgent"]),
    dict(name="RiskCheck",     description="Volatility → Risk → Portfolio — full risk assessment",          agents=["VolatilityScanner","RiskAgent",        "PortfolioOptimizer"]),
    dict(name="TrendSignal",   description="Trend → Pattern → Correlation — multi-signal analysis chain",  agents=["TrendAnalyzer",   "PatternDetector",  "CorrelationAgent"]),
]

def main():
    client = httpx.Client(timeout=15)

    # 1. Clear existing agents
    print("Clearing existing agents…")
    existing = client.get(f"{API}/agents").json()
    for a in existing:
        client.delete(f"{API}/agents/{a['id']}")
        print(f"  deleted {a['name']}")

    # 2. Register 12 agents
    print("\nRegistering 12 agents…")
    agent_ids = {}
    for a in SEED_AGENTS:
        r = client.post(f"{API}/agents", json=a)
        if r.status_code in (200, 201):
            rec = r.json()
            agent_ids[a["name"]] = rec["id"]
            print(f"  ✓ {a['name']} ({rec['id'][:8]}…)")
        else:
            print(f"  ✗ {a['name']}: {r.status_code} {r.text[:80]}")

    # 3. Create 3 pipelines
    print("\nCreating pipelines…")
    for p in SEED_PIPELINES:
        ids = [agent_ids[n] for n in p["agents"] if n in agent_ids]
        if len(ids) < 2:
            print(f"  ✗ {p['name']}: missing agents")
            continue
        r = client.post(f"{API}/pipelines", json={"name": p["name"], "agent_ids": ids})
        if r.status_code in (200, 201):
            print(f"  ✓ {p['name']}")
        else:
            print(f"  ✗ {p['name']}: {r.status_code} {r.text[:80]}")

    print(f"\nDone. {len(agent_ids)}/12 agents, {len(SEED_PIPELINES)} pipelines.")
    client.close()

if __name__ == "__main__":
    main()
