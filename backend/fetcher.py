"""
PitchVision sync engine — SportApi7 (SofaScore) via RapidAPI.

Full sync:
  1. Paginate /unique-tournament/{tid}/season/{sid}/statistics
  2. Upsert teams + player competition rows directly from the bulk response
  No per-player fan-out calls during bootstrap.

Incremental sync:
  1. Fetch recently completed fixtures per competition
  2. Fetch fixture lineups once
  3. Record match rows and refresh form for affected players
  Touches only competitions and fixtures we ask for.
"""
import logging
import os
import sys
import time
from datetime import date, datetime, timezone
from typing import Optional

import requests
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from database import SessionLocal, ensure_schema
import models

load_dotenv()

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

API_KEY = os.getenv("RAPIDAPI_KEY", "")
API_HOST = os.getenv("RAPIDAPI_HOST", "sportapi7.p.rapidapi.com")
API_BASE_URL = os.getenv("FOOTBALL_API_BASE_URL", "https://sportapi7.p.rapidapi.com")
SEASON_LABEL = os.getenv("SEASON_LABEL", "25/26")
REQUEST_SLEEP_MS = int(os.getenv("REQUEST_SLEEP_MS", "200"))
FULL_SYNC_PAGE_LIMIT = int(os.getenv("FULL_SYNC_PAGE_LIMIT", "0"))
FULL_SYNC_PAGE_SIZE = int(os.getenv("FULL_SYNC_PAGE_SIZE", "100"))
FULL_SYNC_EVENT_PAGE_LIMIT = int(os.getenv("FULL_SYNC_EVENT_PAGE_LIMIT", "20"))
INCREMENTAL_LOOKBACK_PAGES = int(os.getenv("INCREMENTAL_LOOKBACK_PAGES", "2"))

LEAGUES = [
    # Top 5 European leagues
    {"name": "Premier League", "tournament_id": 17, "season_id": 76986, "season_label": "25/26", "season_mode": "cross_year"},
    {"name": "La Liga", "tournament_id": 8, "season_id": 77559, "season_label": "25/26", "season_mode": "cross_year"},
    {"name": "Bundesliga", "tournament_id": 35, "season_id": 77333, "season_label": "25/26", "season_mode": "cross_year"},
    {"name": "Serie A", "tournament_id": 23, "season_id": 76457, "season_label": "25/26", "season_mode": "cross_year"},
    {"name": "Ligue 1", "tournament_id": 34, "season_id": 77356, "season_label": "25/26", "season_mode": "cross_year"},

    # Domestic cups for top 5 leagues
    {"name": "FA Cup", "tournament_id": 19, "season_id": 82557, "season_label": "25/26", "season_mode": "cross_year"},
    {"name": "EFL Cup", "tournament_id": 21, "season_id": 77500, "season_label": "25/26", "season_mode": "cross_year"},
    {"name": "DFB Pokal", "tournament_id": 217, "season_id": 76910, "season_label": "25/26", "season_mode": "cross_year"},
    {"name": "Copa del Rey", "tournament_id": 329, "season_id": 82988, "season_label": "25/26", "season_mode": "cross_year"},
    {"name": "Coppa Italia", "tournament_id": 328, "season_id": 77308, "season_label": "25/26", "season_mode": "cross_year"},
    {"name": "Coupe de France", "tournament_id": 335, "season_id": 85565, "season_label": "25/26", "season_mode": "cross_year"},

    # UEFA club competitions
    {"name": "UEFA Champions League", "tournament_id": 7, "season_id": 76953, "season_label": "25/26", "season_mode": "cross_year"},
    {"name": "UEFA Europa League", "tournament_id": 679, "season_id": 76984, "season_label": "25/26", "season_mode": "cross_year"},
    {"name": "UEFA Conference League", "tournament_id": 17015, "season_id": 76960, "season_label": "25/26", "season_mode": "cross_year"},

    # North America
    {"name": "MLS", "tournament_id": 242, "season_id": 70158, "season_label": "2025", "season_mode": "calendar_year"},

    # National team competitions
    {"name": "UEFA Nations League", "tournament_id": 10783, "season_id": 58337, "season_label": "24/25", "season_mode": "latest"},
    {"name": "CONCACAF Nations League", "tournament_id": 14100, "season_id": 61662, "season_label": "24/25", "season_mode": "latest"},
    {"name": "CONCACAF Gold Cup", "tournament_id": 140, "season_id": 72840, "season_label": "2025", "season_mode": "latest"},
    {"name": "Copa América", "tournament_id": 133, "season_id": 57114, "season_label": "2024", "season_mode": "latest"},
    {"name": "FIFA World Cup", "tournament_id": 16, "season_id": 58210, "season_label": "2026", "season_mode": "calendar_year"},
    {"name": "World Cup Qual. CONMEBOL", "tournament_id": 295, "season_id": 53820, "season_label": "2026", "season_mode": "calendar_year"},
    {"name": "World Cup Qual. UEFA", "tournament_id": 11, "season_id": 69427, "season_label": "2026", "season_mode": "calendar_year"},
    {"name": "World Cup Qual. CONCACAF", "tournament_id": 14, "season_id": 58146, "season_label": "2026", "season_mode": "calendar_year"},

    # International friendlies
    {"name": "International Friendlies", "tournament_id": 851, "season_id": 87155, "season_label": "2026", "season_mode": "calendar_year"},
]

STAT_FIELDS = (
    "appearances",
    "matchesStarted",
    "minutesPlayed",
    "goals",
    "assists",
    "totalShots",
    "shotsOnTarget",
    "accuratePasses",
    "totalPasses",
    "keyPasses",
    "touches",
    "accurateCrosses",
    "totalCross",
    "accurateCrossesPercentage",
    "accurateFinalThirdPasses",
    "accurateThroughPasses",
    "totalThroughPasses",
    "throughPasses",
    "bigChanceCreated",
    "bigChancesCreated",
    "bigChanceMissed",
    "bigChancesMissed",
    "missedChances",
    "successfulDribbles",
    "successfulDribblesPercentage",
    "possessionLost",
    "dispossessed",
    "unsuccessfulTouches",
    "unsuccessfulTouch",
    "tackles",
    "totalTackle",
    "wonTackle",
    "ballRecovery",
    "recoveries",
    "fouls",
    "interceptions",
    "interceptionWon",
    "aerialDuelsWon",
    "yellowCards",
    "redCards",
    "expectedGoals",
    "expectedAssists",
    "rating",
    # Attacking / chance creation
    "bigChanceCreated",
    "bigChanceMissed",
    "missedChances",
    # Defensive / outfield
    "clearances",
    # Goalkeeper
    "savedShotsFromInsideTheBox",
    "savedShotsFromOutsideTheBox",
    "goalsConceded",
    "cleanSheets",
    "punches",
    "runningOut",
    "highClaims",
)
STAT_FIELDS_PARAM = ",".join(STAT_FIELDS)
POSITION_MAP = {
    "G": "GK",
    "GK": "GK",
    "D": "CB",
    "DC": "CB",
    "CB": "CB",
    "DL": "LB",
    "LB": "LB",
    "DR": "RB",
    "RB": "RB",
    "M": "CM",
    "MC": "CM",
    "CM": "CM",
    "DM": "CDM",
    "DMC": "CDM",
    "CDM": "CDM",
    "AM": "CAM",
    "AMC": "CAM",
    "CAM": "CAM",
    "F": "ST",
    "FW": "ST",
    "ST": "ST",
    "CF": "ST",
    "LW": "LW",
    "RW": "RW",
    "ML": "LW",
    "MR": "RW",
}
COMPLETED_STATUS_TYPES = {"finished"}
_SEASONS_CACHE: dict[int, list[dict]] = {}
_TEAM_ROSTER_CACHE: dict[int, dict[int, dict]] = {}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _current_cross_year_label() -> str:
    today = date.today()
    if today.month >= 7:
        return f"{str(today.year)[-2:]}/{str(today.year + 1)[-2:]}"
    return f"{str(today.year - 1)[-2:]}/{str(today.year)[-2:]}"


def _target_season_label(mode: str) -> Optional[str]:
    if mode == "cross_year":
        return _current_cross_year_label()
    if mode == "calendar_year":
        return str(date.today().year)
    return None


def _headers() -> dict:
    if not API_KEY:
        raise ValueError("RAPIDAPI_KEY not set in backend/.env")
    return {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": API_HOST,
        "Content-Type": "application/json",
    }


def _get(path: str, params: Optional[dict] = None, retry: int = 0) -> dict:
    url = f"{API_BASE_URL.rstrip('/')}/{path.lstrip('/')}"
    resp = requests.get(url, params=params, headers=_headers(), timeout=30)

    if resp.status_code == 429:
        if retry >= 5:
            raise RuntimeError(f"Rate limit persisted after {retry} retries.")
        wait = 20 * (retry + 1)
        log.warning("Rate limited — waiting %ss", wait)
        time.sleep(wait)
        return _get(path, params=params, retry=retry + 1)

    if resp.status_code not in (200, 201):
        snippet = resp.text[:180]
        raise RuntimeError(f"HTTP {resp.status_code}: {path} — {snippet}")

    if REQUEST_SLEEP_MS > 0:
        time.sleep(REQUEST_SLEEP_MS / 1000)

    return resp.json()


def _fetch_match_possession(fixture_id: int) -> tuple[int, int]:
    """Return (home_possession_pct, away_possession_pct) for a fixture, or (0, 0) on failure."""
    try:
        data = _get(f"/api/v1/event/{fixture_id}/statistics")
        for group in data.get("statistics", []):
            if group.get("period") != "ALL":
                continue
            for g in group.get("groups", []):
                for s in g.get("statisticsItems", []):
                    if s.get("key") == "ballPossession":
                        return _safe_int(s.get("homeValue")), _safe_int(s.get("awayValue"))
    except Exception:
        pass
    return 0, 0


