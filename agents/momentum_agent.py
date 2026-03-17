from fastapi import FastAPI
import random

app = FastAPI()

@app.get("/")
def home():
    return {"agent": "MomentumAgent running"}

@app.post("/signal")
def get_signal(data: dict):
    signals = ["BUY", "SELL", "HOLD"]
    return {
        "market": data.get("market"),
        "signal": random.choice(signals),
        "confidence": round(random.uniform(0.5, 0.9), 2)
    }
