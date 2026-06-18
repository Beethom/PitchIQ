import types
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
import models
import schemas
import re
import unicodedata
import time
from datetime import date, datetime, timezone


def get_player(db: Session, player_id: int) -> Optional[models.Player]:
    return db.query(models.Player).filter(models.Player.id == player_id).first()


_WORLD_CUP_PROVIDER_CACHE: dict[str, tuple[float, object]] = {}


def _cache_get(key: str, ttl_seconds: int):
    item = _WORLD_CUP_PROVIDER_CACHE.get(key)
    if not item:
        return None
    created_at, payload = item
    if time.time() - created_at >= ttl_seconds:
        _WORLD_CUP_PROVIDER_CACHE.pop(key, None)
        return None
    return payload


def _cache_set(key: str, payload):
    _WORLD_CUP_PROVIDER_CACHE[key] = (time.time(), payload)
    return payload


def _season_years(season: str) -> set[int]:
    if re.fullmatch(r"\d{2}/\d{2}", season or ""):
        start, end = season.split("/")
        return {2000 + int(start), 2000 + int(end)}
    if re.fullmatch(r"\d{4}", season or ""):
        return {int(season)}
    return set()


def _is_cross_year_season(season: str) -> bool:
    return bool(re.fullmatch(r"\d{2}/\d{2}", season or ""))


def _season_window(season: str) -> Optional[tuple[date, date]]:
    if not _is_cross_year_season(season):
        return None
    start, end = season.split("/")
    return date(2000 + int(start), 9, 1), date(2000 + int(end), 7, 31)


def _parse_date(value: str) -> Optional[date]:
    try:
        return date.fromisoformat((value or "")[:10])
    except ValueError:
        return None