def _fetch_seasons_for_tournament(tournament_id: int) -> list[dict]:
    if tournament_id in _SEASONS_CACHE:
        return _SEASONS_CACHE[tournament_id]
    data = _get(f"/api/v1/unique-tournament/{tournament_id}/seasons")
    seasons = data.get("seasons", [])
    _SEASONS_CACHE[tournament_id] = seasons
    return seasons


def _resolve_league_season(league: dict) -> dict:
    mode = league.get("season_mode", "latest")
    target = _target_season_label(mode)

    try:
        seasons = _fetch_seasons_for_tournament(league["tournament_id"])
        picked = None
        if target:
            for season in seasons:
                year = str(season.get("year", ""))
                name = str(season.get("name", ""))
                if year == target or target in year or target in name:
                    picked = season
                    break
        if not picked and seasons:
            picked = seasons[0]

        if picked:
            resolved = dict(league)
            resolved["season_id"] = picked.get("id", league["season_id"])
            resolved["season_label"] = str(picked.get("year") or league.get("season_label", SEASON_LABEL))
            return resolved
    except Exception as exc:
        log.warning("Could not resolve live season for %s: %s", league['name'], exc)

    return league


def _resolved_leagues() -> list[dict]:
    return [_resolve_league_season(league) for league in LEAGUES]


def _normalize_competition_names(competitions: Optional[list[str]]) -> Optional[set[str]]:
    if not competitions:
        return None
    normalized = {
        str(name).strip().casefold()
        for name in competitions
        if str(name).strip()
    }
    return normalized or None


def _filter_leagues(competitions: Optional[list[str]] = None) -> list[dict]:
    selected = _normalize_competition_names(competitions)
    source = LEAGUES
    if selected:
        source = [league for league in LEAGUES if league["name"].casefold() in selected]
    return [_resolve_league_season(league) for league in source]


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(float(value)) if value not in ("", None) else default
    except (TypeError, ValueError):
        return default


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value in ("", None):
            return default
        if isinstance(value, str):
            value = value.replace("%", "").strip()
        return float(value)
    except (TypeError, ValueError):
        return default


def _round1(v: float) -> float:
    return round(float(v or 0.0), 1)


def _round2(v: float) -> float:
    return round(float(v or 0.0), 2)


def _score_value(score: Optional[dict]) -> Optional[int]:
    if not score:
        return None
    for key in ("current", "display", "normaltime"):
        if score.get(key) is not None:
            return _safe_int(score.get(key))
    return None


def _age_from_dob(dob_str: Optional[str]) -> int:
    if not dob_str:
        return 0
    try:
        dob = datetime.fromisoformat(dob_str.replace("Z", "+00:00"))
        today = datetime.now(timezone.utc)
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except Exception:
        return 0


def _flag_code(country: Optional[dict]) -> Optional[str]:
    if not country:
        return None
    alpha2 = (country.get("alpha2") or "").lower()
    slug = (country.get("slug") or "").lower()
    special = {"england": "gb-eng", "scotland": "gb-sct", "wales": "gb-wls", "northern-ireland": "gb-nir"}
    return special.get(slug) or (alpha2 if alpha2 else None)


def _position(raw: Optional[str], detailed: Optional[list[str]] = None) -> str:
    for value in detailed or []:
        mapped = POSITION_MAP.get(str(value or "").upper())
        if mapped:
            return mapped
    return POSITION_MAP.get(str(raw or "").upper(), "CM")


def _fetch_team_roster(team_id: int) -> dict[int, dict]:
    if not team_id:
        return {}
    if team_id in _TEAM_ROSTER_CACHE:
        return _TEAM_ROSTER_CACHE[team_id]

    try:
        data = _get(f"/api/v1/team/{team_id}/players")
        roster = {}
        for entry in data.get("players", []):
            player = entry.get("player") or {}
            player_id = _safe_int(player.get("id"))
            if player_id:
                roster[player_id] = player
        _TEAM_ROSTER_CACHE[team_id] = roster
        return roster
    except Exception as exc:
        log.warning("Could not fetch roster for team %s: %s", team_id, exc)
        _TEAM_ROSTER_CACHE[team_id] = {}
        return {}


def _merge_roster_player_info(player_info: dict, team_info: dict) -> dict:
    player_id = _safe_int(player_info.get("id"))
    team_id = _safe_int(team_info.get("id"))
    roster_info = _fetch_team_roster(team_id).get(player_id, {})
    if not roster_info:
        return player_info
    merged = dict(player_info)
    for key in ("position", "positionsDetailed", "dateOfBirth", "country", "firstName", "lastName", "shortName"):
        if roster_info.get(key) not in (None, "", []):
            merged[key] = roster_info[key]
    return merged


def _photo_url(player_id: int) -> str:
    return f"/api/media/player/{player_id}/image"


def _team_logo_url(team_id: int) -> str:
    return f"/api/media/team/{team_id}/image"


def _stats_from_block(s: dict) -> dict:
    shots_on = _safe_int(s.get("shotsOnTarget"))
    total_shots = _safe_int(s.get("totalShots"))
    key_passes = _safe_int(s.get("keyPasses"))
    accurate_passes = _safe_int(s.get("accuratePasses"))
    total_passes = _safe_int(s.get("totalPasses"))
    accurate_crosses = _safe_int(s.get("accurateCrosses"))
    total_crosses = _safe_int(s.get("totalCross") or s.get("totalCrosses") or s.get("crosses"))
    dribbles = _safe_int(s.get("successfulDribbles"))

    xg = _round2(s.get("expectedGoals") or 0.0)
    xa = _round2(s.get("expectedAssists") or 0.0)

    dribble_pct = _round1(s.get("successfulDribblesPercentage") or 0.0)
    dribble_attempts = _safe_int(
        s.get("totalDribbles")
        or s.get("dribblesAttempted")
        or s.get("attemptedDribbles")
        or s.get("totalDribbleAttempts")
        or 0
    )
    if not dribble_attempts and dribbles and dribble_pct:
        dribble_attempts = round(dribbles / (dribble_pct / 100))
    dribble_attempts = max(dribble_attempts, dribbles)
    pass_acc = _round1(s.get("accuratePassesPercentage") or (
        (accurate_passes / total_passes * 100) if total_passes else 0.0
    ))
    cross_acc = _round1(s.get("accurateCrossesPercentage") or (
        (accurate_crosses / total_crosses * 100) if total_crosses else 0.0
    ))

    total_tackles = _safe_int(s.get("tackles") or s.get("totalTackle"))
    successful_tackles = _safe_int(s.get("successfulTackles") or s.get("wonTackle"))

    return {
        "appearances":    _safe_int(s.get("appearances") or s.get("matchesStarted")),
        "starts":         _safe_int(s.get("matchesStarted") or s.get("lineups") or s.get("starts")),
        "minutesPlayed":  _safe_int(s.get("minutesPlayed")),
        "goals":          _safe_int(s.get("goals")),
        "assists":        _safe_int(s.get("assists")),
        "shots":          total_shots,
        "shotsOnTarget":  shots_on,
        "passAccuracy":   pass_acc,
        "keyPasses":      key_passes,
        "totalPasses":    total_passes,
        "touches":        _safe_int(s.get("touches") or s.get("totalTouches")),
        "accurateCrosses": accurate_crosses,
        "crosses":        total_crosses,
        "crossAccuracy":  cross_acc,
        "finalThirdPasses": _safe_int(s.get("accurateFinalThirdPasses")),
        "throughPasses":  _safe_int(
            s.get("throughPasses")
            or s.get("accurateThroughPasses")
            or s.get("totalThroughPasses")
        ),
        "dribbles":       dribbles,
        "dribbleSuccess": dribble_pct,
        "possessionLost": _safe_int(s.get("possessionLost")),
        "dispossessed": _safe_int(s.get("dispossessed")),
        "miscontrols": _safe_int(s.get("unsuccessfulTouches") or s.get("unsuccessfulTouch")),
        "recoveries":     _safe_int(s.get("recoveries") or s.get("ballRecovery")),
        "tackles":        total_tackles,
        "successfulTackles": successful_tackles,
        "fouls":          _safe_int(s.get("fouls") or s.get("foulsCommitted")),
        "interceptions":  _safe_int(s.get("interceptions") or s.get("interceptionWon")),
        "aerialDuelsWon": _safe_int(s.get("aerialDuelsWon")),
        "yellowCards":    _safe_int(s.get("yellowCards")),
        "redCards":       _safe_int(s.get("redCards")),
        "xG":             xg,
        "xA":             xa,
        "_accuratePasses": accurate_passes,
        "_totalDribbles":  dribble_attempts,
        "rating":         _round1(_safe_float(s.get("rating"))),
        # Attacking / chance creation
        "bigChancesCreated": _safe_int(s.get("bigChanceCreated") or s.get("bigChancesCreated")),
        "bigChancesMissed":  _safe_int(s.get("bigChanceMissed") or s.get("bigChancesMissed")),
        "missedChances":     _safe_int(s.get("missedChances")),
        # Defensive / outfield
        "clearances":        _safe_int(s.get("clearances")),
        # Goalkeeper
        "saves":           _safe_int(s.get("savedShotsFromInsideTheBox", 0)) + _safe_int(s.get("savedShotsFromOutsideTheBox", 0)),
        "goalsConceded":   _safe_int(s.get("goalsConceded")),
        "cleanSheets":     _safe_int(s.get("cleanSheets")),
        "totalShotsFaced": _safe_int(s.get("savedShotsFromInsideTheBox", 0)) + _safe_int(s.get("savedShotsFromOutsideTheBox", 0)) + _safe_int(s.get("goalsConceded", 0)),
        "punches":         _safe_int(s.get("punches")),
        "runOuts":         _safe_int(s.get("runningOut") or s.get("runOuts")),
        "highClaims":      _safe_int(s.get("highClaims")),
    }


