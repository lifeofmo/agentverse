"""
AgentVerse Seed Agent Server
Hosts all built-in demo agents on a single FastAPI app (port 8001).
Run with: uvicorn server:app --port 8001 --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
import random, math

app = FastAPI(title="AgentVerse Seed Agents")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Helpers ────────────────────────────────────────────────────────────────────

PRICES = {"BTC": 62000, "ETH": 3200, "SOL": 145, "AVAX": 38, "BNB": 580}

def price(market):
    base = PRICES.get(market, 1000)
    return round(base * random.uniform(0.984, 1.016), 2)

def jitter(base, pct=0.12):
    return round(base * (1 + random.uniform(-pct, pct)), 4)

def pct_change():
    return round(random.uniform(-6.5, 6.5), 2)

# ── Trading Agents ─────────────────────────────────────────────────────────────

momentum = APIRouter(prefix="/momentum")

@momentum.get("/")
def momentum_home():
    return {"agent": "MomentumAgent", "status": "running"}

@momentum.post("/run")
def momentum_run(data: dict):
    market = data.get("market", "BTC")
    score  = round(random.uniform(-10, 10), 2)
    return {
        "market":         market,
        "signal":         "BUY" if score > 2 else "SELL" if score < -2 else "HOLD",
        "confidence":     round(abs(score) / 10 * 0.4 + 0.5, 2),
        "momentum_score": score,
        "price_usd":      price(market),
    }

app.include_router(momentum)

# ──

arbitrage = APIRouter(prefix="/arbitrage")

@arbitrage.get("/")
def arbitrage_home():
    return {"agent": "ArbitrageAgent", "status": "running"}

@arbitrage.post("/run")
def arbitrage_run(data: dict):
    market  = data.get("market", "BTC")
    p1      = price(market)
    spread  = round(random.uniform(0.01, 0.35), 3)
    p2      = round(p1 * (1 + spread / 100), 2)
    opp     = "HIGH" if spread > 0.2 else "MEDIUM" if spread > 0.1 else "LOW"
    return {
        "market":       market,
        "exchange_a":   p1,
        "exchange_b":   p2,
        "spread_pct":   spread,
        "opportunity":  opp,
        "net_profit_est": round(spread * 0.7, 3),
    }

app.include_router(arbitrage)

# ──

sentiment = APIRouter(prefix="/sentiment")

@sentiment.get("/")
def sentiment_home():
    return {"agent": "SentimentAgent", "status": "running"}

@sentiment.post("/run")
def sentiment_run(data: dict):
    market = data.get("market", "BTC")
    score  = random.randint(10, 95)
    label  = "Extreme Fear" if score < 25 else "Fear" if score < 45 else "Neutral" if score < 55 else "Greed" if score < 75 else "Extreme Greed"
    return {
        "market":          market,
        "sentiment":       label.upper().replace(" ", "_"),
        "score":           score,
        "fear_greed_label": label,
        "social_volume":   random.randint(1200, 48000),
    }

app.include_router(sentiment)

# ──

volatility = APIRouter(prefix="/volatility")

@volatility.get("/")
def volatility_home():
    return {"agent": "VolatilityScanner", "status": "running"}

@volatility.post("/run")
def volatility_run(data: dict):
    market = data.get("market", "BTC")
    vix    = round(random.uniform(14, 55), 1)
    regime = "LOW" if vix < 20 else "MEDIUM" if vix < 35 else "HIGH"
    return {
        "market":         market,
        "vix_equiv":      vix,
        "regime":         regime,
        "realized_vol":   round(vix * random.uniform(0.85, 1.15), 1),
        "recommendation": "HOLD" if regime == "LOW" else "HEDGE" if regime == "MEDIUM" else "REDUCE",
    }

app.include_router(volatility)

# ── Data Agents ────────────────────────────────────────────────────────────────

price_feed = APIRouter(prefix="/price-feed")

@price_feed.get("/")
def pricefeed_home():
    return {"agent": "PriceFeedAgent", "status": "running"}

@price_feed.post("/run")
def pricefeed_run(data: dict):
    market = data.get("market", "BTC")
    p      = price(market)
    return {
        "market":         market,
        "price_usd":      p,
        "change_24h_pct": pct_change(),
        "high_24h":       round(p * random.uniform(1.005, 1.04), 2),
        "low_24h":        round(p * random.uniform(0.96, 0.995), 2),
        "volume_24h_usd": f"{round(random.uniform(8, 42), 1)}B",
    }

app.include_router(price_feed)

# ──

news_feed = APIRouter(prefix="/news-feed")

HEADLINES = [
    ("breaks key resistance", 0.72),
    ("sees surge in institutional buying", 0.81),
    ("faces regulatory scrutiny", -0.45),
    ("network upgrade boosts scalability", 0.68),
    ("whale wallets accumulate", 0.61),
    ("derivatives open interest hits ATH", 0.55),
    ("on-chain metrics signal accumulation", 0.64),
    ("ETF inflows reach monthly high", 0.78),
    ("miners increase hash rate", 0.52),
    ("trading volume spikes on exchange listings", 0.44),
]

@news_feed.get("/")
def newsfeed_home():
    return {"agent": "NewsFeedAgent", "status": "running"}

@news_feed.post("/run")
def newsfeed_run(data: dict):
    market   = data.get("market", "BTC")
    head, score = random.choice(HEADLINES)
    score    = round(score + random.uniform(-0.1, 0.1), 2)
    return {
        "market":          market,
        "headline":        f"{market} {head}",
        "sentiment_score": score,
        "category":        random.choice(["technical", "on-chain", "macro", "regulatory", "institutional"]),
        "source_count":    random.randint(3, 28),
    }

app.include_router(news_feed)

# ──

market_depth = APIRouter(prefix="/market-depth")

@market_depth.get("/")
def depth_home():
    return {"agent": "MarketDepthAgent", "status": "running"}

@market_depth.post("/run")
def depth_run(data: dict):
    market = data.get("market", "BTC")
    spread = round(random.uniform(0.004, 0.08), 4)
    liq    = round(random.uniform(4, 9.8), 1)
    return {
        "market":          market,
        "bid_ask_spread":  spread,
        "liquidity_score": liq,
        "depth":           "HIGH" if liq > 7.5 else "MEDIUM" if liq > 5 else "LOW",
        "top_bid":         price(market),
        "slippage_est_pct": round(spread * 12, 3),
    }

app.include_router(market_depth)

# ── Analysis Agents ────────────────────────────────────────────────────────────

trend = APIRouter(prefix="/trend")

@trend.get("/")
def trend_home():
    return {"agent": "TrendAnalyzer", "status": "running"}

@trend.post("/run")
def trend_run(data: dict):
    market  = data.get("market", "BTC")
    r       = random.random()
    direction = "UPTREND" if r > 0.55 else "DOWNTREND" if r < 0.3 else "SIDEWAYS"
    strength  = random.choice(["WEAK", "MODERATE", "STRONG"])
    return {
        "market":     market,
        "trend":      direction,
        "strength":   strength,
        "ema_cross":  "bullish" if direction == "UPTREND" else "bearish" if direction == "DOWNTREND" else "neutral",
        "adx":        round(random.uniform(12, 55), 1),
        "timeframe":  random.choice(["1H", "4H", "1D"]),
    }

app.include_router(trend)

# ──

pattern = APIRouter(prefix="/pattern")

PATTERNS = ["BULL_FLAG", "BEAR_FLAG", "HEAD_SHOULDERS", "DOUBLE_TOP", "CUP_HANDLE",
            "ASCENDING_TRIANGLE", "WEDGE_BREAKOUT", "CONSOLIDATION"]

@pattern.get("/")
def pattern_home():
    return {"agent": "PatternDetector", "status": "running"}

@pattern.post("/run")
def pattern_run(data: dict):
    market = data.get("market", "BTC")
    pat    = random.choice(PATTERNS)
    conf   = round(random.uniform(0.52, 0.93), 2)
    return {
        "market":       market,
        "pattern":      pat,
        "confidence":   conf,
        "timeframe":    random.choice(["1H", "4H", "1D", "1W"]),
        "target_pct":   round(random.uniform(-8, 18), 1),
        "bullish":      pat in ("BULL_FLAG", "CUP_HANDLE", "ASCENDING_TRIANGLE", "WEDGE_BREAKOUT"),
    }

app.include_router(pattern)

# ──

correlation = APIRouter(prefix="/correlation")

@correlation.get("/")
def corr_home():
    return {"agent": "CorrelationAgent", "status": "running"}

@correlation.post("/run")
def corr_run(data: dict):
    market = data.get("market", "BTC")
    return {
        "market":    market,
        "corr_eth":  round(random.uniform(0.72, 0.96), 2),
        "corr_gold": round(random.uniform(-0.25, 0.35), 2),
        "corr_spx":  round(random.uniform(0.1, 0.65), 2),
        "regime":    random.choice(["RISK_ON", "RISK_OFF", "NEUTRAL"]),
        "beta":      round(random.uniform(0.8, 2.1), 2),
    }

app.include_router(correlation)

# ── Risk Agents ────────────────────────────────────────────────────────────────

risk = APIRouter(prefix="/risk")

@risk.get("/")
def risk_home():
    return {"agent": "RiskAgent", "status": "running"}

@risk.post("/run")
def risk_run(data: dict):
    market = data.get("market", "BTC")
    score  = round(random.uniform(2.5, 9.5), 1)
    dd     = round(random.uniform(5, 28), 1)
    return {
        "market":           market,
        "risk_score":       score,
        "max_drawdown_pct": dd,
        "var_95":           round(dd * 0.4, 1),
        "recommendation":   "ADD" if score < 4 else "HOLD" if score < 7 else "REDUCE_POSITION",
    }

app.include_router(risk)

# ──

portfolio = APIRouter(prefix="/portfolio")

@portfolio.get("/")
def portfolio_home():
    return {"agent": "PortfolioOptimizer", "status": "running"}

@portfolio.post("/run")
def portfolio_run(data: dict):
    market = data.get("market", "BTC")
    alloc  = round(random.uniform(5, 25), 1)
    sharpe = round(random.uniform(0.8, 2.8), 2)
    return {
        "market":                market,
        "optimal_allocation_pct": alloc,
        "sharpe_ratio":          sharpe,
        "sortino_ratio":         round(sharpe * random.uniform(1.1, 1.5), 2),
        "rebalance":             random.choice(["BUY", "HOLD", "TRIM"]),
        "kelly_fraction":        round(alloc / 100 * random.uniform(0.5, 0.9), 3),
    }

app.include_router(portfolio)

# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "AgentVerse Seed Agent Server",
        "port":    8001,
        "agents":  [
            "momentum", "arbitrage", "sentiment", "volatility",
            "price-feed", "news-feed", "market-depth",
            "trend", "pattern", "correlation",
            "risk", "portfolio",
        ],
    }
