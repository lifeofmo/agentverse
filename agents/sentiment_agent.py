from fastapi import FastAPI
import random

app = FastAPI()

@app.get("/")
def home():
    return {"agent": "SentimentAgent running"}

@app.post("/analyze")
def analyze(data: dict):
    return {
        "market": data.get("market"),
        "bullish_score": round(random.uniform(0.2, 0.95), 2),
        "bearish_score": round(random.uniform(0.05, 0.6), 2),
        "source": "news+social",
    }