def _base_stats() -> dict:
    return {
        "appearances": 0, "starts": 0, "minutesPlayed": 0, "goals": 0, "assists": 0,
        "shots": 0, "shotsOnTarget": 0, "passAccuracy": 0.0, "keyPasses": 0,
        "totalPasses": 0, "touches": 0, "accurateCrosses": 0, "crosses": 0,
        "crossAccuracy": 0.0, "finalThirdPasses": 0, "throughPasses": 0,
        "dribbles": 0, "dribbleSuccess": 0.0, "recoveries": 0, "tackles": 0,
        "successfulTackles": 0, "fouls": 0, "interceptions": 0,
        "aerialDuelsWon": 0, "yellowCards": 0, "redCards": 0,
        "possessionLost": 0, "dispossessed": 0, "miscontrols": 0,
        "xG": 0.0, "xA": 0.0, "_accuratePasses": 0, "_totalDribbles": 0, "rating": 0.0,
        "bigChancesCreated": 0, "bigChancesMissed": 0, "missedChances": 0, "clearances": 0,
        "saves": 0, "goalsConceded": 0, "cleanSheets": 0, "totalShotsFaced": 0, "punches": 0, "runOuts": 0, "highClaims": 0,
    }


def _lineup_stats_from_block(
    stats_block: dict,
    substitute: bool = False,
    position: Optional[str] = None,
    goals_conceded: Optional[int] = None,
) -> dict:
    accurate_passes = _safe_int(stats_block.get("accuratePasses") or stats_block.get("accuratePass"))
    total_passes = _safe_int(stats_block.get("totalPasses") or stats_block.get("totalPass"))
    accurate_crosses = _safe_int(stats_block.get("accurateCrosses") or stats_block.get("accurateCross"))
    total_crosses = _safe_int(stats_block.get("totalCross") or stats_block.get("totalCrosses") or stats_block.get("crosses"))
    dribbles = _safe_int(stats_block.get("successfulDribbles") or stats_block.get("wonContest"))
    dribble_attempts = _safe_int(
        stats_block.get("totalDribbles")
        or stats_block.get("totalContest")
        or stats_block.get("dribblesAttempted")
        or stats_block.get("attemptedDribbles")
    )
    dribble_pct = _round1(
        stats_block.get("successfulDribblesPercentage")
        or ((dribbles / dribble_attempts * 100) if dribble_attempts else 0.0)
    )

    stats = {
        "appearances": 1,
        "starts": 0 if substitute else 1,
        "minutesPlayed": _safe_int(stats_block.get("minutesPlayed") or stats_block.get("minutes")),
        "goals": _safe_int(stats_block.get("goals")),
        "assists": _safe_int(stats_block.get("assists") or stats_block.get("goalAssist")),
        "shots": _safe_int(stats_block.get("totalShots") or stats_block.get("totalShot")),
        "shotsOnTarget": _safe_int(stats_block.get("shotsOnTarget") or stats_block.get("onTargetScoringAttempt")),
        "passAccuracy": 0.0,
        "keyPasses": _safe_int(stats_block.get("keyPasses") or stats_block.get("keyPass")),
        "totalPasses": total_passes,
        "touches": _safe_int(stats_block.get("touches") or stats_block.get("totalTouches")),
        "accurateCrosses": accurate_crosses,
        "crosses": total_crosses,
        "crossAccuracy": 0.0,
        "finalThirdPasses": _safe_int(stats_block.get("accurateFinalThirdPasses")),
        "throughPasses": _safe_int(
            stats_block.get("throughPasses")
            or stats_block.get("accurateThroughPasses")
            or stats_block.get("totalThroughPasses")
        ),
        "oppHalfPasses": _safe_int(stats_block.get("accurateOppositionHalfPasses")),
        "dribbles": dribbles,
        "dribbleSuccess": dribble_pct,
        "possessionLost": _safe_int(stats_block.get("possessionLost") or stats_block.get("possessionLostCtrl")),
        "dispossessed": _safe_int(stats_block.get("dispossessed")),
        "miscontrols": _safe_int(stats_block.get("unsuccessfulTouches") or stats_block.get("unsuccessfulTouch")),
        "recoveries": _safe_int(stats_block.get("recoveries") or stats_block.get("ballRecovery")),
        "tackles": _safe_int(stats_block.get("tackles") or stats_block.get("totalTackle")),
        "successfulTackles": _safe_int(stats_block.get("successfulTackles") or stats_block.get("wonTackle")),
        "fouls": _safe_int(stats_block.get("fouls") or stats_block.get("foulsCommitted")),
        "interceptions": _safe_int(stats_block.get("interceptions") or stats_block.get("interceptionWon")),
        "aerialDuelsWon": _safe_int(stats_block.get("aerialDuelsWon") or stats_block.get("aerialWon")),
        "yellowCards": _safe_int(stats_block.get("yellowCards")),
        "redCards": _safe_int(stats_block.get("redCards")),
        "xG": _round2(stats_block.get("expectedGoals") or 0.0),
        "xA": _round2(stats_block.get("expectedAssists") or 0.0),
        "_accuratePasses": accurate_passes,
        "_totalDribbles": max(dribble_attempts, dribbles),
        "rating": _round1(_safe_float(stats_block.get("rating"))),
        # Attacking / chance creation
        "bigChancesCreated": _safe_int(stats_block.get("bigChanceCreated") or stats_block.get("bigChancesCreated")),
        "bigChancesMissed":  _safe_int(stats_block.get("bigChanceMissed") or stats_block.get("bigChancesMissed")),
        "missedChances":     _safe_int(stats_block.get("missedChances")),
        # Defensive / outfield
        "clearances":        _safe_int(stats_block.get("clearances") or stats_block.get("totalClearance")),
        "blocks":            _safe_int(stats_block.get("outfielderBlock") or stats_block.get("blocks")),
        "shotsBlocked":      _safe_int(stats_block.get("blockedScoringAttempt")),
        "duelsWon":          _safe_int(stats_block.get("duelWon")),
        "foulsSuffered":     _safe_int(stats_block.get("wasFouled")),
        # Carrying / physical
        "carries":            _safe_int(stats_block.get("ballCarriesCount")),
        "progressiveCarries": _safe_int(stats_block.get("progressiveBallCarriesCount")),
        "distanceCovered":    _round2(stats_block.get("kilometersCovered") or 0.0),
        "sprints":            _safe_int(stats_block.get("numberOfSprints")),
        "topSpeed":           _round1(_safe_float(stats_block.get("topSpeed"))),
        "goalsPrevented":     _round2(stats_block.get("goalsPrevented") or 0.0),
        # Goalkeeper
        "saves":           _safe_int(
            stats_block.get("saves")
            or (stats_block.get("savedShotsFromInsideTheBox", 0) or 0)
            + (stats_block.get("savedShotsFromOutsideTheBox", 0) or 0)
        ),
        "goalsConceded":   _safe_int(stats_block.get("goalsConceded")),
        "cleanSheets":     _safe_int(stats_block.get("cleanSheets")),
        "totalShotsFaced": _safe_int(
            stats_block.get("saves")
            or (stats_block.get("savedShotsFromInsideTheBox", 0) or 0)
            + (stats_block.get("savedShotsFromOutsideTheBox", 0) or 0)
        ) + _safe_int(stats_block.get("goalsConceded", 0)),
        "punches":         _safe_int(stats_block.get("punches")),
        "runOuts":         _safe_int(stats_block.get("runningOut") or stats_block.get("runOuts") or stats_block.get("totalKeeperSweeper")),
        "highClaims":      _safe_int(stats_block.get("highClaims") or stats_block.get("goodHighClaim")),
    }
    if position == "GK" and goals_conceded is not None:
        stats["goalsConceded"] = max(0, _safe_int(goals_conceded))
        stats["cleanSheets"] = 1 if stats["minutesPlayed"] >= 60 and stats["goalsConceded"] == 0 else 0
        stats["totalShotsFaced"] = (stats.get("saves", 0) or 0) + stats["goalsConceded"]
    return stats


def _add_match_stats(aggregate: dict, match_stats: dict):
    sum_keys = (
        "appearances", "starts", "minutesPlayed", "goals", "assists", "shots", "shotsOnTarget",
        "keyPasses", "totalPasses", "touches", "accurateCrosses", "crosses", "finalThirdPasses",
        "throughPasses", "oppHalfPasses", "dribbles", "possessionLost", "dispossessed", "miscontrols",
        "recoveries", "tackles", "successfulTackles", "fouls", "interceptions",
        "aerialDuelsWon", "yellowCards", "redCards", "_accuratePasses", "_totalDribbles",
        "bigChancesCreated", "bigChancesMissed", "missedChances", "clearances",
        "saves", "goalsConceded", "cleanSheets", "totalShotsFaced", "punches", "runOuts", "highClaims",
        "blocks", "shotsBlocked", "duelsWon", "foulsSuffered", "carries", "progressiveCarries", "sprints",
    )
    for key in sum_keys:
        aggregate[key] = aggregate.get(key, 0) + (match_stats.get(key, 0) or 0)
    aggregate["xG"] = _round2((aggregate.get("xG", 0) or 0) + (match_stats.get("xG", 0) or 0))
    aggregate["xA"] = _round2((aggregate.get("xA", 0) or 0) + (match_stats.get("xA", 0) or 0))
    aggregate["distanceCovered"] = _round2((aggregate.get("distanceCovered", 0) or 0) + (match_stats.get("distanceCovered", 0) or 0))
    aggregate["goalsPrevented"] = _round2((aggregate.get("goalsPrevented", 0) or 0) + (match_stats.get("goalsPrevented", 0) or 0))
    # Top speed is a peak, not a total — keep the highest across matches.
    aggregate["topSpeed"] = max(aggregate.get("topSpeed", 0) or 0, match_stats.get("topSpeed", 0) or 0)
    if match_stats.get("rating"):
        aggregate["_rating_sum"] = aggregate.get("_rating_sum", 0.0) + match_stats["rating"]
        aggregate["_rating_count"] = aggregate.get("_rating_count", 0) + 1
    if match_stats.get("teamPossession") and match_stats.get("minutesPlayed", 0) > 0:
        mins = match_stats["minutesPlayed"]
        aggregate["_poss_sum"] = aggregate.get("_poss_sum", 0.0) + match_stats["teamPossession"] * mins
        aggregate["_poss_mins"] = aggregate.get("_poss_mins", 0) + mins


