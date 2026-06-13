"""
Admin endpoints — manual data sync trigger.
In production you would protect these with an API key or JWT.
"""
import os
import logging
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from database import SessionLocal
import models

log = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


class SyncStatus(BaseModel):
    status:  str
    message: str
    players: int = 0
    fixtures: int = 0
    mode: str = "incremental"
    competitions: list[str] = []


class SyncRequest(BaseModel):
    competitions: list[str] = []
    dry_run: bool = False


class NationalMatchBackfillRequest(BaseModel):
    limit: int = 25
    max_matches: int = 120
    force: bool = False


_sync_running = False
_last_sync_result: dict = {}
_active_sync: dict = {}


def _utc_now():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _record_job_start(mode: str, competitions: list[str], dry_run: bool) -> int:
    db = SessionLocal()
    try:
        job = models.SyncJob(
            mode=mode,
            competitions=competitions,
            dry_run=1 if dry_run else 0,
            status="running",
            players=0,
            fixtures=0,
            pages=0,
            error=None,
            started_at=_utc_now(),
            finished_at=None,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job.id
    finally:
        db.close()


def _record_job_finish(job_id: int, result: dict):
    db = SessionLocal()
    try:
        job = db.query(models.SyncJob).filter(models.SyncJob.id == job_id).first()
        if not job:
            return
        job.status = "failed" if result.get("error") else "completed"
        job.players = result.get("players", 0)
        job.fixtures = result.get("fixtures", 0)
        job.pages = result.get("pages", 0)
        job.error = result.get("error")
        job.finished_at = _utc_now()
        db.commit()
    finally:
        db.close()


def _do_sync(mode: str, competitions: list[str], dry_run: bool, job_id: int):
    global _sync_running
    global _last_sync_result
    global _active_sync
    _sync_running = True
    _active_sync = {"mode": mode, "competitions": competitions, "dry_run": dry_run, "job_id": job_id}
    try:
        from fetcher import sync_full, sync_recent

        if mode == "full":
            result = sync_full(dry_run=dry_run, competitions=competitions)
        else:
            result = sync_recent(dry_run=dry_run, competitions=competitions)

        _last_sync_result = result
        log.info("Manual %s sync complete — %s", mode, result)
    except Exception as e:
        _last_sync_result = {"mode": mode, "players": 0, "fixtures": 0, "competitions": competitions, "error": str(e)}
        log.error("Manual %s sync failed: %s", mode, e)
    finally:
        _record_job_finish(job_id, _last_sync_result)
        _sync_running = False
        _active_sync = {}


def _do_national_match_backfill(limit: int, max_matches: int, force: bool, job_id: int):
    global _sync_running
    global _last_sync_result
    global _active_sync
    _sync_running = True
    _active_sync = {
        "mode": "national_match_backfill",
        "competitions": ["National team match logs"],
        "dry_run": False,
        "job_id": job_id,
    }
    try:
        from fetcher import sync_missing_national_match_logs

        result = sync_missing_national_match_logs(
            limit=limit,
            max_matches=max_matches,
            force=force,
        )
        _last_sync_result = result
        log.info("National match backfill complete — %s", result)
    except Exception as e:
        _last_sync_result = {
            "mode": "national_match_backfill",
            "players": 0,
            "fixtures": 0,
            "competitions": ["National team match logs"],
            "error": str(e),
        }
        log.error("National match backfill failed: %s", e)
    finally:
        _record_job_finish(job_id, _last_sync_result)
        _sync_running = False
        _active_sync = {}


@router.post("/sync", response_model=SyncStatus)
def trigger_sync(payload: SyncRequest, background_tasks: BackgroundTasks):
    """
    Manually trigger an incremental sync using recently completed fixtures.
    Runs in the background — returns immediately.
    Check /api/admin/sync/status to monitor progress.
    """
    global _sync_running

    if not os.getenv("RAPIDAPI_KEY"):
        raise HTTPException(
            status_code=400,
            detail=(
                "RAPIDAPI_KEY is not set. "
                "Add it to backend/.env and restart the server."
            ),
        )

    if _sync_running:
        return SyncStatus(status="running", message="Sync already in progress.", mode="incremental", competitions=payload.competitions)

    job_id = _record_job_start("incremental", payload.competitions, payload.dry_run)
    background_tasks.add_task(_do_sync, "incremental", payload.competitions, payload.dry_run, job_id)
    message = "Incremental sync started in background."
    if payload.competitions:
        message = f"Incremental sync started for {', '.join(payload.competitions)}."
    return SyncStatus(status="started", message=message, mode="incremental", competitions=payload.competitions)


@router.post("/sync/national-matches", response_model=SyncStatus)
def trigger_national_match_backfill(payload: NationalMatchBackfillRequest, background_tasks: BackgroundTasks):
    """
    Backfill exact player-events logs for player profiles that still rely on
    fallback national-team season rows.
    """
    global _sync_running

    if not os.getenv("RAPIDAPI_KEY"):
        raise HTTPException(
            status_code=400,
            detail=(
                "RAPIDAPI_KEY is not set. "
                "Add it to backend/.env and restart the server."
            ),
        )

    if _sync_running:
        return SyncStatus(
            status="running",
            message="Sync already in progress.",
            mode="national_match_backfill",
            competitions=["National team match logs"],
        )

    limit = max(1, min(payload.limit, 250))
    max_matches = max(20, min(payload.max_matches, 120))
    job_id = _record_job_start("national_match_backfill", ["National team match logs"], False)
    background_tasks.add_task(_do_national_match_backfill, limit, max_matches, payload.force, job_id)
    return SyncStatus(
        status="started",
        message=f"National match backfill started for up to {limit} players.",
        mode="national_match_backfill",
        competitions=["National team match logs"],
    )


@router.post("/sync/full", response_model=SyncStatus)
def trigger_full_sync(payload: SyncRequest, background_tasks: BackgroundTasks):
    """
    Manually trigger a full league+season bootstrap sync.
    This is much more expensive than the incremental fixture refresh.
    """
    global _sync_running

    if not os.getenv("RAPIDAPI_KEY"):
        raise HTTPException(
            status_code=400,
            detail=(
                "RAPIDAPI_KEY is not set. "
                "Add it to backend/.env and restart the server."
            ),
        )

    if _sync_running:
        return SyncStatus(status="running", message="Sync already in progress.", mode="full", competitions=payload.competitions)

    job_id = _record_job_start("full", payload.competitions, payload.dry_run)
    background_tasks.add_task(_do_sync, "full", payload.competitions, payload.dry_run, job_id)
    message = "Full sync started in background."
    if payload.competitions:
        message = f"Full sync started for {', '.join(payload.competitions)}."
    return SyncStatus(status="started", message=message, mode="full", competitions=payload.competitions)


@router.get("/sync/status", response_model=SyncStatus)
def sync_status():
    """Check whether a sync is currently running."""
    if _sync_running:
        return SyncStatus(
            status="running",
            message="Sync is in progress…",
            mode=_active_sync.get("mode", "incremental"),
            competitions=_active_sync.get("competitions", []),
        )
    if _last_sync_result:
        return SyncStatus(
            status="idle",
            message="No sync running.",
            mode=_last_sync_result.get("mode", "incremental"),
            players=_last_sync_result.get("players", 0),
            fixtures=_last_sync_result.get("fixtures", 0),
            competitions=_last_sync_result.get("competitions", []),
        )
    return SyncStatus(status="idle", message="No sync running.")


@router.get("/scheduler", tags=["admin"])
def scheduler_info():
    """Return next scheduled sync time."""
    from scheduler import get_scheduler
    sched = get_scheduler()
    if not sched:
        return {"status": "not started"}

    jobs = []
    for job in sched.get_jobs():
        jobs.append({
            "id":       job.id,
            "name":     job.name,
            "next_run": str(job.next_run_time),
        })
    return {"status": "running", "jobs": jobs}


@router.get("/coverage", tags=["admin"])
def coverage_inventory():
    db = SessionLocal()
    try:
        from fetcher import LEAGUES
        rows = (
            db.query(models.CompetitionSyncState)
            .order_by(models.CompetitionSyncState.competition_name, models.CompetitionSyncState.season)
            .all()
        )
        by_key = {
            (row.competition_name, row.season): row
            for row in rows
        }
        payload = []
        seen = set()
        for league in LEAGUES:
            key = (league["name"], league.get("season_label"))
            seen.add(key)
            row = by_key.get(key)
            player_rows = (
                db.query(models.Player)
                .filter(
                    models.Player.league == league["name"],
                    models.Player.season == league.get("season_label"),
                )
                .count()
            )
            team_rows = (
                db.query(models.Team)
                .filter(
                    models.Team.league == league["name"],
                    models.Team.season == league.get("season_label"),
                )
                .count()
            )
            payload.append({
                "competition": league["name"],
                "season": league.get("season_label"),
                "player_rows": row.player_rows if row else player_rows,
                "team_rows": row.team_rows if row else team_rows,
                "synced_fixtures": row.synced_fixtures if row else 0,
                "last_full_sync_at": row.last_full_sync_at if row else None,
                "last_recent_sync_at": row.last_recent_sync_at if row else None,
                "last_sync_status": row.last_sync_status if row else None,
                "last_error": row.last_error if row else None,
            })

        for row in rows:
            key = (row.competition_name, row.season)
            if key in seen:
                continue
            payload.append({
                "competition": row.competition_name,
                "season": row.season,
                "player_rows": row.player_rows,
                "team_rows": row.team_rows,
                "synced_fixtures": row.synced_fixtures,
                "last_full_sync_at": row.last_full_sync_at,
                "last_recent_sync_at": row.last_recent_sync_at,
                "last_sync_status": row.last_sync_status,
                "last_error": row.last_error,
            })
        return {
            "competitions": payload
        }
    finally:
        db.close()


@router.get("/backfills/missing", tags=["admin"])
def missing_backfills():
    db = SessionLocal()
    try:
        from fetcher import LEAGUES

        rows = db.query(models.CompetitionSyncState).all()
        by_key = {
            (row.competition_name, row.season): row
            for row in rows
        }
        missing = []
        for league in LEAGUES:
            key = (league["name"], league.get("season_label"))
            row = by_key.get(key)
            player_rows = (
                row.player_rows if row else db.query(models.Player)
                .filter(
                    models.Player.league == league["name"],
                    models.Player.season == league.get("season_label"),
                )
                .count()
            )
            if player_rows == 0:
                missing.append({
                    "competition": league["name"],
                    "season": league.get("season_label"),
                    "last_sync_status": row.last_sync_status if row else None,
                    "last_error": row.last_error if row else None,
                })
        return {
            "missing": missing
        }
    finally:
        db.close()


@router.get("/sync/jobs", tags=["admin"])
def sync_jobs(limit: int = 20):
    db = SessionLocal()
    try:
        rows = (
            db.query(models.SyncJob)
            .order_by(models.SyncJob.id.desc())
            .limit(limit)
            .all()
        )
        return {
            "jobs": [
                {
                    "id": row.id,
                    "mode": row.mode,
                    "competitions": row.competitions,
                    "dry_run": bool(row.dry_run),
                    "status": row.status,
                    "players": row.players,
                    "fixtures": row.fixtures,
                    "pages": row.pages,
                    "error": row.error,
                    "started_at": row.started_at,
                    "finished_at": row.finished_at,
                }
                for row in rows
            ]
        }
    finally:
        db.close()
