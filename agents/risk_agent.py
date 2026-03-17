from fastapi import FastAPI
import random

app = FastAPI()

@app.get("/")
def home():
    return {"agent": "RiskAgent running"}

@app.post("/assess")
def assess_risk(data: dict):
    volatility = round(random.uniform(0.1, 0.9), 2)
    risk_level = "LOW" if volatility < 0.35 else "MEDIUM" if volatility < 0.65 else "HIGH"
    return {
        "market": data.get("market"),
        "volatility": volatility,
        "risk_level": risk_level,
        "liquidation_risk_pct": round(random.uniform(1, 30), 1),
    }