def _finalize_aggregate_stats(stats: dict) -> dict:
    finalized = dict(stats)
    total_passes = finalized.get("totalPasses", 0) or 0
    accurate_passes = finalized.get("_accuratePasses", 0) or 0
    crosses = finalized.get("crosses", 0) or 0
    dribble_attempts = finalized.get("_totalDribbles", 0) or 0

    finalized["passAccuracy"] = _round1((accurate_passes / total_passes * 100) if total_passes else 0.0)
    finalized["crossAccuracy"] = _round1((finalized.get("accurateCrosses", 0) / crosses * 100) if crosses else 0.0)
    finalized["dribbleSuccess"] = _round1((finalized.get("dribbles", 0) / dribble_attempts * 100) if dribble_attempts else 0.0)
    finalized["rating"] = _round1(
        (finalized.get("_rating_sum", 0.0) / finalized.get("_rating_count", 0))
        if finalized.get("_rating_count", 0)
        else 0.0
    )
    finalized.pop("_rating_sum", None)
    finalized.pop("_rating_count", None)
    poss_mins = finalized.pop("_poss_mins", 0) or 0
    poss_sum = finalized.pop("_poss_sum", 0.0) or 0.0
    finalized["avgTeamPossession"] = _round1(poss_sum / poss_mins) if poss_mins else None
    return finalized


def _upsert_sync_state(db: Session, key: str, value: str):
    existing = db.query(models.SyncState).filter(models.SyncState.key == key).first()
    now = _utc_now()
    if existing:
        existing.value = value
        existing.updated_at = now
    else:
        db.add(models.SyncState(key=key, value=value, updated_at=now))


def _get_sync_state(db: Session, key: str) -> Optional[str]:
    row = db.query(models.SyncState).filter(models.SyncState.key == key).first()
    return row.value if row else None


def _competition_sync_row(db: Session, league: dict) -> Optional[models.CompetitionSyncState]:
    return (
        db.query(models.CompetitionSyncState)
        .filter(
            models.CompetitionSyncState.competition_name == league["name"],
            models.CompetitionSyncState.season == league.get("season_label", SEASON_LABEL),
        )
        .first()
    )


def _refresh_competition_sync_state(
    db: Session,
    league: dict,
    mode: str,
    status: str = "success",
    error: Optional[str] = None,
):
    row = _competition_sync_row(db, league)
    if not row:
        row = models.CompetitionSyncState(
            competition_name=league["name"],
            season=league.get("season_label", SEASON_LABEL),
            source_league_id=league["tournament_id"],
            source_season=league["season_id"],
            player_rows=0,
            team_rows=0,
            synced_fixtures=0,
        )
        db.add(row)

    row.source_league_id = league["tournament_id"]
    row.source_season = league["season_id"]
    row.player_rows = (
        db.query(models.Player)
        .filter(
            models.Player.league == league["name"],
            models.Player.season == league.get("season_label", SEASON_LABEL),
        )
        .count()
    )
    row.team_rows = (
        db.query(models.Team)
        .filter(
            models.Team.league == league["name"],
            models.Team.season == league.get("season_label", SEASON_LABEL),
        )
        .count()
    )
    row.synced_fixtures = (
        db.query(models.SyncedFixture)
        .filter(
            models.SyncedFixture.source_league_id == league["tournament_id"],
            models.SyncedFixture.source_season == league["season_id"],
        )
        .count()
    )
    timestamp = _utc_now()
    if mode == "full":
        row.last_full_sync_at = timestamp
    else:
        row.last_recent_sync_at = timestamp
    row.last_sync_status = status
    row.last_error = error


def _player_lookup(db: Session, source_player_id: int, source_league_id: Optional[int], season_label: str) -> Optional[models.Player]:
    for pending in db.new:
        if (
            isinstance(pending, models.Player)
            and pending.source_player_id == source_player_id
            and pending.source_league_id == source_league_id
            and pending.season == season_label
        ):
            return pending
    if source_player_id:
        p = (db.query(models.Player)
             .filter(models.Player.source_player_id == source_player_id,
                     models.Player.source_league_id == source_league_id,
                     models.Player.season == season_label)
             .first())
        if p:
            return p
    return None


def _team_lookup(db: Session, source_team_id: int, season_label: str) -> Optional[models.Team]:
    for pending in db.new:
        if isinstance(pending, models.Team) and pending.source_team_id == source_team_id and pending.season == season_label:
            return pending
    if source_team_id:
        team = (
            db.query(models.Team)
            .filter(
                models.Team.source_team_id == source_team_id,
                models.Team.season == season_label,
            )
            .first()
        )
        if team:
            return team
    return None


def _build_team_payload(team_info: dict, league: dict) -> dict:
    team_id = _safe_int(team_info.get("id"))
    return {
        "name": (team_info.get("name") or "").strip(),
        "league": league["name"],
        "season": league.get("season_label", SEASON_LABEL),
        "logo_url": _team_logo_url(team_id) if team_id else None,
        "source_team_id": team_id or None,
        "source_league_id": league["tournament_id"],
        "source_season": league["season_id"],
        "last_synced_at": _utc_now(),
    }


def _upsert_team(db: Session, payload: dict) -> models.Team:
    existing = _team_lookup(db, payload.get("source_team_id"), payload["season"])
    if existing:
        for key, value in payload.items():
            setattr(existing, key, value)
        return existing
    team = models.Team(**payload)
    db.add(team)
    return team


def _build_player_payload(
    player_info: dict,
    team_info: dict,
    league: dict,
    stats_block: dict,
) -> dict:
    player_id = _safe_int(player_info.get("id"))
    team_id = _safe_int(team_info.get("id"))
    country = player_info.get("country") or {}
    dob = player_info.get("dateOfBirth") or ""
    position_raw = player_info.get("position") or ""
    positions_detailed = player_info.get("positionsDetailed") or []

    stats = _stats_from_block(stats_block) if stats_block else _base_stats()

    return {
        "name":           (player_info.get("name") or "").strip(),
        "position":       _position(position_raw, positions_detailed),
        "nationality":    country.get("name") or "",
        "club":           (team_info.get("name") or "").strip(),
        "league":         league["name"],
        "age":            _age_from_dob(dob),
        "season":         league.get("season_label", SEASON_LABEL),
        "stats":          stats,
        "form":           [],
        "photo_url":      _photo_url(player_id) if player_id else None,
        "club_logo_url":  _team_logo_url(team_id) if team_id else None,
        "flag_code":      _flag_code(country),
        "source_player_id":  player_id or None,
        "source_team_id":    team_id or None,
        "source_league_id":  league["tournament_id"],
        "source_season":     league["season_id"],
        "last_synced_at":    _utc_now(),
    }


def _upsert_player(db: Session, payload: dict) -> models.Player:
    existing = _player_lookup(
        db,
        payload.get("source_player_id"),
        payload.get("source_league_id"),
        payload["season"],
    )
    if existing:
        for k, v in payload.items():
            setattr(existing, k, v)
        return existing
    player = models.Player(**payload)
    db.add(player)
    return player


def _sync_full_from_events(db: Session, league: dict, dry_run: bool = False) -> tuple[int, int, int]:
    player_aggregates: dict[int, dict] = {}
    player_infos: dict[int, dict] = {}
    team_infos: dict[int, dict] = {}
    fixture_count = 0
    event_pages = 0
    seen_fixtures: set[int] = set()

    tid = league["tournament_id"]
    sid = league["season_id"]

    for page_idx in range(FULL_SYNC_EVENT_PAGE_LIMIT):
        try:
            event_data = _get(f"/api/v1/unique-tournament/{tid}/season/{sid}/events/last/{page_idx}")
        except RuntimeError as exc:
            if "HTTP 404" in str(exc):
                break
            raise
        events = event_data.get("events", [])
        event_pages += 1
        if not events:
            break

        completed_events = [
            event for event in events
            if (event.get("status") or {}).get("type") in COMPLETED_STATUS_TYPES
        ]
        if not completed_events and page_idx > 0:
            break

        for event in completed_events:
            fixture_id = _safe_int(event.get("id"))
            if not fixture_id or fixture_id in seen_fixtures:
                continue
            seen_fixtures.add(fixture_id)

            ts = event.get("startTimestamp")
            fixture_date = (
                datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
                if ts else date.today().isoformat()
            )
            home = event.get("homeTeam", {})
            away = event.get("awayTeam", {})
            home_goals = _score_value(event.get("homeScore"))
            away_goals = _score_value(event.get("awayScore"))

            try:
                lineup_data = _get(f"/api/v1/event/{fixture_id}/lineups")
            except Exception as exc:
                log.warning("Could not fetch lineup for fixture %s in %s: %s", fixture_id, league["name"], exc)
                continue

            home_poss, away_poss = _fetch_match_possession(fixture_id)
            sides = (
                {"team": home, "players": lineup_data.get("home", {}).get("players", []), "possession": home_poss, "goals_conceded": away_goals},
                {"team": away, "players": lineup_data.get("away", {}).get("players", []), "possession": away_poss, "goals_conceded": home_goals},
            )

            for side in sides:
                team_info = side["team"] or {}
                team_id = _safe_int(team_info.get("id"))
                team_possession = side["possession"]
                goals_conceded = side["goals_conceded"]
                for entry in side["players"]:
                    player_info = entry.get("player") or {}
                    player_id = _safe_int(player_info.get("id"))
                    stats_block = entry.get("statistics") or {}
                    if not player_id or not stats_block:
                        continue

                    match_stats = _lineup_stats_from_block(
                        stats_block,
                        substitute=bool(entry.get("substitute")),
                        position=_position(player_info.get("position"), player_info.get("positionsDetailed") or []),
                        goals_conceded=goals_conceded,
                    )
                    if match_stats.get("minutesPlayed", 0) <= 0:
                        continue
                    match_stats["teamPossession"] = team_possession or None

                    player_infos[player_id] = player_info
                    if team_id:
                        team_infos[player_id] = team_info
                    aggregate = player_aggregates.setdefault(player_id, _base_stats())
                    _add_match_stats(aggregate, match_stats)

            fixture_count += 1
            if not dry_run:
                _touch_synced_fixture(db, fixture_id, league, fixture_date)

    players_written = 0
    for player_id, aggregate_stats in player_aggregates.items():
        player_info = player_infos.get(player_id, {})
        team_info = team_infos.get(player_id, {})
        if not player_info or not team_info:
            continue
        if not dry_run:
            _upsert_team(db, _build_team_payload(team_info, league))

        payload = _build_player_payload(player_info, team_info, league, {})
        payload["stats"] = _finalize_aggregate_stats(aggregate_stats)
        _upsert_player(db, payload)
        players_written += 1

    if dry_run:
        db.rollback()
    else:
        db.commit()

    log.info(
        "Seeded %s players from %s fixture pages (%s fixtures) for %s",
        players_written,
        event_pages,
        fixture_count,
        league["name"],
    )
    return players_written, event_pages, fixture_count


