import os
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

import crud
import schemas
from database import get_db
from auto_sync import maybe_sync_world_cup, maybe_sync_incremental

router = APIRouter(prefix="/players", tags=["players"])
log = logging.getLogger(__name__)


# /search must be declared before /{player_id} to avoid path conflicts
@router.get("/search", response_model=List[schemas.PlayerOut])
def search_players(
    q: str = Query(..., min_length=1, description="Search by name or club"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    # Searching is a strong signal someone's about to look at players — keep
    # data fresh (throttled + non-blocking). World Cup refreshes often; the
    # general incremental refresh covers every other competition.
    maybe_sync_world_cup()
    maybe_sync_incremental()
    return crud.search_players(db, q, limit=limit)


@router.get("/", response_model=List[schemas.PlayerOut])
def list_players(
    league:   Optional[str] = Query(None),
    group:    Optional[str] = Query(None),
    team:     Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    position_group: Optional[str] = Query(None),
    season:   Optional[str] = Query(None),
    min_apps: int = Query(0, ge=0),
    min_starts: Optional[int] = Query(None, ge=0),
    min_minutes: int = Query(0, ge=0),
    max_age: Optional[int] = Query(None, ge=0),
    sort:     Optional[str] = Query(None),
    limit:    int = Query(800, ge=1, le=2000),
    offset:   int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    # Keep data fresh on its own: World Cup pages refresh often, every other
    # section (Dashboard, Scouting Board, Compare, …) gets the slower general
    # refresh. Both are throttled and non-blocking.
    if league == "FIFA World Cup" or group == "world_cup_2026":
        maybe_sync_world_cup()
    else:
        maybe_sync_incremental()
    return crud.get_players(
        db,
        league=league,
        group=group,
        team=team,
        position=position,
        position_group=position_group,
        season=season,
        min_apps=min_apps,
        min_starts=min_starts,
        min_minutes=min_minutes,
        max_age=max_age,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get("/world-cup/matches", response_model=List[schemas.MatchCenterMatch])
def world_cup_matches(
    limit: int = Query(12, ge=1, le=40),
    db: Session = Depends(get_db),
):
    matches = crud.get_world_cup_match_center(db, limit=limit)
    live = any(
        str((m or {}).get("status_type", "")).lower() == "inprogress" for m in matches
    )
    maybe_sync_world_cup(live=live)
    return matches


@router.get("/world-cup/fixtures", response_model=List[schemas.WorldCupFixture])
def world_cup_fixtures(
    limit: int = Query(24, ge=1, le=80),
):
    return crud.get_world_cup_fixtures(limit=limit)


@router.get("/world-cup/matches/{fixture_id}", response_model=schemas.WorldCupMatchDetail)
def world_cup_match_detail(
    fixture_id: int,
    force: bool = Query(False),
    db: Session = Depends(get_db),
):
    result = crud.get_world_cup_match_detail(db, fixture_id, force=force)
    if not result:
        raise HTTPException(status_code=404, detail="World Cup match not found")
    live = str(((result.get("fixture") or {}).get("status_type")) or "").lower() == "inprogress"
    maybe_sync_world_cup(live=live)
    return result


@router.post("/{player_id}/sync-form")
def sync_player_form(
    player_id: int,
    max_matches: int = Query(80, ge=5, le=120),
    db: Session = Depends(get_db),
):
    if not os.getenv("RAPIDAPI_KEY"):
        raise HTTPException(
            status_code=400,
            detail="RAPIDAPI_KEY is not set. Add it to backend/.env and restart the server.",
        )

    from fetcher import sync_player_recent_form

    result = sync_player_recent_form(player_id, db=db, max_matches=max_matches)
    if result.get("error") == "Player not found":
        raise HTTPException(status_code=404, detail="Player not found")
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{player_id}/sync-defensive")
def sync_player_defensive(
    player_id: int,
    max_matches: int = Query(30, ge=1, le=80),
    db: Session = Depends(get_db),
):
    if not os.getenv("RAPIDAPI_KEY"):
        raise HTTPException(
            status_code=400,
            detail="RAPIDAPI_KEY is not set. Add it to backend/.env and restart the server.",
        )

    from fetcher import sync_player_defensive_from_match_lineups

    result = sync_player_defensive_from_match_lineups(player_id, db=db, max_matches=max_matches)
    if result.get("error") == "Player not found":
        raise HTTPException(status_code=404, detail="Player not found")
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/{player_id}/matches/{fixture_id}", response_model=schemas.PlayerFixtureStats)
def get_player_fixture_stats(
    player_id: int,
    fixture_id: int,
    db: Session = Depends(get_db),
):
    result = crud.get_player_fixture_stats(db, player_id, fixture_id)
    if not result:
        raise HTTPException(status_code=404, detail="Match stats not found for this player")
    return result


@router.get("/{player_id}", response_model=schemas.PlayerProfileOut)
def get_player(player_id: int, db: Session = Depends(get_db)):
    if os.getenv("RAPIDAPI_KEY") and crud.needs_national_match_sync(db, player_id):
        from fetcher import sync_player_recent_form

        try:
            sync_player_recent_form(player_id, db=db, max_matches=120)
        except Exception as exc:
            log.warning("National match sync failed for player %s: %s", player_id, exc)
        finally:
            crud.mark_national_match_sync_attempt(db, player_id)

    result = crud.get_player_profile(db, player_id)
    if not result:
        raise HTTPException(status_code=404, detail="Player not found")
    aggregate, competitions = result
    # Keep this player's data fresh on view (throttled + non-blocking).
    # World Cup players refresh often; everyone else gets the general refresh.
    # sync_pending tells the client to re-fetch shortly so this view picks up
    # the freshly synced numbers.
    if any((c.get("competition") == "FIFA World Cup") for c in competitions):
        sync_pending = maybe_sync_world_cup()
    else:
        sync_pending = maybe_sync_incremental()
    # aggregate.league is already "All Competitions" from _build_aggregate_ns
    payload = schemas.PlayerProfileOut.model_validate(aggregate, from_attributes=True).model_dump()
    payload["competitions"] = competitions
    payload["selected_competition"] = "All Competitions"
    payload["sync_pending"] = sync_pending
    return payload
