"""AgentVerse HTTP client."""

import httpx
from typing import Optional


class AgentVerseClient:
    """Synchronous client for the AgentVerse API."""

    def __init__(self, host: str = "http://127.0.0.1:8000"):
        self.host = host.rstrip("/")

    def register(
        self,
        name: str,
        endpoint: str,
        price: float,
        category: str = "default",
        description: str = "",
        wallet: Optional[str] = None,
        health_endpoint: Optional[str] = None,
    ) -> dict:
        payload = {
            "name": name,
            "endpoint": endpoint,
            "price_per_request": price,
            "category": category,
            "description": description,
        }
        if wallet:
            payload["owner_wallet"] = wallet
        if health_endpoint:
            payload["health_endpoint"] = health_endpoint

        r = httpx.post(f"{self.host}/agents/register", json=payload, timeout=15)
        r.raise_for_status()
        return r.json()

    def list_agents(self) -> list:
        r = httpx.get(f"{self.host}/agents", timeout=10)
        r.raise_for_status()
        return r.json()

    def call(self, agent_id: str, payload: dict, wallet: str = "demo") -> dict:
        r = httpx.post(
            f"{self.host}/call-agent/{agent_id}",
            json={**payload, "wallet_id": wallet},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()

    def wallet(self, wallet_id: str = "demo") -> dict:
        r = httpx.get(f"{self.host}/wallets/{wallet_id}", timeout=10)
        r.raise_for_status()
        return r.json()

    def deposit(self, wallet_id: str, amount: float) -> dict:
        r = httpx.post(
            f"{self.host}/wallets/{wallet_id}/deposit",
            json={"amount": amount},
            timeout=10,
        )
        r.raise_for_status()
        return r.json()

    def metrics(self, agent_id: str) -> dict:
        r = httpx.get(f"{self.host}/metrics/{agent_id}", timeout=10)
        r.raise_for_status()
        return r.json()