def _already_synced_fixture(db: Session, fixture_id: int) -> bool:
    return db.query(models.SyncedFixture).filter(models.SyncedFixture.fixture_id == fixture_id).first() is not None


def _touch_synced_fixture(db: Session, fixture_id: int, league: dict, fixture_date: str):
    if _already_synced_fixture(db, fixture_id):
        existing = db.query(models.SyncedFixture).filter(models.SyncedFixture.fixture_id == fixture_id).first()
        existing.synced_at = _utc_now()
        return
    db.add(models.SyncedFixture(
        fixture_id=fixture_id,
        source_league_id=league["tournament_id"],
        source_season=league["season_id"],
        fixture_date=fixture_date,
        synced_at=_utc_now(),
    ))


def _refresh_player_form(db: Session, player: models.Player, league: dict):
    candidates = (
        db.query(models.PlayerMatchStat)
        .filter(
            models.PlayerMatchStat.source_player_id == player.source_player_id,
            models.PlayerMatchStat.source_season == league["season_id"],
        )
        .order_by(models.PlayerMatchStat.fixture_date.desc())
        .limit(20)
        .all()
    )
    matches = [m for m in candidates if _safe_int((m.stats or {}).get("minutesPlayed")) > 0][:5]
    if not matches:
        return
    player.form = [
        {
            "match":   f"vs {m.opponent}" if m.opponent else "Recent Match",
            "rating":  _round1(_safe_float(m.rating)),
            "goals":   _safe_int((m.stats or {}).get("goals")),
            "assists": _safe_int((m.stats or {}).get("assists")),
            "date":    (m.fixture_date or "")[:10],
        }
        for m in matches
    ]


def _repair_keeper_match_stats_from_fixture_goals(
    db: Session,
    fixture_id: int,
    position_overrides: Optional[dict[int, str]] = None,
) -> int:
    rows = (
        db.query(models.PlayerMatchStat)
        .filter(models.PlayerMatchStat.fixture_id == fixture_id)
        .all()
    )
    if not rows:
        return 0

    team_goals: dict[int, int] = {}
    try:
        data = _get(f"/api/v1/event/{fixture_id}")
        event = data.get("event") or data
        home = event.get("homeTeam") or {}
        away = event.get("awayTeam") or {}
        home_id = _safe_int(home.get("id"))
        away_id = _safe_int(away.get("id"))
        if home_id:
            team_goals[home_id] = _score_value(event.get("homeScore")) or 0
        if away_id:
            team_goals[away_id] = _score_value(event.get("awayScore")) or 0
    except Exception:
        team_goals = {}

    if len(team_goals) < 2:
        for row in rows:
            if not row.source_team_id:
                continue
            team_goals[row.source_team_id] = team_goals.get(row.source_team_id, 0) + _safe_int((row.stats or {}).get("goals"))
    if len(team_goals) < 2:
        return 0

    player_ids = [row.source_player_id for row in rows if row.source_player_id]
    players = (
        db.query(models.Player)
        .filter(
            models.Player.source_player_id.in_(player_ids),
            models.Player.league == "FIFA World Cup",
            models.Player.season == "2026",
        )
        .all()
    )
    positions = {player.source_player_id: player.position for player in players}
    positions.update(position_overrides or {})
    changed = 0

    for row in rows:
        if positions.get(row.source_player_id) != "GK" or not row.source_team_id:
            continue
        stats = dict(row.stats or {})
        if _safe_int(stats.get("minutesPlayed")) <= 0:
            continue
        goals_conceded = sum(
            goals
            for team_id, goals in team_goals.items()
            if team_id != row.source_team_id
        )
        clean_sheet = 1 if _safe_int(stats.get("minutesPlayed")) >= 60 and goals_conceded == 0 else 0
        total_shots_faced = _safe_int(stats.get("saves")) + goals_conceded
        if (
            stats.get("goalsConceded") == goals_conceded
            and stats.get("cleanSheets") == clean_sheet
            and stats.get("totalShotsFaced") == total_shots_faced
        ):
            continue
        stats["goalsConceded"] = goals_conceded
        stats["cleanSheets"] = clean_sheet
        stats["totalShotsFaced"] = total_shots_faced
        row.stats = stats
        changed += 1

    return changed


def _rollup_competition_player_stats(
    db: Session,
    league: dict,
    source_player_ids: set[int],
    player_infos: Optional[dict[int, dict]] = None,
    team_infos: Optional[dict[int, dict]] = None,
) -> int:
    if not source_player_ids:
        return 0

    player_infos = player_infos or {}
    team_infos = team_infos or {}
    changed = 0
    position_overrides = {
        source_player_id: _position(info.get("position"), info.get("positionsDetailed") or [])
        for source_player_id, info in player_infos.items()
    }

    fixture_ids = [
        fixture_id
        for (fixture_id,) in (
            db.query(models.PlayerMatchStat.fixture_id)
            .filter(
                models.PlayerMatchStat.source_player_id.in_(source_player_ids),
                models.PlayerMatchStat.source_league_id == league["tournament_id"],
                models.PlayerMatchStat.source_season == league["season_id"],
            )
            .distinct()
            .all()
        )
    ]
    for fixture_id in fixture_ids:
        _repair_keeper_match_stats_from_fixture_goals(db, fixture_id, position_overrides=position_overrides)

    for source_player_id in source_player_ids:
        matches = (
            db.query(models.PlayerMatchStat)
            .filter(
                models.PlayerMatchStat.source_player_id == source_player_id,
                models.PlayerMatchStat.source_league_id == league["tournament_id"],
                models.PlayerMatchStat.source_season == league["season_id"],
            )
            .all()
        )
        if not matches:
            continue

        aggregate = _base_stats()
        latest_team_id = None
        for match in matches:
            match_stats = dict(match.stats or {})
            _add_match_stats(aggregate, match_stats)
            latest_team_id = match.source_team_id or latest_team_id

        player = _player_lookup(
            db,
            source_player_id,
            league["tournament_id"],
            league.get("season_label", SEASON_LABEL),
        )
        stats = _finalize_aggregate_stats(aggregate)

        if player:
            player.stats = stats
            player.last_synced_at = _utc_now()
            if latest_team_id and not player.source_team_id:
                player.source_team_id = latest_team_id
                player.club_logo_url = _team_logo_url(latest_team_id)
            changed += 1
            continue

        player_info = player_infos.get(source_player_id)
        team_info = team_infos.get(source_player_id)
        if not player_info or not team_info:
            continue

        _upsert_team(db, _build_team_payload(team_info, league))
        player_info = _merge_roster_player_info(player_info, team_info)
        payload = _build_player_payload(player_info, team_info, league, {})
        payload["stats"] = stats
        _upsert_player(db, payload)
        changed += 1

    return changed


def sync_full(
    dry_run: bool = False,
    page_limit: Optional[int] = None,
    db: Optional[Session] = None,
    competitions: Optional[list[str]] = None,
) -> dict:
    ensure_schema(models.Base)
    close_after = db is None
    db = db or SessionLocal()
    limit = page_limit if page_limit is not None else FULL_SYNC_PAGE_LIMIT
    players_written = 0
    pages_fetched = 0
    fixtures_synced = 0

    try:
        leagues = _filter_leagues(competitions)
        for league in leagues:
            tid = league["tournament_id"]
            sid = league["season_id"]
            page = 1

            try:
                while True:
                    offset = (page - 1) * FULL_SYNC_PAGE_SIZE
                    data = _get(
                        f"/api/v1/unique-tournament/{tid}/season/{sid}/statistics",
                        params={
                            "limit": FULL_SYNC_PAGE_SIZE,
                            "offset": offset,
                            "fields": STAT_FIELDS_PARAM,
                        },
                    )
                    rows = data.get("results", [])
                    total_pages = _safe_int(data.get("pages"), 1)

                    if not rows:
                        if page == 1:
                            fallback_players, fallback_pages, fallback_fixtures = _sync_full_from_events(db, league, dry_run=dry_run)
                            players_written += fallback_players
                            pages_fetched += fallback_pages
                            fixtures_synced += fallback_fixtures
                        break

                    for row in rows:
                        player_info = row.get("player", {})
                        team_info = row.get("team", {})
                        player_id = _safe_int(player_info.get("id"))
                        if not player_id:
                            continue
                        stats_block = row.get("statistics") or {
                            key: row.get(key)
                            for key in STAT_FIELDS
                            if key in row
                        }
                        if not stats_block:
                            continue

                        _upsert_team(db, _build_team_payload(team_info, league))
                        player_info = _merge_roster_player_info(player_info, team_info)
                        payload = _build_player_payload(player_info, team_info, league, stats_block)
                        _upsert_player(db, payload)
                        players_written += 1

                    if dry_run:
                        db.rollback()
                    else:
                        db.commit()
                    pages_fetched += 1
                    log.info("Seeded page %s/%s for %s (%s players total)", page, total_pages, league["name"], players_written)

                    if dry_run or page >= total_pages or (limit and pages_fetched >= limit):
                        break
                    page += 1

                if not dry_run:
                    _refresh_competition_sync_state(db, league, mode="full", status="success")
                    db.commit()
            except Exception as exc:
                if not dry_run:
                    _refresh_competition_sync_state(db, league, mode="full", status="failed", error=str(exc))
                    db.commit()
                raise

        if not dry_run:
            _upsert_sync_state(db, "last_full_sync_at", _utc_now())
            _upsert_sync_state(db, "last_incremental_sync_date", date.today().isoformat())
            db.commit()
        return {
            "mode": "full",
            "players": players_written,
            "pages": pages_fetched,
            "fixtures": fixtures_synced,
            "competitions": [league["name"] for league in leagues],
        }
    finally:
        if close_after:
            db.close()


