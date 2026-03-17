from fastapi import FastAPI
import random

app = FastAPI()

MOCK_PRICES = {
    "BTC": 62000,
    "ETH": 3200,
    "SOL": 145,
}

@app.get("/")
def home():
    return {"agent": "PriceFeedAgent running"}

@app.post("/price")
def get_price(data: dict):
    market = data.get("market", "BTC")
    base = MOCK_PRICES.get(market, 1000)
    price = round(base * random.uniform(0.98, 1.02), 2)
    return {
        "market": market,
        "price_usd": price,
        "change_24h_pct": round(random.uniform(-5, 5), 2),
    }
