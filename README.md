# AgentVerse

**A marketplace and runtime for AI agents — built for developers who want to publish, monetize, and chain together AI capabilities.**

---

## What It Is

AgentVerse is infrastructure for the agent economy. Developers deploy AI agents that do real work (trading signals, sentiment analysis, risk modeling, data feeds), publish them to a shared marketplace, and earn automatically per call — in credits or real USDC via the x402 payment protocol.

Users chain agents together in a visual Pipeline Builder and run multi-step workflows in a single call. Every deployed agent appears as a building in a live 3D city that updates in real time as agents are called.

---

## Running Locally (5 minutes)

### 1. Clone and configure

```bash
git clone https://github.com/yourname/agentverse.git
cd agentverse
cp .env.example .env
```

The defaults in `.env.example` work for local dev with no changes. Open `.env` only if you want to:
- Enable real USDC payments (`X402_ENABLED=true`)
- Change the JWT secret (required before any public deployment)

### 2. Start with Docker (recommended)

```bash
docker-compose up
```

This starts:
- `backend` — FastAPI on port 8000
- `agents` — 12 demo agents on port 8001 (auto-seeded into the registry)
- `frontend` — Next.js on port 3000
- `postgres` — PostgreSQL (for the async worker queue)
- `redis` — Redis task queue
- `worker` — arq pipeline worker

Open **http://localhost:3000**

### 3. Or run locally without Docker

```bash
# Backend (Python 3.12+)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --port 8000 --reload

# Demo agents (separate terminal)
pip install fastapi uvicorn
uvicorn agents.server:app --port 8001 --reload

# Frontend (Node 18+)
cd frontend
npm install
npm run dev
```

---

## What You Get on First Run

On startup the backend auto-seeds **12 demo agents** and **4 pipelines** if the database is empty:

| Agent | Category | What it does |
|---|---|---|
| MomentumAgent | trading | BUY/SELL/HOLD with confidence score |
| ArbitrageAgent | trading | Cross-exchange spread detection |
| SentimentAgent | trading | Fear & Greed score (0–100) |
| VolatilityScanner | trading | Regime classification + hedging advice |
| PriceFeedAgent | data | Live prices for BTC, ETH, SOL, AVAX, BNB |
| NewsFeedAgent | data | Headline sentiment scoring |
| MarketDepthAgent | data | Order book depth + liquidity score |
| TrendAnalyzer | analysis | EMA crossover + ADX trend strength |
| PatternDetector | analysis | Chart pattern recognition |
| CorrelationAgent | analysis | Cross-asset correlation + regime |
| RiskAgent | risk | VaR + drawdown + position sizing |
| PortfolioOptimizer | risk | Mean-variance optimization + Sharpe |

**Pre-built pipelines:**
- `MarketPulse` — PriceFeed → Sentiment → Momentum
- `RiskCheck` — PriceFeed → Volatility → Risk
- `TrendAnalysis` — PriceFeed → Trend → Pattern → Momentum
- `AlphaSignal` — NewsFeed → Sentiment → Correlation → Momentum

The demo wallet starts with **$100 (10,000 credits)**. All calls are free to test.

---

## Registering Your Own Agent

Your agent can be any HTTP server that accepts a POST with JSON and returns JSON.

```
POST /your-endpoint
{ "market": "BTC", "timeframe": "1h" }

→ { "signal": "BUY", "confidence": 0.82 }
```

Register it via the Developer tab in the UI, or directly:

```bash
curl -X POST http://localhost:8000/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MyAgent",
    "description": "Does one thing well",
    "endpoint": "https://your-server.com/run",
    "category": "trading",
    "price_per_request": 0.005
  }'
```

The agent appears in the marketplace, the 3D city, and the Pipeline Builder sidebar immediately.

---

## Pipeline Builder

Go to **http://localhost:3000/build** (or click `+ Pipeline Builder` in the nav).

1. Drag agents from the left panel onto the canvas
2. Connect them in execution order by drawing edges
3. Click **Save** — the pipeline is stored and gets an ID
4. Click **Run** — executes with `{ "market": "BTC" }` as input; output flows step-to-step
5. Optionally click **Register as Agent** — the pipeline becomes a callable agent endpoint itself

The builder polls `/jobs/{id}` for async execution (when Redis is running) and falls back to sync execution without Redis.

---

## API

The backend auto-generates docs at **http://localhost:8000/docs**

Key endpoints:

| Method | Path | Description |
|---|---|---|
| GET | `/agents` | List all registered agents |
| POST | `/agents` | Register a new agent |
| POST | `/call-agent/{id}` | Call an agent (handles billing + x402) |
| POST | `/pipelines` | Create a pipeline |
| POST | `/run-pipeline/{id}` | Execute a pipeline |
| GET | `/jobs/{id}` | Poll async job status |
| GET | `/metrics/{id}` | Agent request/latency/earnings stats |
| POST | `/auth/register` | Create developer account |
| POST | `/auth/login` | Get auth token |
| GET | `/health` | Platform health + x402 status |

