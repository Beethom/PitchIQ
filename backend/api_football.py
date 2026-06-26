import os
from typing import Any, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://v3.football.api-sports.io"
API_KEY = os.getenv("APISPORTS_KEY") or os.getenv("API_FOOTBALL_KEY") or ""


def _headers() -> dict[str, str]:
    if not API_KEY:
        raise ValueError("APISPORTS_KEY is not set in backend/.env")
    return {"x-apisports-key": API_KEY}


def _get(path: str, params: Optional[dict[str, Any]] = None) -> dict:
    url = f"{BASE_URL}{path}"
    response = requests.get(url, headers=_headers(), params=params or {}, timeout=20)
    response.raise_for_status()
    return response.json()


def status() -> dict:
    return _get("/status")


def live_fixtures() -> dict:
    return _get("/fixtures", {"live": "all"})


def fixture_players(fixture_id: int) -> dict:
    return _get("/fixtures/players", {"fixture": fixture_id})


def fixture_detail(fixture_id: int) -> dict:
    return _get("/fixtures", {"id": fixture_id})
