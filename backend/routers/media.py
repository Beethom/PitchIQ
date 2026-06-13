import mimetypes
import os
import re
from pathlib import Path

import requests
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse

router = APIRouter(prefix="/media", tags=["media"])

CACHE_DIR = Path(__file__).resolve().parents[1] / "media_cache"
IMAGE_BASE_URL = "https://img.sofascore.com/api/v1"
FLAG_BASE_URL = "https://flagcdn.com/w80"
FETCH_REMOTE_ENTITY_IMAGES = os.getenv("FETCH_REMOTE_ENTITY_IMAGES", "0") == "1"
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")
RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST", "sportapi7.p.rapidapi.com")
FOOTBALL_API_BASE_URL = os.getenv("FOOTBALL_API_BASE_URL", "https://sportapi7.p.rapidapi.com")
IMAGE_TYPES = {
    "player": "player",
    "team": "team",
}
FLAG_CODE_RE = re.compile(r"^[a-z0-9-]{2,12}$")


def _cached_image(kind: str, source_id: int) -> Path:
    if kind not in IMAGE_TYPES or source_id <= 0:
        raise HTTPException(status_code=404, detail="Image not found")

    target_dir = CACHE_DIR / kind
    target_dir.mkdir(parents=True, exist_ok=True)
    missing_path = target_dir / f"{source_id}.missing"
    if missing_path.exists():
        if not FETCH_REMOTE_ENTITY_IMAGES:
            raise HTTPException(status_code=404, detail="Image not available")
        if missing_path.read_text(errors="ignore") in {"remote-fetch-disabled", "403"}:
            missing_path.unlink(missing_ok=True)
        else:
            raise HTTPException(status_code=404, detail="Image not available")

    for path in target_dir.glob(f"{source_id}.*"):
        if path.is_file() and path.suffix != ".missing" and path.stat().st_size > 0:
            return path

    if not FETCH_REMOTE_ENTITY_IMAGES:
        missing_path.write_text("remote-fetch-disabled")
        raise HTTPException(status_code=404, detail="Image not cached")

    response = None
    if RAPIDAPI_KEY:
        rapid_url = f"{FOOTBALL_API_BASE_URL.rstrip('/')}/api/v1/{IMAGE_TYPES[kind]}/{source_id}/image"
        response = requests.get(
            rapid_url,
            headers={
                "x-rapidapi-key": RAPIDAPI_KEY,
                "x-rapidapi-host": RAPIDAPI_HOST,
            },
            timeout=20,
        )

    if response is None or response.status_code != 200 or not response.content:
        url = f"{IMAGE_BASE_URL}/{IMAGE_TYPES[kind]}/{source_id}/image"
        response = requests.get(url, timeout=20)

    if response.status_code != 200 or not response.content:
        missing_path.write_text(str(response.status_code))
        raise HTTPException(status_code=404, detail="Image not found")

    content_type = response.headers.get("content-type", "").split(";")[0].strip()
    extension = mimetypes.guess_extension(content_type) or ".png"
    if extension == ".jpe":
        extension = ".jpg"

    path = target_dir / f"{source_id}{extension}"
    path.write_bytes(response.content)
    return path


def _serve(path: Path) -> FileResponse:
    return FileResponse(
        path,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )


def _not_found(detail: str) -> JSONResponse:
    return JSONResponse(
        {"detail": detail},
        status_code=404,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/player/{player_id}/image")
def player_image(player_id: int):
    try:
        return _serve(_cached_image("player", player_id))
    except HTTPException as exc:
        return _not_found(str(exc.detail))


@router.get("/team/{team_id}/image")
def team_image(team_id: int):
    try:
        return _serve(_cached_image("team", team_id))
    except HTTPException as exc:
        return _not_found(str(exc.detail))


@router.get("/flag/{code}.png")
def flag_image(code: str):
    normalized = code.lower()
    if not FLAG_CODE_RE.fullmatch(normalized):
        return _not_found("Flag not found")

    target_dir = CACHE_DIR / "flag"
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / f"{normalized}.png"
    if path.is_file() and path.stat().st_size > 0:
        return _serve(path)

    response = requests.get(f"{FLAG_BASE_URL}/{normalized}.png", timeout=20)
    if response.status_code != 200 or not response.content:
        return _not_found("Flag not found")

    path.write_bytes(response.content)
    return _serve(path)