---

## Payments

**Credits (default):** 1 credit = $0.01. The demo wallet starts with $100 = 10,000 credits. All calls deduct from the caller's wallet. Developers accumulate earnings (90% of each call; 10% platform fee).

**USDC via x402 (opt-in):** When an agent is registered with a Base wallet address, callers pay in real USDC per call. The payment happens at the protocol level — the caller's wallet signs an EIP-3009 authorization, the backend verifies it with the Coinbase facilitator, and USDC moves directly to the agent developer's wallet. No escrow.

To enable on testnet (zero financial risk):
```bash
# In .env:
X402_ENABLED=true
X402_NETWORK=base-sepolia
```

Get free test USDC at https://faucet.circle.com (select Base Sepolia).

---

## Deploying to Production

### Option A — VPS with Docker (simplest)

```bash
# On a fresh Ubuntu VPS (DigitalOcean $6/mo droplet works)
git clone https://github.com/yourname/agentverse.git
cd agentverse
cp .env.example .env

# Edit .env — set these three before going live:
# JWT_SECRET=<random 64-char string>
# PUBLIC_API_URL=https://api.yourdomain.com
# PUBLIC_WS_URL=wss://api.yourdomain.com/ws
# CORS_ORIGINS=https://yourdomain.com

# Install Docker
curl -fsSL https://get.docker.com | sh

# Start everything
docker-compose up -d

# Set up Nginx + Let's Encrypt for HTTPS (required for wallet connections)
apt install -y nginx certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

Nginx config for the API (save to `/etc/nginx/sites-available/agentverse`):

```nginx
server {
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

### Option B — Vercel (frontend) + Railway (backend)

**Frontend on Vercel:**
```bash
cd frontend
npx vercel deploy
# Set env vars in Vercel dashboard:
# NEXT_PUBLIC_API_URL=https://your-railway-backend.railway.app
# NEXT_PUBLIC_WS_URL=wss://your-railway-backend.railway.app/ws
```

**Backend on Railway:**
- Create new project → Deploy from GitHub
- Select the repo root, Dockerfile: `Dockerfile.backend`
- Add environment variables from `.env.example`
- Railway provisions Postgres and Redis automatically via plugins

---

## Pre-Launch Checklist

- [ ] `JWT_SECRET` changed from the default (generate with `openssl rand -hex 32`)
- [ ] `CORS_ORIGINS` set to your actual domain (not `*`)
- [ ] `PUBLIC_API_URL` and `PUBLIC_WS_URL` point to your real domain
- [ ] HTTPS is live (required for MetaMask/wallet connections)
- [ ] Tested `/health` endpoint returns `{"status": "healthy"}`
- [ ] Tested registration, login, and agent registration flow end-to-end
- [ ] Tested running the MarketPulse pipeline from the Pipeline Builder

---

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌───────────────┐
│  Next.js    │─────▶│  FastAPI backend  │─────▶│  SQLite (dev) │
│  frontend   │      │  main.py          │      │  PostgreSQL   │
│  :3000      │      │  :8000            │      │  (prod)       │
└─────────────┘      └──────────────────┘      └───────────────┘
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
             ┌──────────┐      ┌─────────────────┐
             │  Redis   │      │  arq worker     │
             │  queue   │      │  pipeline exec  │
             └──────────┘      └─────────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  agents/server.py  │
                              │  12 demo agents    │
                              │  :8001             │
                              └───────────────────┘
```

The backend is a single-file FastAPI app (`backend/main.py`). It uses SQLite locally (the database file lives in `database/agents.db`) and can be pointed at PostgreSQL via `DATABASE_URL` for production.

Pipelines execute synchronously when Redis isn't available, or get queued via arq when Redis is running. Either path works — the frontend polls `/jobs/{id}` until completion.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `agentverse-dev-secret-CHANGE-IN-PROD` | **Change before any public deployment** |
| `DB_PATH` | `../database/agents.db` | SQLite file path |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `PUBLIC_API_URL` | `http://localhost:8000` | Backend URL (browser-visible) |
| `PUBLIC_WS_URL` | `ws://localhost:8000/ws` | WebSocket URL (browser-visible) |
| `AGENT_SERVER_URL` | `http://127.0.0.1:8001` | URL of the demo agents service |
| `API_BASE_URL` | `http://backend:8000` | Backend self-reference (for x402 resource URLs) |
| `X402_ENABLED` | `false` | Enable real USDC payments |
| `X402_NETWORK` | `base-sepolia` | `base-sepolia` (testnet) or `base-mainnet` |
| `X402_FACILITATOR` | `https://x402.org/facilitator` | x402 payment verifier endpoint |

Copy `.env.example` to `.env` and edit before running.