def _parse_datetime(value: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat((value or "").replace("Z", "+00:00"))
    except ValueError:
        return None


NATIONAL_COMPETITIONS = {
    "international friendlies",
    "uefa nations league",
    "concacaf nations league",
    "concacaf gold cup",
    "copa america",
    "copa américa",
    "fifa world cup",
    "world cup",
    "world cup qual. conmebol",
    "world cup qual. uefa",
    "world cup qual. concacaf",
}

NATIONAL_COMPETITION_LABELS = {
    16: "FIFA World Cup",
    11: "World Cup Qual. UEFA",
    14: "World Cup Qual. CONCACAF",
    295: "World Cup Qual. CONMEBOL",
    851: "International Friendlies",
    10783: "UEFA Nations League",
    14100: "CONCACAF Nations League",
    140: "CONCACAF Gold Cup",
    133: "Copa América",
}

WORLD_CUP_2026_TEAM_ALIASES = {
    "Mexico",
    "South Africa",
    "South Korea",
    "Korea Republic",
    "Republic of Korea",
    "Czechia",
    "Czech Republic",
    "Canada",
    "Bosnia and Herzegovina",
    "Bosnia & Herzegovina",
    "Qatar",
    "Switzerland",
    "Brazil",
    "Morocco",
    "Haiti",
    "Scotland",
    "United States",
    "USA",
    "United States of America",
    "Paraguay",
    "Australia",
    "Turkey",
    "Türkiye",
    "Germany",
    "Curaçao",
    "Curacao",
    "Ivory Coast",
    "Côte d'Ivoire",
    "Cote d'Ivoire",
    "Ecuador",
    "Netherlands",
    "Japan",
    "Sweden",
    "Tunisia",
    "Belgium",
    "Egypt",
    "Iran",
    "New Zealand",
    "Spain",
    "Cape Verde",
    "Saudi Arabia",
    "Uruguay",
    "France",
    "Senegal",
    "Iraq",
    "Norway",
    "Argentina",
    "Algeria",
    "Austria",
    "Jordan",
    "Portugal",
    "DR Congo",
    "Democratic Republic of the Congo",
    "Congo DR",
    "Uzbekistan",
    "Colombia",
    "England",
    "Croatia",
    "Ghana",
    "Panama",
}

WORLD_CUP_2026_LEAGUES = (
    "FIFA World Cup",
    "World Cup Qual. CONMEBOL",
    "World Cup Qual. UEFA",
    "World Cup Qual. CONCACAF",
    "CONCACAF Gold Cup",
    "Copa América",
    "UEFA Nations League",
    "CONCACAF Nations League",
    "International Friendlies",
)


def _is_international_row(row) -> bool:
    league = _normalize_text(getattr(row, "league", ""))
    return _is_national_team_row(row) or league in NATIONAL_COMPETITIONS


def _row_matches_season_cycle(row, base, allow_calendar_international: bool = False) -> bool:
    if row.season == base.season:
        return True

    base_years = _season_years(base.season)
    row_years = _season_years(row.season)
    if not base_years or not row_years:
        return False

    if (
        _is_cross_year_season(base.season)
        and _is_international_row(row)
        and not allow_calendar_international
    ):
        years = sorted(base_years)
        return len(years) == 2 and row_years == {years[-1]}

    return row_years.issubset(base_years)


def _national_competition_label(source_league_id: Optional[int], fallback: str) -> str:
    if source_league_id in NATIONAL_COMPETITION_LABELS:
        return NATIONAL_COMPETITION_LABELS[source_league_id]
    if _normalize_text(fallback) in {"fifa world cup", "world cup"}:
        return "International Matches"
    return fallback or "International"


def _player_photo_url(row) -> Optional[str]:
    return getattr(row, "photo_url", None) or (
        f"/api/media/player/{row.source_player_id}/image"
        if getattr(row, "source_player_id", None)
        else None
    )


def _club_logo_url(row) -> Optional[str]:
    return getattr(row, "club_logo_url", None) or (
        f"/api/media/team/{row.source_team_id}/image"
        if getattr(row, "source_team_id", None)
        else None
    )


def _build_windowed_international_row(row, base_season: str, matches: list, source_league_id: Optional[int]):
    label = _national_competition_label(source_league_id, row.league)
    source_season = next((match.source_season for match in matches if match.source_season), row.source_season)
    synthetic_id = (row.id * 100000) + (source_league_id or 0)

    totals = {
        "appearances": len(matches),
        "starts": len(matches),
        "minutesPlayed": 0,
        "goals": 0,
        "assists": 0,
        "shots": 0,
        "shotsOnTarget": 0,
        "keyPasses": 0,
        "totalPasses": 0,
        "touches": 0,
        "accurateCrosses": 0,
        "crosses": 0,
        "finalThirdPasses": 0,
        "throughPasses": 0,
        "dribbles": 0,
        "possessionLost": 0,
        "dispossessed": 0,
        "miscontrols": 0,
        "recoveries": 0,
        "tackles": 0,
        "successfulTackles": 0,
        "fouls": 0,
        "interceptions": 0,
        "aerialDuelsWon": 0,
        "yellowCards": 0,
        "redCards": 0,
        "_accuratePasses": 0,
        "_totalDribbles": 0,
        "xG": 0.0,
        "xA": 0.0,
        "bigChancesCreated": 0,
        "bigChancesMissed": 0,
        "missedChances": 0,
    }
    rating_sum = 0.0
    rating_count = 0
    form = []

    for match in sorted(matches, key=lambda item: item.fixture_date, reverse=True):
        stats = match.stats or {}
        totals["minutesPlayed"] += stats.get("minutesPlayed", 0) or 0
        totals["goals"] += stats.get("goals", 0) or 0
        totals["assists"] += stats.get("assists", 0) or 0
        totals["possessionLost"] += stats.get("possessionLost", 0) or 0
        totals["touches"] += stats.get("touches", 0) or 0
        totals["accurateCrosses"] += stats.get("accurateCrosses", 0) or 0
        totals["crosses"] += stats.get("crosses", 0) or 0
        totals["finalThirdPasses"] += stats.get("finalThirdPasses", 0) or 0
        totals["throughPasses"] += stats.get("throughPasses", 0) or 0
        totals["bigChancesCreated"] += stats.get("bigChancesCreated", 0) or 0
        totals["bigChancesMissed"] += stats.get("bigChancesMissed", 0) or 0
        totals["missedChances"] += stats.get("missedChances", stats.get("bigChancesMissed", 0)) or 0
        totals["dispossessed"] += stats.get("dispossessed", 0) or 0
        totals["miscontrols"] += stats.get("miscontrols", 0) or 0
        totals["recoveries"] += stats.get("recoveries", 0) or 0
        totals["tackles"] += stats.get("tackles", 0) or 0
        totals["successfulTackles"] += stats.get("successfulTackles", 0) or 0
        totals["fouls"] += stats.get("fouls", 0) or 0
        totals["interceptions"] += stats.get("interceptions", 0) or 0
        rating = float(match.rating or stats.get("rating") or 0)
        if rating:
            rating_sum += rating
            rating_count += 1
        form.append({
            "match": f"vs {match.opponent}" if match.opponent else "International Match",
            "rating": round(rating, 1),
            "goals": stats.get("goals", 0) or 0,
            "assists": stats.get("assists", 0) or 0,
            "date": (match.fixture_date or "")[:10],
            "competition": label,
        })

    totals["rating"] = round(rating_sum / rating_count, 1) if rating_count else 0.0
    return types.SimpleNamespace(
        id=synthetic_id,
        name=row.name,
        position=row.position,
        nationality=row.nationality,
        club=row.club,
        league=label,
        primary_league=getattr(row, "primary_league", None),
        age=row.age,
        season=base_season,
        stats=totals,
        form=form[:5],
        photo_url=_player_photo_url(row),
        club_logo_url=_club_logo_url(row),
        flag_code=row.flag_code,
        source_player_id=row.source_player_id,
        source_team_id=row.source_team_id,
        source_league_id=source_league_id or row.source_league_id,
        source_season=source_season,
        last_synced_at=row.last_synced_at,
    )


def _windowed_international_rows(db: Session, row, base_season: str):
    window = _season_window(base_season)
    if not window or not _is_international_row(row) or row.season == base_season:
        return []

    start_date, end_date = window
    matches = (
        db.query(models.PlayerMatchStat)
        .filter(
            models.PlayerMatchStat.source_player_id == row.source_player_id,
            models.PlayerMatchStat.source_team_id == row.source_team_id,
        )
        .all()
    )

    window_matches = []
    for match in matches:
        fixture_date = _parse_date(match.fixture_date)
        if fixture_date and start_date <= fixture_date <= end_date:
            window_matches.append(match)

    if not window_matches:
        return []

    grouped: dict[Optional[int], list] = {}
    for match in window_matches:
        grouped.setdefault(match.source_league_id, []).append(match)

    return [
        _build_windowed_international_row(row, base_season, group_matches, source_league_id)
        for source_league_id, group_matches in sorted(grouped.items(), key=lambda item: _national_competition_label(item[0], row.league))
    ]


def _related_competition_rows(db: Session, player: models.Player) -> List[models.Player]:
    """Return all Player rows that belong to the same real player and season cycle."""
    if not player.source_player_id:
        return [player]

    base_years = _season_years(player.season)
    rows = (
        db.query(models.Player)
        .filter(models.Player.source_player_id == player.source_player_id)
        .all()
    )
    if not base_years:
        return rows

    related = []
    seen_windowed_international: set[tuple[Optional[int], Optional[int], Optional[int], str]] = set()
    for row in rows:
        if _is_cross_year_season(player.season) and _is_international_row(row) and row.season != player.season:
            if _has_detailed_player_stats(row):
                if _row_matches_season_cycle(row, player, allow_calendar_international=True):
                    related.append(row)
                continue
            windowed = _windowed_international_rows(db, row, player.season)
            if windowed:
                for windowed_row in windowed:
                    key = (
                        windowed_row.source_player_id,
                        windowed_row.source_team_id,
                        windowed_row.source_league_id,
                        windowed_row.season,
                    )
                    if key in seen_windowed_international:
                        continue
                    seen_windowed_international.add(key)
                    related.append(windowed_row)
            elif _row_matches_season_cycle(row, player):
                related.append(row)
            continue
        if _row_matches_season_cycle(row, player):
            related.append(row)
    return related or [player]


def _related_rows_for_cycle(rows: List[models.Player], base: models.Player) -> List[models.Player]:
    """Return the rows from an in-memory set that match the same season cycle as base."""
    base_years = _season_years(base.season)
    if not base_years:
        return [row for row in rows if row.season == base.season] or [base]

    related = []
    for row in rows:
        if _row_matches_season_cycle(row, base):
            related.append(row)
    return related or [base]


def _replace_windowed_international_rows(db: Session, rows: list, base_season: str) -> list:
    if not _is_cross_year_season(base_season):
        return rows

    replaced = []
    seen_windowed: set[tuple[Optional[int], Optional[int], Optional[int], str]] = set()
    for row in rows:
        if _is_international_row(row) and row.season != base_season:
            if _has_detailed_player_stats(row):
                replaced.append(row)
                continue
            windowed = _windowed_international_rows(db, row, base_season)
            if windowed:
                for windowed_row in windowed:
                    key = (
                        windowed_row.source_player_id,
                        windowed_row.source_team_id,
                        windowed_row.source_league_id,
                        windowed_row.season,
                    )
                    if key in seen_windowed:
                        continue
                    seen_windowed.add(key)
                    replaced.append(windowed_row)
                continue
        replaced.append(row)
    return replaced


def _has_detailed_player_stats(row) -> bool:
    stats = getattr(row, "stats", {}) or {}
    detailed_keys = (
        "shots",
        "shotsOnTarget",
        "keyPasses",
        "totalPasses",
        "touches",
        "dribbles",
        "recoveries",
        "tackles",
        "interceptions",
        "xG",
        "xA",
    )
    return any((stats.get(key) or 0) for key in detailed_keys)


def _season_sort_key(season: str) -> tuple[int, int]:
    years = sorted(_season_years(season))
    if not years:
        return (0, 0)
    return (max(years), min(years))


def _season_filter_values(season: Optional[str]) -> list[str]:
    if not season:
        return []
    years = sorted(_season_years(season))
    if re.fullmatch(r"\d{2}/\d{2}", season or "") and years:
        return [season, *[str(year) for year in years]]
    return [season]


def _normalize_text(value: str) -> str:
    return unicodedata.normalize("NFD", value or "").encode("ascii", "ignore").decode().strip().casefold()


def _canonical_name(value: str) -> str:
    text = _normalize_text(value)
    replacements = {
        " junior": " jr",
        " juniores": " jr",
        "junior ": "jr ",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _player_identity_key(row: models.Player):
    if row.source_player_id is not None:
        return ("source", row.source_player_id)
    return (
        "fallback",
        _canonical_name(row.name),
        _normalize_text(row.nationality),
        row.age,
    )


def _visible_identity_key(player) -> tuple[str, str, str]:
    return (
        _canonical_name(getattr(player, "name", "")),
        _normalize_text(getattr(player, "nationality", "")),
        _normalize_text(getattr(player, "club", "")),
    )


def _is_national_team_row(row: models.Player) -> bool:
    return _normalize_text(getattr(row, "club", "")) == _normalize_text(getattr(row, "nationality", ""))


def _candidate_row_score(row: models.Player) -> tuple:
    stats = getattr(row, "stats", {}) or {}
    return (
        0 if _is_national_team_row(row) else 1,
        _season_sort_key(getattr(row, "season", "")),
        stats.get("appearances", 0) or 0,
        stats.get("minutesPlayed", 0) or 0,
        getattr(row, "last_synced_at", "") or "",
        -getattr(row, "id", 0),
    )


def _merge_visible_duplicates(players: list) -> list:
    merged: dict[tuple[str, str, str], object] = {}
    for player in players:
        key = _visible_identity_key(player)
        existing = merged.get(key)
        if not existing:
            merged[key] = player
            continue

        existing_season = _season_sort_key(getattr(existing, "season", ""))
        current_season = _season_sort_key(getattr(player, "season", ""))
        existing_is_agg = getattr(existing, "league", "") == "All Competitions"
        current_is_agg = getattr(player, "league", "") == "All Competitions"

        existing_score = (
            1 if existing_is_agg else 0,
            existing_season,
            getattr(existing, "stats", {}).get("appearances", 0),
            getattr(existing, "last_synced_at", "") or "",
            -getattr(existing, "id", 0),
        )
        current_score = (
            1 if current_is_agg else 0,
            current_season,
            getattr(player, "stats", {}).get("appearances", 0),
            getattr(player, "last_synced_at", "") or "",
            -getattr(player, "id", 0),
        )
        if current_score > existing_score:
            merged[key] = player

    return list(merged.values())


def _pick_latest_cycle_rows(rows: List[models.Player]) -> List[models.Player]:
    """
    Choose the most recent season cycle for a player and return all rows in that cycle.
    This keeps one visible profile per real player while preserving competition rows
    underneath the canonical profile.
    """
    best_base = max(rows, key=_candidate_row_score)
    return _related_rows_for_cycle(rows, best_base)


def _canonical_cycle_id(rows: List[models.Player]) -> int:
    return min(row.id for row in rows)


def _profile_rows_for_player(db: Session, player: models.Player) -> tuple[models.Player, list]:
    if not player.source_player_id:
        return player, [player]

    rows = (
        db.query(models.Player)
        .filter(models.Player.source_player_id == player.source_player_id)
        .all()
    )
    if not rows:
        return player, [player]

    best_base = max(rows, key=_candidate_row_score)
    cycle_rows = _related_rows_for_cycle(rows, best_base)
    cycle_rows = _replace_windowed_international_rows(db, cycle_rows, best_base.season)
    base_row = max(cycle_rows, key=_candidate_row_score)
    return base_row, cycle_rows or [best_base]


def _build_aggregate_ns(
    base: models.Player, rows: List[models.Player], canonical_id: Optional[int] = None
) -> types.SimpleNamespace:
    """
    Return a SimpleNamespace with aggregated stats/form across all competition rows.
    Does NOT mutate any ORM object — safe to call inside a live session.
    """
    sum_keys = (
        "appearances", "starts", "minutesPlayed", "goals", "assists", "shots",
        "shotsOnTarget", "keyPasses", "totalPasses", "dribbles", "tackles",
        "interceptions", "aerialDuelsWon", "yellowCards", "redCards",
        "touches", "accurateCrosses", "crosses", "finalThirdPasses", "throughPasses",
        "possessionLost", "dispossessed", "miscontrols", "recoveries", "successfulTackles",
        "fouls", "_accuratePasses", "_totalDribbles",
        "bigChancesCreated", "bigChancesMissed", "missedChances",
    )
    totals: dict = {k: 0 for k in sum_keys}
    totals["xG"] = 0.0
    totals["xA"] = 0.0

    weighted_rating_sum = 0.0
    weighted_rating_weight = 0
    all_form: list = []

    for row in rows:
        s = row.stats or {}
        for key in sum_keys:
            if key == "_totalDribbles":
                attempts = s.get("_totalDribbles", 0) or 0
                dribbles = s.get("dribbles", 0) or 0
                dribble_success = s.get("dribbleSuccess", 0) or 0
                if not attempts and dribbles and dribble_success:
                    attempts = round(dribbles / (dribble_success / 100))
                totals[key] += max(attempts, dribbles)
            else:
                totals[key] += s.get(key, 0) or 0
        totals["xG"] += s.get("xG", 0.0) or 0.0
        totals["xA"] += s.get("xA", 0.0) or 0.0

        rating = s.get("rating", 0.0) or 0.0
        apps = s.get("appearances", 0) or 0
        if rating and apps:
            weighted_rating_sum += rating * apps
            weighted_rating_weight += apps

        for form_item in row.form or []:
            tagged = dict(form_item)
            tagged["competition"] = row.league
            all_form.append(tagged)

    pass_accuracy = (
        totals["_accuratePasses"] / totals["totalPasses"] * 100
        if totals["totalPasses"] else 0.0
    )
    dribble_success = (
        totals["dribbles"] / totals["_totalDribbles"] * 100
        if totals["_totalDribbles"] else 0.0
    )
    cross_accuracy = (
        totals["accurateCrosses"] / totals["crosses"] * 100
        if totals["crosses"] else 0.0
    )
    avg_rating = (weighted_rating_sum / weighted_rating_weight) if weighted_rating_weight else 0.0

    agg_stats = {
        **totals,
        "passAccuracy":    round(pass_accuracy, 1),
        "dribbleSuccess":  round(dribble_success, 1),
        "crossAccuracy":   round(cross_accuracy, 1),
        "xG":              round(totals["xG"], 2),
        "xA":              round(totals["xA"], 2),
        "rating":          round(avg_rating, 1),
        "goalContributions": totals["goals"] + totals["assists"],
    }

    return types.SimpleNamespace(
        id=canonical_id or base.id,
        name=base.name,
        position=base.position,
        nationality=base.nationality,
        club=base.club,
        league="All Competitions",
        primary_league=base.league,
        age=base.age,
        season=base.season,
        stats=agg_stats,
        form=all_form[:5],
        photo_url=_player_photo_url(base),
        club_logo_url=_club_logo_url(base),
        flag_code=base.flag_code,
        source_player_id=base.source_player_id,
        source_team_id=base.source_team_id,
        source_league_id=base.source_league_id,
        source_season=base.source_season,
        last_synced_at=base.last_synced_at,
    )


def _recent_match_form_for_rows(db: Session, rows: List[models.Player]) -> list[dict]:
    source_ids = {row.source_player_id for row in rows if row.source_player_id}
    if not source_ids:
        return []

    league_names = {
        row.source_league_id: row.league
        for row in rows
        if row.source_league_id is not None
    }

    q = db.query(models.PlayerMatchStat).filter(
        models.PlayerMatchStat.source_player_id.in_(source_ids)
    )

    matches = (
        q.order_by(models.PlayerMatchStat.fixture_date.desc())
        .limit(5)
        .all()
    )

    return [
        {
            "match":       f"vs {m.opponent}" if m.opponent else "Recent Match",
            "rating":      float(m.rating or 0),
            "goals":       (m.stats or {}).get("goals", 0) or 0,
            "assists":     (m.stats or {}).get("assists", 0) or 0,
            "date":        (m.fixture_date or "")[:10],
            "competition": league_names.get(m.source_league_id),
        }
        for m in matches
    ]


def _estimated_form_for_player(player) -> list[dict]:
    stats = getattr(player, "stats", {}) or {}
    appearances = stats.get("appearances", 0) or 0
    if appearances <= 0:
        return []

    rating = stats.get("rating", 0) or 0
    if not rating:
        rating = 6.8

    goals = stats.get("goals", 0) or 0
    assists = stats.get("assists", 0) or 0
    samples = min(5, max(1, appearances))
    offsets = [-0.2, 0.1, -0.1, 0.2, 0.0]

    return [
        {
            "match":     f"Season avg {idx + 1}",
            "rating":    round(max(5, min(10, rating + offsets[idx])), 1),
            "goals":     1 if idx < min(goals, samples) else 0,
            "assists":   1 if idx < min(assists, samples) else 0,
            "date":      "",
            "estimated": True,
        }
        for idx in range(samples)
    ]


def _best_available_form(db: Session, aggregate, rows: List[models.Player]) -> list[dict]:
    match_form = _recent_match_form_for_rows(db, rows)
    if match_form:
        return match_form
    existing_form = [
        item
        for row in rows
        for item in (row.form or [])
    ][:5]
    if existing_form:
        return existing_form
    return _estimated_form_for_player(aggregate)


def _competition_stats(row: models.Player) -> dict:
    """Return the per-competition stats dict with goalContributions added."""
    s = row.stats or {}
    goals = s.get("goals", 0) or 0
    assists = s.get("assists", 0) or 0
    return {**s, "goalContributions": goals + assists}


def _competition_row_sort_key(row, base) -> tuple:
    season_key = _season_sort_key(getattr(row, "season", ""))
    reverse_season = tuple(-part for part in season_key)
    return (
        1 if _is_international_row(row) else 0,
        0 if getattr(row, "source_team_id", None) == getattr(base, "source_team_id", None) else 1,
        reverse_season,
        (getattr(row, "league", "") or "").casefold(),
    )


def _player_match_log(db: Session, player, rows: List[models.Player], limit: int = 30) -> list[dict]:
    if not getattr(player, "source_player_id", None):
        return []

    league_names = {
        row.source_league_id: _national_competition_label(row.source_league_id, row.league)
        for row in rows
        if getattr(row, "source_league_id", None) is not None
    }
    allowed_pairs = {
        (row.source_league_id, row.source_season)
        for row in rows
        if getattr(row, "source_league_id", None) is not None
    }

    matches = (
        db.query(models.PlayerMatchStat)
        .filter(models.PlayerMatchStat.source_player_id == player.source_player_id)
        .order_by(models.PlayerMatchStat.fixture_date.desc())
        .limit(max(1, min(limit, 80)))
        .all()
    )

    log_rows = []
    for match in matches:
        if allowed_pairs and (match.source_league_id, match.source_season) not in allowed_pairs:
            continue
        stats = dict(match.stats or {})
        rating = match.rating
        if rating is not None and not stats.get("rating"):
            try:
                stats["rating"] = round(float(rating), 1)
            except (TypeError, ValueError):
                stats["rating"] = rating
        has_complete_detail = _has_complete_match_log_detail(stats)
        if not has_complete_detail:
            continue
        log_rows.append({
            "fixture_id": match.fixture_id,
            "date": (match.fixture_date or "")[:10],
            "opponent": match.opponent,
            "competition": league_names.get(match.source_league_id) or _national_competition_label(match.source_league_id, ""),
            "has_detailed_stats": has_complete_detail,
            "rating": rating,
            "stats": stats,
        })
    return log_rows[:limit]


def _has_complete_match_log_detail(stats: dict) -> bool:
    required_keys = (
        "minutesPlayed",
        "rating",
        "xG",
        "xA",
        "bigChancesCreated",
        "touches",
        "totalPasses",
        "tackles",
    )
    return all((stats or {}).get(key) not in (None, "") for key in required_keys)


def _deduplicate_players(db: Session, rows: List[models.Player]) -> list:
    """
    Return one entry per real player.
    Players with a source_player_id that appears in multiple competition rows
    are collapsed into a single aggregated entry.
    Players without a source_player_id (seeded) are returned as-is.
    """
    grouped: dict[tuple, list[models.Player]] = {}
    for row in rows:
        grouped.setdefault(_player_identity_key(row), []).append(row)

    result: list = []
    for group_rows in grouped.values():
        best_base = max(group_rows, key=_candidate_row_score)
        cycle_rows = _related_rows_for_cycle(group_rows, best_base)
        cycle_rows = _replace_windowed_international_rows(db, cycle_rows, best_base.season)
        base_row = max(
            cycle_rows,
            key=_candidate_row_score,
        )
        if len(cycle_rows) > 1:
            aggregate = _build_aggregate_ns(
                base_row,
                cycle_rows,
                canonical_id=_canonical_cycle_id(cycle_rows),
            )
            aggregate.form = _best_available_form(db, aggregate, cycle_rows)
            result.append(aggregate)
        else:
            base_row.photo_url = _player_photo_url(base_row)
            base_row.club_logo_url = _club_logo_url(base_row)
            result.append(base_row)

    result = _merge_visible_duplicates(result)
    return sorted(
        result,
        key=lambda player: ((getattr(player, "name", "") or "").casefold(), getattr(player, "id", 0)),
    )


def get_player_profile(db: Session, player_id: int):
    player = get_player(db, player_id)
    if not player:
        return None

    base_row, rows = _profile_rows_for_player(db, player)
    aggregate = _build_aggregate_ns(base_row, rows, canonical_id=_canonical_cycle_id(rows))
    aggregate.form = _best_available_form(db, aggregate, rows)

    competitions = [
        {
            "id":          row.id,
            "competition": row.league,
            "club":        row.club,
            "season":      row.season,
            "stats":       _competition_stats(row),
        }
        for row in sorted(rows, key=lambda r: _competition_row_sort_key(r, base_row))
    ]
    aggregate.match_log = _player_match_log(db, base_row, rows)
    return aggregate, competitions


def needs_national_match_sync(db: Session, player_id: int, max_age_hours: int = 24) -> bool:
    player = get_player(db, player_id)
    if not player or not player.source_player_id or not _is_cross_year_season(player.season):
        return False

    rows = (
        db.query(models.Player)
        .filter(models.Player.source_player_id == player.source_player_id)
        .all()
    )
    national_rows = [
        row
        for row in rows
        if row.source_team_id and _is_international_row(row) and row.season != player.season
    ]
    if not national_rows:
        return False

    window = _season_window(player.season)
    if not window:
        return False
    start_date, end_date = window
    team_ids = {row.source_team_id for row in national_rows if row.source_team_id}

    for row in national_rows:
        filters = [
            models.PlayerMatchStat.source_player_id == player.source_player_id,
            models.PlayerMatchStat.source_team_id == row.source_team_id,
            models.PlayerMatchStat.fixture_date >= start_date.isoformat(),
            models.PlayerMatchStat.fixture_date <= end_date.isoformat(),
        ]
        if row.source_league_id:
            filters.append(models.PlayerMatchStat.source_league_id == row.source_league_id)

        exact_for_competition = (
            db.query(models.PlayerMatchStat)
            .filter(*filters)
            .first()
        )
        if not exact_for_competition:
            break
    else:
        return False

    state_key = f"national_match_sync:{player.source_player_id}:{player.season}"
    state = db.query(models.SyncState).filter(models.SyncState.key == state_key).first()
    last_attempt = _parse_datetime(state.updated_at) if state else None
    if last_attempt:
        age_seconds = (datetime.now(timezone.utc) - last_attempt.astimezone(timezone.utc)).total_seconds()
        if age_seconds < max_age_hours * 3600:
            return False

    return True


def needs_exact_defensive_sync(db: Session, player_id: int, max_age_hours: int = 24) -> bool:
    player = get_player(db, player_id)
    if not player or not player.source_player_id:
        return False

    rows = _related_competition_rows(db, player)
    aggregate = _build_aggregate_ns(player, rows, canonical_id=_canonical_cycle_id(rows))
    stats = aggregate.stats or {}
    if not (stats.get("minutesPlayed", 0) or 0):
        return False

    exact_total = (
        (stats.get("recoveries", 0) or 0)
        + (stats.get("successfulTackles", 0) or 0)
        + (stats.get("fouls", 0) or 0)
    )
    if exact_total > 0:
        return False

    state_key = f"exact_defensive_sync:{player.source_player_id}:{player.season}"
    state = db.query(models.SyncState).filter(models.SyncState.key == state_key).first()
    last_attempt = _parse_datetime(state.updated_at) if state else None
    if last_attempt:
        age_seconds = (datetime.now(timezone.utc) - last_attempt.astimezone(timezone.utc)).total_seconds()
        if age_seconds < max_age_hours * 3600:
            return False

    return True


def mark_exact_defensive_sync_attempt(db: Session, player_id: int):
    player = get_player(db, player_id)
    if not player or not player.source_player_id:
        return

    now = datetime.now(timezone.utc).isoformat()
    state_key = f"exact_defensive_sync:{player.source_player_id}:{player.season}"
    state = db.query(models.SyncState).filter(models.SyncState.key == state_key).first()
    if state:
        state.value = now
        state.updated_at = now
    else:
        db.add(models.SyncState(key=state_key, value=now, updated_at=now))
    db.commit()


def mark_national_match_sync_attempt(db: Session, player_id: int):
    player = get_player(db, player_id)
    if not player or not player.source_player_id:
        return

    now = datetime.now(timezone.utc).isoformat()
    state_key = f"national_match_sync:{player.source_player_id}:{player.season}"
    state = db.query(models.SyncState).filter(models.SyncState.key == state_key).first()
    if state:
        state.value = now
        state.updated_at = now
    else:
        db.add(models.SyncState(key=state_key, value=now, updated_at=now))
    db.commit()


def get_visible_player(db: Session, player_id: int):
    result = get_player_profile(db, player_id)
    if not result:
        return None
    aggregate, _competitions = result
    return aggregate


def get_world_cup_match_center(db: Session, limit: int = 12) -> list[dict]:
    rows = (
        db.query(models.PlayerMatchStat, models.Player)
        .join(
            models.Player,
            models.Player.source_player_id == models.PlayerMatchStat.source_player_id,
        )
        .filter(
            models.PlayerMatchStat.source_league_id == 16,
            models.PlayerMatchStat.source_season == 58210,
            models.Player.league == "FIFA World Cup",
            models.Player.season == "2026",
        )
        .order_by(models.PlayerMatchStat.fixture_date.desc())
        .all()
    )

    fixtures: dict[int, dict] = {}
    seen_player_rows: set[tuple[int, int]] = set()
    for match_row, player in rows:
        fixture_id = match_row.fixture_id
        if not fixture_id:
            continue

        fixture = fixtures.setdefault(
            fixture_id,
            {
                "fixture_id": fixture_id,
                "date": (match_row.fixture_date or "")[:10],
                "teams": {},
                "players": [],
            },
        )

        stats = dict(match_row.stats or {})
        player_stats = player.stats or {}
        if int(player_stats.get("appearances", 0) or 0) == 1:
            for key in (
                "goals",
                "assists",
                "shots",
                "shotsOnTarget",
                "keyPasses",
                "totalPasses",
                "touches",
                "possessionLost",
                "recoveries",
                "tackles",
                "interceptions",
                "rating",
            ):
                if player_stats.get(key) is not None:
                    stats[key] = player_stats.get(key)
        team_name = player.club or "Unknown"
        team = fixture["teams"].setdefault(
            team_name,
            {
                "name": team_name,
                "source_team_id": match_row.source_team_id,
                "goals": 0,
                "rows": 0,
            },
        )
        team["goals"] += int(stats.get("goals", 0) or 0)
        team["rows"] += 1

        player_key = (fixture_id, player.source_player_id or player.id)
        if player_key in seen_player_rows:
            continue
        seen_player_rows.add(player_key)
        fixture["players"].append(
            {
                "id": player.id,
                "name": player.name,
                "position": player.position,
                "club": player.club,
                "nationality": player.nationality,
                "photo_url": player.photo_url,
                "flag_code": player.flag_code,
                "source_player_id": player.source_player_id,
                "stats": stats,
            }
        )

    def impact(player: dict) -> float:
        stats = player.get("stats") or {}
        return (
            float(stats.get("rating", 0) or 0) * 10
            + float(stats.get("goals", 0) or 0) * 18
            + float(stats.get("assists", 0) or 0) * 12
            + float(stats.get("keyPasses", 0) or 0) * 2
            + float(stats.get("recoveries", 0) or 0) * 0.5
            + float(stats.get("interceptions", 0) or 0)
            - float(stats.get("possessionLost", 0) or 0) * 0.25
        )

    matches = []
    for fixture in fixtures.values():
        teams = sorted(fixture["teams"].values(), key=lambda item: item["name"])
        top_performers = sorted(fixture["players"], key=impact, reverse=True)[:3]
        matches.append(
            {
                "fixture_id": fixture["fixture_id"],
                "date": fixture["date"],
                "teams": teams,
                "top_performers": top_performers,
            }
        )

    return sorted(matches, key=lambda item: item["date"], reverse=True)[:limit]


def get_world_cup_fixtures(limit: int = 24) -> list[dict]:
    from fetcher import _flag_code, _get

    cache_key = f"world_cup_fixtures:{limit}"
    cached = _cache_get(cache_key, 60)
    if cached is not None:
        return cached

    events: dict[int, dict] = {}
    for endpoint in ("last", "next"):
        for page_idx in range(2):
            try:
                data = _get(f"/api/v1/unique-tournament/16/season/58210/events/{endpoint}/{page_idx}")
            except Exception:
                break
            for event in data.get("events", []):
                fixture = _world_cup_event_payload(event)
                if fixture:
                    events[fixture["fixture_id"]] = fixture

    def sort_key(item: dict):
        timestamp = item.get("timestamp") or 0
        is_today = item.get("date") == date.today().isoformat()
        status_rank = {"inprogress": 0, "notstarted": 1, "finished": 2}.get(item.get("status_type"), 3)
        time_sort = timestamp if item.get("status_type") != "finished" else -timestamp
        return (0 if is_today else 1, status_rank, time_sort)

    return _cache_set(cache_key, sorted(events.values(), key=sort_key)[:limit])


def _world_cup_team_payload(team: dict, score: Optional[dict]) -> dict:
    from fetcher import _flag_code

    return {
        "name": team.get("name") or team.get("shortName") or "TBD",
        "short_name": team.get("shortName") or team.get("name"),
        "source_team_id": team.get("id"),
        "flag_code": _flag_code(team.get("country") or {}),
        "score": (score or {}).get("current"),
    }


def _world_cup_event_payload(event: dict) -> Optional[dict]:
    fixture_id = event.get("id")
    if not fixture_id:
        return None
    status = event.get("status") or {}
    time_data = event.get("time") or {}
    timestamp = event.get("startTimestamp")
    group = (event.get("tournament") or {}).get("groupName") or (event.get("tournament") or {}).get("name")
    return {
        "fixture_id": fixture_id,
        "date": datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat() if timestamp else "",
        "timestamp": timestamp,
        "group": group,
        "status": status.get("description") or status.get("type") or "Scheduled",
        "status_type": status.get("type") or "notstarted",
        "minute": time_data.get("currentPeriodStartTimestamp"),
        "current_period_start_timestamp": time_data.get("currentPeriodStartTimestamp"),
        "current_minute": time_data.get("minute"),
        "home": _world_cup_team_payload(event.get("homeTeam") or {}, event.get("homeScore")),
        "away": _world_cup_team_payload(event.get("awayTeam") or {}, event.get("awayScore")),
    }


def _fixture_from_synced_match(match: dict) -> Optional[dict]:
    teams = match.get("teams") or []
    if len(teams) < 2:
        return None
    return {
        "fixture_id": match["fixture_id"],
        "date": match.get("date") or "",
        "timestamp": None,
        "group": "World Cup",
        "status": "Synced",
        "status_type": "finished",
        "minute": None,
        "home": {
            "name": teams[0].get("name") or "TBD",
            "short_name": teams[0].get("name") or "TBD",
            "source_team_id": teams[0].get("source_team_id"),
            "flag_code": None,
            "score": teams[0].get("goals", 0),
        },
        "away": {
            "name": teams[1].get("name") or "TBD",
            "short_name": teams[1].get("name") or "TBD",
            "source_team_id": teams[1].get("source_team_id"),
            "flag_code": None,
            "score": teams[1].get("goals", 0),
        },
    }


def _world_cup_fixture_stats(fixture_id: int, force: bool = False) -> list[dict]:
    from fetcher import _get

    cache_key = f"world_cup_stats:{fixture_id}"
    cached = None if force else _cache_get(cache_key, 60)
    if cached is not None:
        return cached

    data = _get(f"/api/v1/event/{fixture_id}/statistics")
    rows: list[dict] = []
    for period_block in data.get("statistics", []):
        period = period_block.get("period")
        for group in period_block.get("groups", []):
            group_name = group.get("groupName") or group.get("name")
            for item in group.get("statisticsItems", []):
                name = item.get("name") or item.get("key")
                if not name:
                    continue
                rows.append(
                    {
                        "key": item.get("key"),
                        "name": name,
                        "group": group_name,
                        "period": period,
                        "home": item.get("home") if item.get("home") is not None else item.get("homeValue"),
                        "away": item.get("away") if item.get("away") is not None else item.get("awayValue"),
                        "home_raw": item.get("homeValue"),
                        "away_raw": item.get("awayValue"),
                    }
                )
    return _cache_set(cache_key, rows)


def _world_cup_incidents(fixture_id: int, force: bool = False) -> list:
    from fetcher import _get
    cache_key = f"world_cup_incidents:{fixture_id}"
    cached = None if force else _cache_get(cache_key, 20)
    if cached is not None:
        return cached

    try:
        data = _get(f"/api/v1/event/{fixture_id}/incidents")
    except Exception:
        return []

    raw = data.get("incidents", [])
    incidents = []
    for inc in raw:
        inc_type = inc.get("incidentType", "")
        inc_class = inc.get("incidentClass", "")
        time_val = inc.get("time", 0)
        added_time = inc.get("addedTime", 0)
        player = inc.get("player") or {}
        player2 = inc.get("playerIn") or {}
        is_home = inc.get("isHome", True)

        if inc_type == "goal":
            incidents.append({
                "type": "goal",
                "subtype": inc_class,  # "regular", "penalty", "ownGoal"
                "minute": time_val,
                "added_time": added_time,
                "player": player.get("name", ""),
                "player_id": player.get("id"),
                "assist": (inc.get("assist1") or {}).get("name", ""),
                "assist_id": (inc.get("assist1") or {}).get("id"),
                "is_home": is_home,
                "description": inc.get("description", ""),
            })
        elif inc_type == "card":
            incidents.append({
                "type": "card",
                "subtype": inc_class,  # "yellow", "red", "yellowRed"
                "minute": time_val,
                "added_time": added_time,
                "player": player.get("name", ""),
                "player_id": player.get("id"),
                "is_home": is_home,
                "reason": inc.get("reason", ""),
            })
        elif inc_type == "substitution":
            incidents.append({
                "type": "substitution",
                "minute": time_val,
                "added_time": added_time,
                "player_out": player.get("name", ""),
                "player_out_id": player.get("id"),
                "player_in": player2.get("name", ""),
                "player_in_id": player2.get("id"),
                "is_home": is_home,
            })
        elif inc_type in ("varDecision", "var"):
            incidents.append({
                "type": "var",
                "subtype": inc_class,
                "minute": time_val,
                "added_time": added_time,
                "description": inc.get("description", ""),
                "is_home": is_home,
            })
        elif inc_type in ("corner", "cornerKick"):
            incidents.append({
                "type": "corner",
                "subtype": inc_class,
                "minute": time_val,
                "added_time": added_time,
                "description": inc.get("description", ""),
                "is_home": is_home,
            })
        elif inc_type == "injuryTime":
            incidents.append({
                "type": "injury_time",
                "minute": time_val,
                "added_time": inc.get("length", added_time),
            })
        elif inc_type == "period":
            incidents.append({
                "type": "period",
                "subtype": inc_class,
                "minute": time_val,
            })

    return _cache_set(cache_key, incidents)


def _world_cup_lineups(db: Session, fixture_id: int) -> Optional[dict]:
    from fetcher import _get

    cache_key = f"world_cup_lineups_raw:{fixture_id}"
    data = _cache_get(cache_key, 10 * 60)
    if data is None:
        data = _cache_set(cache_key, _get(f"/api/v1/event/{fixture_id}/lineups"))
    player_ids: set[int] = set()
    for side_key in ("home", "away"):
        for entry in ((data.get(side_key) or {}).get("players") or []):
            player_info = entry.get("player") or {}
            if player_info.get("id"):
                player_ids.add(int(player_info["id"]))

    existing_players = {}
    if player_ids:
        for player in (
            db.query(models.Player)
            .filter(
                models.Player.source_player_id.in_(player_ids),
                models.Player.league == "FIFA World Cup",
                models.Player.season == "2026",
            )
            .all()
        ):
            existing_players[player.source_player_id] = player

    def player_payload(entry: dict) -> dict:
        player_info = entry.get("player") or {}
        stats = entry.get("statistics") or {}
        source_player_id = player_info.get("id")
        local_player = existing_players.get(source_player_id)
        return {
            "id": local_player.id if local_player else None,
            "source_player_id": source_player_id,
            "name": player_info.get("name") or player_info.get("shortName") or "Unknown",
            "short_name": player_info.get("shortName") or player_info.get("name") or "Unknown",
            "position": entry.get("position") or player_info.get("position") or "",
            "shirt_number": entry.get("shirtNumber") or entry.get("jerseyNumber") or player_info.get("jerseyNumber"),
            "substitute": bool(entry.get("substitute")),
            "captain": bool(entry.get("captain")),
            "rating": stats.get("rating"),
            "goals": stats.get("goals") or stats.get("goal") or 0,
            "assists": stats.get("assists") or stats.get("goalAssist") or 0,
            "minutes": stats.get("minutesPlayed") or stats.get("minutes"),
        }

    def side_payload(side_key: str) -> dict:
        side = data.get(side_key) or {}
        players = [player_payload(entry) for entry in side.get("players", [])]
        starters = [player for player in players if not player.get("substitute")]
        bench = [player for player in players if player.get("substitute")]
        return {
            "formation": side.get("formation"),
            "starters": starters,
            "bench": bench,
        }

    return {
        "confirmed": bool(data.get("confirmed")),
        "home": side_payload("home"),
        "away": side_payload("away"),
    }


def _fixture_stats_payload(player, fixture_id: int, match) -> dict:
    stats = dict(match.stats or {})
    rating = match.rating
    if rating is not None and not stats.get("rating"):
        try:
            stats["rating"] = round(float(rating), 1)
        except (TypeError, ValueError):
            stats["rating"] = rating

    return {
        "player_id": player.id,
        "source_player_id": player.source_player_id,
        "fixture_id": fixture_id,
        "fixture_date": match.fixture_date,
        "opponent": match.opponent,
        "competition": _national_competition_label(match.source_league_id, player.league),
        "rating": rating,
        "stats": stats,
    }


def _has_fixture_detail(stats: dict) -> bool:
    keys = (
        "minutesPlayed",
        "goals",
        "assists",
        "shots",
        "shotsOnTarget",
        "keyPasses",
        "totalPasses",
        "touches",
        "dribbles",
        "recoveries",
        "tackles",
        "interceptions",
        "xG",
        "xA",
        "saves",
        "goalsConceded",
        "totalShotsFaced",
        "rating",
    )
    return any((stats or {}).get(key) not in (None, "", 0, 0.0) for key in keys)


def _live_world_cup_fixture_stats(db: Session, player, fixture_id: int) -> Optional[dict]:
    from fetcher import _get, _lineup_stats_from_block, _position, _score_value

    lineups_cache_key = f"world_cup_lineups_raw:{fixture_id}"
    data = _cache_get(lineups_cache_key, 10 * 60)
    if data is None:
        data = _cache_set(lineups_cache_key, _get(f"/api/v1/event/{fixture_id}/lineups"))

    event = {}
    event_cache_key = f"world_cup_event:{fixture_id}"
    event_data = _cache_get(event_cache_key, 60)
    if event_data is None:
        try:
            event_data = _cache_set(event_cache_key, _get(f"/api/v1/event/{fixture_id}"))
        except Exception:
            event_data = {}
    if isinstance(event_data, dict):
        event = event_data.get("event") or event_data

    home_score = _score_value(event.get("homeScore"))
    away_score = _score_value(event.get("awayScore"))
    fixture_date = ""
    timestamp = event.get("startTimestamp")
    if timestamp:
        fixture_date = datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat()

    for side_key in ("home", "away"):
        side = data.get(side_key) or {}
        opponent_key = "away" if side_key == "home" else "home"
        opponent = ((event.get(f"{opponent_key}Team") or {}).get("name"))
        goals_conceded = away_score if side_key == "home" else home_score
        for entry in side.get("players", []) or []:
            player_info = entry.get("player") or {}
            if str(player_info.get("id")) != str(player.source_player_id):
                continue

            stats_block = entry.get("statistics") or {}
            position = _position(entry.get("position") or player_info.get("position"))
            stats = _lineup_stats_from_block(
                stats_block,
                substitute=bool(entry.get("substitute")),
                position=position,
                goals_conceded=goals_conceded if position == "GK" else None,
            )
            return {
                "player_id": player.id,
                "source_player_id": player.source_player_id,
                "fixture_id": fixture_id,
                "fixture_date": fixture_date,
                "opponent": opponent,
                "competition": "FIFA World Cup",
                "rating": stats.get("rating"),
                "stats": stats,
            }

    return None


def _fixture_positional_data(source_player_id: int, fixture_id: int) -> dict:
    """Real per-match positional data from the provider: the player's heatmap
    points and their shots (with pitch coordinates, type and minute)."""
    from fetcher import _get

    cache_key = f"fixture_positional:{fixture_id}:{source_player_id}"
    cached = _cache_get(cache_key, 10 * 60)
    if cached is not None:
        return cached

    heatmap: list[dict] = []
    shots: list[dict] = []
    try:
        hm = _get(f"/api/v1/event/{fixture_id}/player/{source_player_id}/heatmap")
        heatmap = [
            {"x": p.get("x"), "y": p.get("y")}
            for p in (hm.get("heatmap") or [])
            if p.get("x") is not None and p.get("y") is not None
        ]
    except Exception:
        heatmap = []

    try:
        sm = _get(f"/api/v1/event/{fixture_id}/shotmap")
        for shot in (sm.get("shotmap") or []):
            if (shot.get("player") or {}).get("id") != source_player_id:
                continue
            coords = shot.get("playerCoordinates") or {}
            mouth = shot.get("goalMouthCoordinates") or {}
            shots.append({
                "x": coords.get("x"),
                "y": coords.get("y"),
                "type": shot.get("shotType"),       # goal | save | miss | block | post
                "xg": shot.get("xg"),
                "xgot": shot.get("xgot"),
                "minute": shot.get("time"),
                "body_part": shot.get("bodyPart"),
                "situation": shot.get("situation"),
                # Where the shot crossed the goal line (y = across goal, z = height).
                "goal_mouth": {"y": mouth.get("y"), "z": mouth.get("z")} if mouth else None,
            })
    except Exception:
        shots = []

    # Full-match incidents (goals & cards, both teams) for match context.
    incidents = []
    motm_rating = 0.0
    try:
        inc = _get(f"/api/v1/event/{fixture_id}/incidents")
        for item in (inc.get("incidents") or []):
            itype = item.get("incidentType")
            if itype not in ("goal", "card", "substitution"):
                continue
            incidents.append({
                "minute": item.get("time"),
                "added_time": item.get("addedTime"),
                "type": itype,
                "subtype": item.get("incidentClass"),
                "is_home": bool(item.get("isHome", True)),
                "player": (item.get("player") or {}).get("id"),
                "assist": (item.get("assist1") or {}).get("id") if itype == "goal" else None,
                "player_in": (item.get("playerIn") or {}).get("id") if itype == "substitution" else None,
                "player_out": (item.get("playerOut") or {}).get("id") if itype == "substitution" else None,
            })
    except Exception:
        incidents = []

    try:
        ln = _get(f"/api/v1/event/{fixture_id}/lineups")
        for side in ("home", "away"):
            for p in ((ln.get(side) or {}).get("players") or []):
                r = ((p.get("statistics") or {}).get("rating"))
                if r is not None:
                    motm_rating = max(motm_rating, float(r))
    except Exception:
        motm_rating = 0.0

    # Richer per-player stats not stored in our rollup (duels, long balls, blocks…).
    extra = {}
    try:
        st = (_get(f"/api/v1/event/{fixture_id}/player/{source_player_id}/statistics") or {}).get("statistics") or {}
        duel_won = st.get("duelWon")
        duel_lost = st.get("duelLost")
        aerial_won = st.get("aerialWon")
        if st.get("keyPass") is not None:
            extra["keyPasses"] = st.get("keyPass")
        if st.get("accuratePass") is not None:
            extra["_accuratePasses"] = st.get("accuratePass")
            extra["totalPasses"] = st.get("totalPass")
            if st.get("totalPass"):
                extra["passAccuracy"] = round((st.get("accuratePass") / st.get("totalPass")) * 100, 1)
        if st.get("accurateLongBalls") is not None:
            extra["accurateLongBalls"] = st.get("accurateLongBalls")
            extra["longBalls"] = st.get("totalLongBalls")
        if st.get("outfielderBlock") is not None:
            extra["blocks"] = st.get("outfielderBlock")
        if st.get("expectedAssists") is not None:
            extra["xA"] = st.get("expectedAssists")
        if st.get("keyPass") is not None:
            extra["chancesCreated"] = st.get("keyPass")
        if st.get("bigChanceCreated") is not None:
            extra["bigChancesCreated"] = st.get("bigChanceCreated")
        if st.get("bigChanceMissed") is not None:
            extra["bigChancesMissed"] = st.get("bigChanceMissed")
        if st.get("wasFouled") is not None:
            extra["foulsSuffered"] = st.get("wasFouled")
        if st.get("ballCarriesCount") is not None:
            extra["carries"] = st.get("ballCarriesCount")
        if st.get("progressiveBallCarriesCount") is not None:
            extra["progressiveCarries"] = st.get("progressiveBallCarriesCount")
        if aerial_won is not None:
            extra["aerialDuelsWon"] = aerial_won
        if duel_won is not None and duel_lost is not None:
            extra["duelsWon"] = duel_won
            extra["duelsTotal"] = duel_won + duel_lost
            extra["groundDuelsWon"] = max(0, duel_won - (aerial_won or 0))
            total = duel_won + duel_lost
            extra["duelSuccess"] = round((duel_won / total) * 100) if total else None
    except Exception:
        extra = {}

    # Event meta for the header: scoreline, venue, opponent crest.
    event_meta = {}
    try:
        ev = (_get(f"/api/v1/event/{fixture_id}") or {}).get("event") or {}
        home = ev.get("homeTeam") or {}
        away = ev.get("awayTeam") or {}
        event_meta = {
            "home_name": home.get("name"),
            "away_name": away.get("name"),
            "home_crest": f"/api/media/team/{home.get('id')}/image" if home.get("id") else None,
            "away_crest": f"/api/media/team/{away.get('id')}/image" if away.get("id") else None,
            "home_score": (ev.get("homeScore") or {}).get("current"),
            "away_score": (ev.get("awayScore") or {}).get("current"),
            "venue": ((ev.get("venue") or {}).get("stadium") or {}).get("name"),
        }
    except Exception:
        event_meta = {}

    return _cache_set(cache_key, {
        "heatmap": heatmap,
        "shots": shots,
        "incidents": incidents,
        "motm_rating": motm_rating,
        "extra_stats": extra,
        "event_meta": event_meta,
    })


def get_player_fixture_stats(db: Session, player_id: int, fixture_id: int) -> Optional[dict]:
    player = get_player(db, player_id)
    if not player or not player.source_player_id:
        return None

    match = (
        db.query(models.PlayerMatchStat)
        .filter(
            models.PlayerMatchStat.fixture_id == fixture_id,
            models.PlayerMatchStat.source_player_id == player.source_player_id,
        )
        .first()
    )

    def _with_positional(payload):
        if not payload:
            return payload
        positional = _fixture_positional_data(player.source_player_id, fixture_id)
        payload.setdefault("heatmap", positional.get("heatmap", []))
        payload.setdefault("shots", positional.get("shots", []))
        payload.setdefault("match_incidents", positional.get("incidents", []))
        payload["event_meta"] = positional.get("event_meta", {})
        # Fill in richer stats we don't store, without overwriting good values.
        merged = dict(payload.get("stats") or {})
        for k, v in (positional.get("extra_stats") or {}).items():
            if v is not None and not merged.get(k):
                merged[k] = v
        payload["stats"] = merged
        rating = payload.get("rating") or (payload.get("stats") or {}).get("rating")
        motm = positional.get("motm_rating") or 0
        try:
            payload["is_motm"] = bool(rating) and float(rating) >= motm > 0
        except (TypeError, ValueError):
            payload["is_motm"] = False
        return payload

    if match and _has_fixture_detail(match.stats or {}):
        return _with_positional(_fixture_stats_payload(player, fixture_id, match))

    try:
        live_stats = _live_world_cup_fixture_stats(db, player, fixture_id)
    except Exception:
        live_stats = None
    if live_stats:
        return _with_positional(live_stats)

    if match:
        return _with_positional(_fixture_stats_payload(player, fixture_id, match))
    return None


def get_world_cup_match_detail(db: Session, fixture_id: int, force: bool = False) -> Optional[dict]:
    from fetcher import _get

    detail_cache_key = f"world_cup_match_detail:{fixture_id}"
    cached_item = None if force else _WORLD_CUP_PROVIDER_CACHE.get(detail_cache_key)
    if cached_item:
        created_at, cached_detail = cached_item
        cached_status = ((cached_detail or {}).get("fixture") or {}).get("status_type")
        ttl = 20 if cached_status == "inprogress" else 10 * 60
        if time.time() - created_at < ttl:
            return cached_detail

    synced_match = next(
        (match for match in get_world_cup_match_center(db, limit=80) if match.get("fixture_id") == fixture_id),
        None,
    )

    fixture = None
    try:
        event_cache_key = f"world_cup_event:{fixture_id}"
        event_data = None if force else _cache_get(event_cache_key, 60)
        if event_data is None:
            event_data = _cache_set(event_cache_key, _get(f"/api/v1/event/{fixture_id}"))
        event = event_data.get("event") or event_data
        fixture = _world_cup_event_payload(event)
    except Exception:
        fixture = None

    if not fixture:
        try:
            fixture = next((item for item in get_world_cup_fixtures(limit=80) if item.get("fixture_id") == fixture_id), None)
        except Exception:
            fixture = None

    if not fixture and synced_match:
        fixture = _fixture_from_synced_match(synced_match)

    if not fixture:
        return None

    stats = []
    try:
        stats = _world_cup_fixture_stats(fixture_id, force=force and fixture.get("status_type") == "inprogress")
    except Exception:
        stats = []

    lineups = None
    try:
        lineups = _world_cup_lineups(db, fixture_id)
    except Exception:
        lineups = None

    incidents = []
    try:
        if fixture.get("status_type") in ("inprogress", "finished"):
            incidents = _world_cup_incidents(fixture_id, force=force and fixture.get("status_type") == "inprogress")
    except Exception:
        incidents = []

    shotmap = []
    try:
        if fixture.get("status_type") in ("inprogress", "finished"):
            sm = _get(f"/api/v1/event/{fixture_id}/shotmap")
            for shot in (sm.get("shotmap") or []):
                coords = shot.get("playerCoordinates") or {}
                shotmap.append({
                    "x": coords.get("x"),
                    "y": coords.get("y"),
                    "is_home": bool(shot.get("isHome", True)),
                    "type": shot.get("shotType"),
                    "xg": shot.get("xg"),
                    "minute": shot.get("time"),
                    "player": (shot.get("player") or {}).get("name"),
                })
    except Exception:
        shotmap = []

    momentum = []
    try:
        if fixture.get("status_type") in ("inprogress", "finished"):
            g = _get(f"/api/v1/event/{fixture_id}/graph")
            momentum = [
                {"minute": p.get("minute"), "value": p.get("value")}
                for p in (g.get("graphPoints") or [])
                if p.get("minute") is not None and p.get("value") is not None
            ]
    except Exception:
        momentum = []

    return _cache_set(detail_cache_key, {
        "fixture": fixture,
        "synced_match": synced_match,
        "stats": stats,
        "lineups": lineups,
        "incidents": incidents,
        "shotmap": shotmap,
        "momentum": momentum,
    })


def get_players(
    db: Session,
    league:   Optional[str] = None,
    group:    Optional[str] = None,
    team:     Optional[str] = None,
    position: Optional[str] = None,
    position_group: Optional[str] = None,
    season:   Optional[str] = None,
    min_apps: int = 0,
    min_starts: Optional[int] = None,
    min_minutes: int = 0,
    max_age: Optional[int] = None,
    sort: Optional[str] = None,
    limit:    int = 800,
    offset:   int = 0,
) -> list:
    q = db.query(models.Player)
    group_leagues = {
        "leagues": (
            "Premier League",
            "La Liga",
            "Bundesliga",
            "Serie A",
            "Ligue 1",
            "FA Cup",
            "EFL Cup",
            "DFB Pokal",
            "Copa del Rey",
            "Coppa Italia",
            "Coupe de France",
        ),
        "europe": ("UEFA Champions League", "UEFA Europa League", "UEFA Conference League"),
        "mls": ("MLS",),
        "national": (
            "International Friendlies",
            "UEFA Nations League",
            "CONCACAF Nations League",
            "CONCACAF Gold Cup",
            "Copa América",
            "FIFA World Cup",
            "World Cup Qual. CONMEBOL",
            "World Cup Qual. UEFA",
            "World Cup Qual. CONCACAF",
        ),
    }
    position_groups = {
        "gk": ("GK",),
        "defenders": ("CB", "LB", "RB"),
        "midfielders": ("CDM", "CM", "CAM"),
        "attackers": ("LW", "RW", "ST"),
    }
    if league:
        q = q.filter(models.Player.league == league)
    elif group == "world_cup_2026":
        q = q.filter(models.Player.league.in_(WORLD_CUP_2026_LEAGUES))
        q = q.filter(
            or_(
                models.Player.club.in_(WORLD_CUP_2026_TEAM_ALIASES),
                models.Player.nationality.in_(WORLD_CUP_2026_TEAM_ALIASES),
            )
        )
    elif group in group_leagues:
        q = q.filter(models.Player.league.in_(group_leagues[group]))
    if team:
        q = q.filter(models.Player.club == team)
    if position:
        q = q.filter(models.Player.position == position)
    elif position_group in position_groups:
        q = q.filter(models.Player.position.in_(position_groups[position_group]))
    if season:
        season_values = _season_filter_values(season)
        q = q.filter(models.Player.season.in_(season_values))
    if max_age is not None:
        q = q.filter(models.Player.age <= max_age)

    rows = q.all()

    def stat_value(player: models.Player, key: str, default: float = 0.0) -> float:
        raw = (player.stats or {}).get(key, default)
        try:
            return float(raw or 0)
        except (TypeError, ValueError):
            return default

    start_threshold = min_starts if min_starts is not None else min_apps
    if start_threshold:
        rows = [
            player
            for player in rows
            if stat_value(player, "starts", stat_value(player, "appearances")) >= start_threshold
        ]
    if min_minutes:
        rows = [player for player in rows if stat_value(player, "minutesPlayed") >= min_minutes]

    def sort_value(player: models.Player) -> float:
        stats = player.stats or {}
        sort_key = (sort or "rating").lower()
        if sort_key == "goals":
            return stat_value(player, "goals")
        if sort_key == "assists":
            return stat_value(player, "assists")
        if sort_key == "xg":
            return stat_value(player, "xG")
        if sort_key == "xa":
            return stat_value(player, "xA")
        if sort_key == "chances":
            return stat_value(player, "chancesCreated", stat_value(player, "keyPasses"))
        if sort_key == "defending":
            return (
                stat_value(player, "tackles")
                + stat_value(player, "successfulTackles")
                + stat_value(player, "interceptions")
                + stat_value(player, "recoveries") * 0.5
                + stat_value(player, "aerialDuelsWon") * 0.5
            )
        if sort_key in {"goal_contributions", "contributions"}:
            return stat_value(player, "goalContributions", stat_value(player, "goals") + stat_value(player, "assists"))
        return stat_value(player, "rating")

    rows = sorted(rows, key=lambda player: (sort_value(player), player.id), reverse=True)
    start = max(offset, 0)
    end = start + max(min(limit, 2000), 1)
    sliced = rows[start:end]

    # When filtering by a specific league, return those exact rows without
    # cross-competition aggregation — otherwise club stats bleed into WC results etc.
    if league:
        for row in sliced:
            row.photo_url = _player_photo_url(row)
            row.club_logo_url = _club_logo_url(row)
        return sliced

    return _deduplicate_players(db, sliced)


def search_players(db: Session, query: str, limit: int = 20) -> list:
    norm_q = _normalize_text(query.strip())
    if not norm_q:
        return []

    candidate_rows = (
        db.query(
            models.Player.id,
            models.Player.name,
            models.Player.club,
            models.Player.source_player_id,
        )
        .all()
    )

    scored = []
    for row in candidate_rows:
        norm_name = _normalize_text(row.name or "")
        norm_club = _normalize_text(row.club or "")
        if norm_name.startswith(norm_q):
            rank = 0
        elif norm_q in norm_name:
            rank = 1
        elif norm_club.startswith(norm_q):
            rank = 2
        elif norm_q in norm_club:
            rank = 3
        else:
            continue
        scored.append((rank, norm_name, norm_club, row.id, row.source_player_id))

    scored.sort(key=lambda item: (item[0], item[1], item[2], item[3]))

    source_ids: list[int] = []
    row_ids: list[int] = []
    seen_keys = set()
    max_candidates = max(1, min(limit, 50))
    prefetch_candidates = min(max_candidates * 8, 150)
    for _, _, _, row_id, source_player_id in scored:
        key = ("source", source_player_id) if source_player_id is not None else ("row", row_id)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        if source_player_id is not None:
            source_ids.append(source_player_id)
        else:
            row_ids.append(row_id)
        if len(seen_keys) >= prefetch_candidates:
            break

    if not source_ids and not row_ids:
        return []

    filters = []
    if source_ids:
        filters.append(models.Player.source_player_id.in_(source_ids))
    if row_ids:
        filters.append(models.Player.id.in_(row_ids))

    rows = db.query(models.Player).filter(or_(*filters)).all()
    results = _deduplicate_players(db, rows)

    def result_rank(player) -> tuple:
        norm_name = _normalize_text(getattr(player, "name", "") or "")
        norm_club = _normalize_text(getattr(player, "club", "") or "")
        stats = getattr(player, "stats", {}) or {}
        if norm_name.startswith(norm_q):
            rank = 0
        elif norm_q in norm_name:
            rank = 1
        elif norm_club.startswith(norm_q):
            rank = 2
        else:
            rank = 3
        minutes = stats.get("minutesPlayed", 0) or 0
        apps = stats.get("appearances", 0) or 0
        return (rank, -minutes, -apps, norm_name, getattr(player, "id", 0))

    return sorted(results, key=result_rank)[:max_candidates]


def create_player(db: Session, player: schemas.PlayerCreate) -> models.Player:
    db_player = models.Player(**player.model_dump())
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player


def player_count(db: Session) -> int:
    return db.query(models.Player).count()


def get_teams(
    db: Session,
    league: Optional[str] = None,
    season: Optional[str] = None,
) -> List[models.Team]:
    q = db.query(models.Team)
    if league:
        q = q.filter(models.Team.league == league)
    if season:
        q = q.filter(models.Team.season == season)
    return q.order_by(models.Team.league, models.Team.name).all()