EXACT_STAT_BACKFILL_FIELDS = (
    "touches",
    "totalTouches",
    "possessionLost",
    "dispossessed",
    "unsuccessfulTouches",
    "unsuccessfulTouch",
    "accurateCrosses",
    "totalCross",
    "totalCrosses",
    "crosses",
    "accurateCrossesPercentage",
    "accurateFinalThirdPasses",
    "accurateThroughPasses",
    "totalThroughPasses",
    "throughPasses",
    "bigChanceCreated",
    "bigChancesCreated",
    "bigChanceMissed",
    "bigChancesMissed",
    "missedChances",
    "successfulDribbles",
    "successfulDribblesPercentage",
    "totalDribbles",
    "dribblesAttempted",
    "attemptedDribbles",
    "totalDribbleAttempts",
    "recoveries",
    "ballRecovery",
    "tackles",
    "totalTackle",
    "successfulTackles",
    "wonTackle",
    "fouls",
    "foulsCommitted",
)
EXACT_STAT_BACKFILL_FIELDS_PARAM = ",".join(EXACT_STAT_BACKFILL_FIELDS)


def _merge_exact_stat_fields(existing: dict, source: dict) -> tuple[dict, bool]:
    stats = dict(existing or {})
    changed = False

    def set_if_present(target_key: str, *source_keys: str, percent_value: bool = False):
        nonlocal changed
        for source_key in source_keys:
            if source_key in source:
                value = _round1(source.get(source_key)) if percent_value else _safe_int(source.get(source_key))
                if stats.get(target_key) != value:
                    stats[target_key] = value
                    changed = True
                return

    set_if_present("touches", "touches", "totalTouches")
    set_if_present("possessionLost", "possessionLost")
    set_if_present("dispossessed", "dispossessed")
    set_if_present("miscontrols", "unsuccessfulTouches", "unsuccessfulTouch")
    set_if_present("accurateCrosses", "accurateCrosses")
    set_if_present("crosses", "totalCross", "totalCrosses", "crosses")
    set_if_present("crossAccuracy", "accurateCrossesPercentage", percent_value=True)
    set_if_present("finalThirdPasses", "accurateFinalThirdPasses")
    set_if_present("throughPasses", "throughPasses", "accurateThroughPasses", "totalThroughPasses")
    set_if_present("bigChancesCreated", "bigChanceCreated", "bigChancesCreated")
    set_if_present("bigChancesMissed", "bigChanceMissed", "bigChancesMissed")
    set_if_present("missedChances", "missedChances", "bigChanceMissed", "bigChancesMissed")
    set_if_present("recoveries", "recoveries", "ballRecovery")
    set_if_present("tackles", "tackles", "totalTackle")
    set_if_present("successfulTackles", "successfulTackles", "wonTackle")
    set_if_present("fouls", "fouls", "foulsCommitted")

    if (
        "crossAccuracy" not in stats
        and ("accurateCrosses" in stats or "crosses" in stats)
        and (stats.get("crosses") or 0)
    ):
        value = round((stats.get("accurateCrosses", 0) or 0) / stats["crosses"] * 100, 1)
        if stats.get("crossAccuracy") != value:
            stats["crossAccuracy"] = value
            changed = True

    dribble_source_keys = (
        "totalDribbles",
        "dribblesAttempted",
        "attemptedDribbles",
        "totalDribbleAttempts",
        "successfulDribbles",
        "successfulDribblesPercentage",
    )
    if any(key in source for key in dribble_source_keys):
        successful = _safe_int(source.get("successfulDribbles", stats.get("dribbles", 0)))
        percentage = _safe_float(source.get("successfulDribblesPercentage", stats.get("dribbleSuccess", 0)))
        attempts = _safe_int(
            source.get("totalDribbles")
            or source.get("dribblesAttempted")
            or source.get("attemptedDribbles")
            or source.get("totalDribbleAttempts")
            or 0
        )
        if not attempts and successful and percentage:
            attempts = round(successful / (percentage / 100))
        attempts = max(attempts, successful, stats.get("_totalDribbles", 0) or 0)
        if stats.get("_totalDribbles") != attempts:
            stats["_totalDribbles"] = attempts
            changed = True

    return stats, changed


def backfill_exact_stat_fields(
    dry_run: bool = False,
    db: Optional[Session] = None,
    competitions: Optional[list[str]] = None,
) -> dict:
    ensure_schema(models.Base)
    close_after = db is None
    db = db or SessionLocal()
    rows_updated = 0
    pages_fetched = 0
    failed: list[dict] = []

    try:
        selected_names = _normalize_competition_names(competitions)
        competition_rows = (
            db.query(
                models.Player.source_league_id,
                models.Player.source_season,
                models.Player.league,
            )
            .filter(
                models.Player.source_player_id.isnot(None),
                models.Player.source_league_id.isnot(None),
                models.Player.source_season.isnot(None),
            )
            .distinct()
            .all()
        )

        for source_league_id, source_season, league_name in competition_rows:
            if selected_names and str(league_name or "").strip().casefold() not in selected_names:
                continue

            page = 1
            try:
                while True:
                    offset = (page - 1) * FULL_SYNC_PAGE_SIZE
                    data = _get(
                        f"/api/v1/unique-tournament/{source_league_id}/season/{source_season}/statistics",
                        params={
                            "limit": FULL_SYNC_PAGE_SIZE,
                            "offset": offset,
                            "fields": EXACT_STAT_BACKFILL_FIELDS_PARAM,
                        },
                    )
                    pages_fetched += 1
                    provider_rows = data.get("results", [])
                    total_pages = _safe_int(data.get("pages"), 1)
                    if not provider_rows:
                        break

                    player_ids = [
                        _safe_int((item.get("player") or {}).get("id"))
                        for item in provider_rows
                    ]
                    local_rows = (
                        db.query(models.Player)
                        .filter(
                            models.Player.source_league_id == source_league_id,
                            models.Player.source_season == source_season,
                            models.Player.source_player_id.in_(player_ids),
                        )
                        .all()
                    )
                    by_source_id = {row.source_player_id: row for row in local_rows}

                    for item in provider_rows:
                        player_id = _safe_int((item.get("player") or {}).get("id"))
                        player = by_source_id.get(player_id)
                        if not player:
                            continue
                        merged_stats, changed = _merge_exact_stat_fields(
                            player.stats or {},
                            item.get("statistics") or item,
                        )
                        if changed:
                            player.stats = merged_stats
                            rows_updated += 1

                    if dry_run:
                        db.rollback()
                    else:
                        db.commit()

                    log.info(
                        "Backfilled exact stat page %s/%s for %s %s (%s rows updated)",
                        page,
                        total_pages,
                        league_name,
                        source_season,
                        rows_updated,
                    )

                    if page >= total_pages:
                        break
                    page += 1

            except Exception as exc:
                db.rollback()
                failed.append({
                    "competition": league_name,
                    "source_league_id": source_league_id,
                    "source_season": source_season,
                    "error": str(exc),
                })
                log.warning("Exact stat backfill failed for %s %s: %s", league_name, source_season, exc)

        if not dry_run:
            _upsert_sync_state(db, "last_exact_stat_backfill_at", _utc_now())
            db.commit()

        return {
            "mode": "exact_stat_backfill",
            "players": rows_updated,
            "pages": pages_fetched,
            "fixtures": 0,
            "competitions": competitions or [],
            "failed": failed,
        }
    finally:
        if close_after:
            db.close()


def sync_recent(
    days_back: Optional[int] = None,
    dry_run: bool = False,
    db: Optional[Session] = None,
    competitions: Optional[list[str]] = None,
) -> dict:
    ensure_schema(models.Base)
    close_after = db is None
    db = db or SessionLocal()
    players_touched: set[int] = set()
    fixtures_synced = 0
    players_rolled_up = 0

    try:
        leagues = _filter_leagues(competitions)
        for league in leagues:
            tid = league["tournament_id"]
            sid = league["season_id"]
            league_players_touched: set[int] = set()
            league_player_infos: dict[int, dict] = {}
            league_team_infos: dict[int, dict] = {}
            try:
                for page_idx in range(INCREMENTAL_LOOKBACK_PAGES):
                    try:
                        event_data = _get(f"/api/v1/unique-tournament/{tid}/season/{sid}/events/last/{page_idx}")
                    except RuntimeError as page_err:
                        if "404" in str(page_err):
                            break
                        raise
                    events = event_data.get("events", [])
                    if not events:
                        break

                    for event in events:
                        status = (event.get("status") or {})
                        status_type = status.get("type")
                        is_world_cup_live = league["name"] == "FIFA World Cup" and status_type == "inprogress"
                        if status_type not in COMPLETED_STATUS_TYPES and not is_world_cup_live:
                            continue

                        fixture_id = _safe_int(event.get("id"))
                        if not fixture_id:
                            continue
                        fixture_already_synced = _already_synced_fixture(db, fixture_id)
                        if fixture_already_synced and league["name"] != "FIFA World Cup":
                            continue

                        ts = event.get("startTimestamp")
                        fixture_date = (
                            datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
                            if ts else date.today().isoformat()
                        )

                        home = event.get("homeTeam", {})
                        away = event.get("awayTeam", {})
                        home_goals = _score_value(event.get("homeScore"))
                        away_goals = _score_value(event.get("awayScore"))

                        lineup_data = _get(f"/api/v1/event/{fixture_id}/lineups")
                        home_poss, away_poss = _fetch_match_possession(fixture_id)
                        sides = {
                            "home": {"team": home, "opponent": away.get("name", ""), "players": lineup_data.get("home", {}).get("players", []), "possession": home_poss, "goals_conceded": away_goals},
                            "away": {"team": away, "opponent": home.get("name", ""), "players": lineup_data.get("away", {}).get("players", []), "possession": away_poss, "goals_conceded": home_goals},
                        }

                        for side in sides.values():
                            team_info = side["team"]
                            opponent = side["opponent"]
                            team_possession = side["possession"]
                            goals_conceded = side["goals_conceded"]

                            for entry in side["players"]:
                                player_info = entry.get("player", {})
                                player_id = _safe_int(player_info.get("id"))
                                if not player_id:
                                    continue
                                if not dry_run:
                                    _upsert_team(db, _build_team_payload(team_info, league))
                                league_player_infos[player_id] = player_info
                                if team_info:
                                    league_team_infos[player_id] = team_info
                                stats_block = entry.get("statistics") or {}
                                match_stats = _lineup_stats_from_block(
                                    stats_block,
                                    substitute=bool(entry.get("substitute")),
                                    position=_position(player_info.get("position"), player_info.get("positionsDetailed") or []),
                                    goals_conceded=goals_conceded,
                                )
                                match_stats["teamPossession"] = team_possession or None

                                if match_stats.get("minutesPlayed", 0) <= 0:
                                    continue

                                if not dry_run:
                                    existing = db.query(models.PlayerMatchStat).filter(
                                        models.PlayerMatchStat.fixture_id == fixture_id,
                                        models.PlayerMatchStat.source_player_id == player_id,
                                    ).first()
                                    if existing:
                                        existing.source_team_id = _safe_int(team_info.get("id")) or existing.source_team_id
                                        existing.source_league_id = tid
                                        existing.source_season = sid
                                        existing.fixture_date = fixture_date
                                        existing.opponent = opponent
                                        existing.rating = str(match_stats["rating"])
                                        existing.stats = match_stats
                                    else:
                                        db.add(models.PlayerMatchStat(
                                            fixture_id=fixture_id,
                                            source_player_id=player_id,
                                            source_team_id=_safe_int(team_info.get("id")) or None,
                                            source_league_id=tid,
                                            source_season=sid,
                                            fixture_date=fixture_date,
                                            opponent=opponent,
                                            rating=str(match_stats["rating"]),
                                            stats=match_stats,
                                        ))

                                    existing_player = _player_lookup(
                                        db,
                                        player_id,
                                        league["tournament_id"],
                                        league.get("season_label", SEASON_LABEL),
                                    )
                                    if existing_player:
                                        existing_player.last_synced_at = _utc_now()
                                players_touched.add(player_id)
                                league_players_touched.add(player_id)

                        if not dry_run:
                            _touch_synced_fixture(db, fixture_id, league, fixture_date)
                        if not fixture_already_synced:
                            fixtures_synced += 1
                        if dry_run:
                            db.rollback()
                        else:
                            db.commit()
                        action = "Scanned" if dry_run else "Imported"
                        log.info("%s fixture %s for %s", action, fixture_id, league["name"])

                        if dry_run:
                            break
                    if dry_run and fixtures_synced:
                        break

                if not dry_run:
                    players_rolled_up += _rollup_competition_player_stats(
                        db,
                        league,
                        league_players_touched,
                        player_infos=league_player_infos,
                        team_infos=league_team_infos,
                    )
                    _refresh_competition_sync_state(db, league, mode="incremental", status="success")
                    db.commit()
            except Exception as exc:
                if not dry_run:
                    _refresh_competition_sync_state(db, league, mode="incremental", status="failed", error=str(exc))
                    db.commit()
                raise

        if not dry_run:
            touched_players = (
                db.query(models.Player)
                .filter(models.Player.source_player_id.in_(players_touched))
                .all()
                if players_touched else []
            )
            resolved_by_tournament = {league["tournament_id"]: league for league in leagues} or {
                league["tournament_id"]: league for league in _resolved_leagues()
            }
            for player in touched_players:
                league_cfg = resolved_by_tournament.get(player.source_league_id) or next(iter(resolved_by_tournament.values()))
                _refresh_player_form(db, player, league_cfg)

            _upsert_sync_state(db, "last_incremental_sync_date", date.today().isoformat())
            db.commit()
        return {
            "mode": "incremental",
            "players": len(players_touched),
            "players_rolled_up": players_rolled_up,
            "pages": 0,
            "fixtures": fixtures_synced,
            "competitions": [league["name"] for league in leagues],
        }
    finally:
        if close_after:
            db.close()


def sync_player_recent_form(
    player_row_id: int,
    db: Optional[Session] = None,
    max_matches: int = 40,
) -> dict:
    """
    Backfill exact recent form for one player using SofaScore's player events feed.
    This is intentionally targeted so a profile can get real opponents/ratings without
    scanning many competition fixture pages.
    """
    ensure_schema(models.Base)
    close_after = db is None
    db = db or SessionLocal()

    try:
      player = db.query(models.Player).filter(models.Player.id == player_row_id).first()
      if not player:
          return {"player_id": player_row_id, "imported": 0, "error": "Player not found"}
      if not player.source_player_id:
          return {"player_id": player_row_id, "imported": 0, "error": "Player has no source id"}

      candidates: list[dict] = []

      pages_to_scan = max(6, min(16, (max_matches // 8) + 8))
      for page_idx in range(pages_to_scan):
          try:
              data = _get(f"/api/v1/player/{player.source_player_id}/events/last/{page_idx}")
          except RuntimeError as exc:
              if "HTTP 404" in str(exc):
                  break
              raise
          events = data.get("events", [])
          statistics_map = data.get("statisticsMap") or {}
          incidents_map = data.get("incidentsMap") or {}
          played_for_map = data.get("playedForTeamMap") or {}

          for event in events:
              status = event.get("status") or {}
              if status.get("type") not in COMPLETED_STATUS_TYPES:
                  continue

              fixture_id = _safe_int(event.get("id"))
              if not fixture_id:
                  continue

              stats_block = statistics_map.get(str(fixture_id)) or statistics_map.get(fixture_id) or {}
              incidents_block = incidents_map.get(str(fixture_id)) or incidents_map.get(fixture_id) or {}
              minutes = _safe_int(stats_block.get("minutesPlayed") or stats_block.get("minutes"))
              if minutes <= 0:
                  continue

              played_for_team_id = _safe_int(
                  played_for_map.get(str(fixture_id)) or played_for_map.get(fixture_id)
              )
              home = event.get("homeTeam") or {}
              away = event.get("awayTeam") or {}
              home_id = _safe_int(home.get("id"))
              away_id = _safe_int(away.get("id"))
              opponent = ""
              if played_for_team_id and played_for_team_id == home_id:
                  opponent = away.get("name", "")
              elif played_for_team_id and played_for_team_id == away_id:
                  opponent = home.get("name", "")
              else:
                  opponent = away.get("name") or home.get("name") or ""

              ts = event.get("startTimestamp")
              fixture_date = (
                  datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
                  if ts else date.today().isoformat()
              )
              tournament = event.get("tournament") or {}
              unique_tournament = tournament.get("uniqueTournament") or {}
              season = event.get("season") or {}
              source_league_id = _safe_int(unique_tournament.get("id") or tournament.get("id"))
              source_season = _safe_int(season.get("id"))

              match_stats = {
                  "minutesPlayed": minutes,
                  "goals": _safe_int(stats_block.get("goals") or incidents_block.get("goals")),
                  "assists": _safe_int(stats_block.get("assists") or stats_block.get("goalAssist") or incidents_block.get("assists")),
                  "possessionLost": _safe_int(stats_block.get("possessionLost")),
                  "touches": _safe_int(stats_block.get("touches") or stats_block.get("totalTouches")),
                  "accurateCrosses": _safe_int(stats_block.get("accurateCrosses")),
                  "crosses": _safe_int(stats_block.get("totalCross") or stats_block.get("totalCrosses") or stats_block.get("crosses")),
                  "finalThirdPasses": _safe_int(stats_block.get("accurateFinalThirdPasses")),
                  "throughPasses": _safe_int(stats_block.get("throughPasses") or stats_block.get("accurateThroughPasses") or stats_block.get("totalThroughPasses")),
                  "bigChancesCreated": _safe_int(stats_block.get("bigChanceCreated") or stats_block.get("bigChancesCreated")),
                  "bigChancesMissed": _safe_int(stats_block.get("bigChanceMissed") or stats_block.get("bigChancesMissed")),
                  "missedChances": _safe_int(stats_block.get("missedChances") or stats_block.get("bigChanceMissed") or stats_block.get("bigChancesMissed")),
                  "dispossessed": _safe_int(stats_block.get("dispossessed")),
                  "miscontrols": _safe_int(stats_block.get("unsuccessfulTouches") or stats_block.get("unsuccessfulTouch")),
                  "recoveries": _safe_int(stats_block.get("recoveries") or stats_block.get("ballRecovery")),
                  "tackles": _safe_int(stats_block.get("tackles") or stats_block.get("totalTackle")),
                  "successfulTackles": _safe_int(stats_block.get("successfulTackles") or stats_block.get("wonTackle")),
                  "fouls": _safe_int(stats_block.get("fouls") or stats_block.get("foulsCommitted")),
                  "interceptions": _safe_int(stats_block.get("interceptions") or stats_block.get("interceptionWon")),
                  "rating": _round1(_safe_float(stats_block.get("rating"))),
              }

              candidates.append({
                  "fixture_id": fixture_id,
                  "source_team_id": played_for_team_id or None,
                  "source_league_id": source_league_id or None,
                  "source_season": source_season or None,
                  "fixture_date": fixture_date,
                  "start_timestamp": _safe_int(ts),
                  "opponent": opponent,
                  "stats": match_stats,
              })

          if len(candidates) >= max_matches:
              break

      candidates = sorted(
          candidates,
          key=lambda item: (item["start_timestamp"], item["fixture_id"]),
          reverse=True,
      )

      imported = 0
      touched = []

      for candidate in candidates[:max_matches]:
              fixture_id = candidate["fixture_id"]
              match_stats = candidate["stats"]

              existing = db.query(models.PlayerMatchStat).filter(
                  models.PlayerMatchStat.fixture_id == fixture_id,
                  models.PlayerMatchStat.source_player_id == player.source_player_id,
              ).first()
              if existing:
                  existing.source_team_id = candidate["source_team_id"] or existing.source_team_id
                  existing.source_league_id = candidate["source_league_id"] or existing.source_league_id
                  existing.source_season = candidate["source_season"] or existing.source_season
                  existing.fixture_date = candidate["fixture_date"]
                  existing.opponent = candidate["opponent"]
                  existing.rating = str(match_stats["rating"])
                  existing.stats = match_stats
              else:
                  db.add(models.PlayerMatchStat(
                      fixture_id=fixture_id,
                      source_player_id=player.source_player_id,
                      source_team_id=candidate["source_team_id"],
                      source_league_id=candidate["source_league_id"],
                      source_season=candidate["source_season"],
                      fixture_date=candidate["fixture_date"],
                      opponent=candidate["opponent"],
                      rating=str(match_stats["rating"]),
                      stats=match_stats,
                  ))

              touched.append({
                  "fixture_id": fixture_id,
                  "date": candidate["fixture_date"],
                  "opponent": candidate["opponent"],
                  "rating": match_stats["rating"],
              })
              imported += 1

      _rollup_player_exact_defensive_stats(db, player.source_player_id)

      for row in db.query(models.Player).filter(models.Player.source_player_id == player.source_player_id).all():
          row.last_synced_at = _utc_now()

      db.commit()
      return {
          "player_id": player_row_id,
          "source_player_id": player.source_player_id,
          "imported": imported,
          "matches": touched[:5],
      }
    finally:
      if close_after:
          db.close()


def _rollup_player_exact_defensive_stats(db: Session, source_player_id: int) -> int:
    rows = (
        db.query(models.Player)
        .filter(models.Player.source_player_id == source_player_id)
        .all()
    )
    if not rows:
        return 0

    matches = (
        db.query(models.PlayerMatchStat)
        .filter(models.PlayerMatchStat.source_player_id == source_player_id)
        .all()
    )
    if not matches:
        return 0

    exact_keys = (
        "recoveries",
        "successfulTackles",
        "fouls",
        "throughPasses",
        "bigChancesCreated",
        "bigChancesMissed",
        "missedChances",
    )
    floor_keys = ("tackles", "interceptions")
    changed = 0

    for row in rows:
        matching = [
            match for match in matches
            if (
                (not row.source_league_id or match.source_league_id == row.source_league_id)
                and (not row.source_season or match.source_season == row.source_season)
                and (not row.source_team_id or not match.source_team_id or match.source_team_id == row.source_team_id)
            )
        ]
        if not matching:
            continue

        stats = dict(row.stats or {})
        before = dict(stats)
        for key in exact_keys:
            value = sum((match.stats or {}).get(key, 0) or 0 for match in matching)
            if value:
                stats[key] = value
            else:
                stats.setdefault(key, 0)
        for key in floor_keys:
            value = sum((match.stats or {}).get(key, 0) or 0 for match in matching)
            if value:
                stats[key] = max(stats.get(key, 0) or 0, value)
            else:
                stats.setdefault(key, 0)
        if stats != before:
            row.stats = stats
            changed += 1

    return changed


def sync_player_defensive_from_match_lineups(
    player_row_id: int,
    db: Optional[Session] = None,
    max_matches: int = 30,
) -> dict:
    ensure_schema(models.Base)
    close_after = db is None
    db = db or SessionLocal()

    try:
        player = db.query(models.Player).filter(models.Player.id == player_row_id).first()
        if not player:
            return {"player_id": player_row_id, "updated": 0, "error": "Player not found"}
        if not player.source_player_id:
            return {"player_id": player_row_id, "updated": 0, "error": "Player has no source id"}

        matches = (
            db.query(models.PlayerMatchStat)
            .filter(models.PlayerMatchStat.source_player_id == player.source_player_id)
            .order_by(models.PlayerMatchStat.fixture_date.desc())
            .limit(max(1, min(max_matches, 80)))
            .all()
        )

        updated = 0
        checked = 0
        failed: list[dict] = []
        for match in matches:
            checked += 1
            try:
                lineup_data = _get(f"/api/v1/event/{match.fixture_id}/lineups")
            except Exception as exc:
                failed.append({"fixture_id": match.fixture_id, "error": str(exc)})
                continue

            lineup_entries = (
                (lineup_data.get("home", {}) or {}).get("players", [])
                + (lineup_data.get("away", {}) or {}).get("players", [])
            )
            entry = next(
                (
                    item for item in lineup_entries
                    if _safe_int((item.get("player") or {}).get("id")) == player.source_player_id
                ),
                None,
            )
            if not entry:
                continue

            stats_block = entry.get("statistics") or {}
            if not stats_block:
                continue
            exact_stats = _lineup_stats_from_block(
                stats_block,
                substitute=bool(entry.get("substitute")),
            )
            current = dict(match.stats or {})
            for key in (
                "recoveries", "tackles", "successfulTackles", "fouls", "interceptions",
                "possessionLost", "touches", "dispossessed", "miscontrols", "rating",
                "throughPasses", "bigChancesCreated", "bigChancesMissed", "missedChances",
            ):
                if key in exact_stats:
                    current[key] = exact_stats[key]
            match.stats = current
            match.rating = str(current.get("rating", match.rating or 0))
            updated += 1

        rolled_up = _rollup_player_exact_defensive_stats(db, player.source_player_id)
        for row in db.query(models.Player).filter(models.Player.source_player_id == player.source_player_id).all():
            row.last_synced_at = _utc_now()
        db.commit()

        return {
            "player_id": player_row_id,
            "source_player_id": player.source_player_id,
            "checked": checked,
            "updated": updated,
            "rolled_up": rolled_up,
            "failed": failed[:5],
        }
    finally:
        if close_after:
            db.close()


def sync_missing_national_match_logs(
    limit: int = 25,
    max_matches: int = 120,
    force: bool = False,
    db: Optional[Session] = None,
) -> dict:
    """
    Backfill exact player-events logs for players whose 25/26 profiles still rely
    on fallback national-team competition rows.
    """
    ensure_schema(models.Base)
    close_after = db is None
    db = db or SessionLocal()

    try:
        import crud

        rows = (
            db.query(models.Player)
            .filter(
                models.Player.season == SEASON_LABEL,
                models.Player.source_player_id.isnot(None),
            )
            .order_by(models.Player.id)
            .all()
        )

        seen_source_ids: set[int] = set()
        candidates: list[models.Player] = []
        max_age_hours = 0 if force else 24

        for row in rows:
            if row.source_player_id in seen_source_ids:
                continue
            seen_source_ids.add(row.source_player_id)
            if crud.needs_national_match_sync(db, row.id, max_age_hours=max_age_hours):
                candidates.append(row)
            if len(candidates) >= limit:
                break

        synced = []
        failed = []
        imported_total = 0

        for player in candidates:
            try:
                result = sync_player_recent_form(player.id, db=db, max_matches=max_matches)
                crud.mark_national_match_sync_attempt(db, player.id)
                imported = int(result.get("imported", 0) or 0)
                imported_total += imported
                synced.append({
                    "id": player.id,
                    "name": player.name,
                    "club": player.club,
                    "nationality": player.nationality,
                    "imported": imported,
                })
            except Exception as exc:
                crud.mark_national_match_sync_attempt(db, player.id)
                failed.append({
                    "id": player.id,
                    "name": player.name,
                    "error": str(exc),
                })

        return {
            "mode": "national_match_backfill",
            "players": len(synced),
            "failed": len(failed),
            "fixtures": imported_total,
            "pages": 0,
            "remaining_sampled": len(candidates),
            "synced": synced,
            "errors": failed[:10],
        }
    finally:
        if close_after:
            db.close()


def fetch_all(dry_run: bool = False) -> list:
    sync_full(dry_run=dry_run)
    db = SessionLocal()
    try:
        return db.query(models.Player).order_by(models.Player.id).all()
    finally:
        db.close()


def sync_to_db(players: list, db=None) -> int:
    return len(players)


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    mode = "incremental" if "--incremental" in sys.argv else "full"

    if not API_KEY:
        print("\n⚠  RAPIDAPI_KEY not set in backend/.env\n")
        sys.exit(1)

    result = sync_recent(dry_run=dry_run) if mode == "incremental" else sync_full(dry_run=dry_run)
    log.info("Done: %s", result)
