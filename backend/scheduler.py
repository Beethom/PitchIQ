"""
APScheduler background jobs for PitchIQ syncs.
Attached to the FastAPI lifespan so they start/stop with the server.
"""
import logging
import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

log = logging.getLogger(__name__)

_scheduler = None  # type: Optional[BackgroundScheduler]


def _incremental_sync_job():
    import os
    from fetcher import sync_recent

    if not os.getenv("RAPIDAPI_KEY"):
        log.warning("Scheduled incremental sync skipped — API key not set.")
        return

    log.info("Scheduled incremental sync starting…")
    try:
        result = sync_recent()
        log.info("Scheduled incremental sync complete — %s", result)
    except Exception as e:
        log.error("Scheduled incremental sync failed: %s", e)


def _world_cup_sync_job():
    from fetcher import sync_recent

    if not os.getenv("RAPIDAPI_KEY"):
        return

    log.info("Scheduled World Cup sync starting…")
    try:
        result = sync_recent(competitions=["FIFA World Cup"])
        log.info("Scheduled World Cup sync complete — %s", result)
    except Exception as e:
        log.error("Scheduled World Cup sync failed: %s", e)


def _full_sync_job():
    import os
    from fetcher import sync_full

    if not os.getenv("RAPIDAPI_KEY"):
        log.warning("Scheduled full sync skipped — API key not set.")
        return

    log.info("Scheduled full sync starting…")
    try:
        result = sync_full()
        log.info("Scheduled full sync complete — %s", result)
    except Exception as e:
        log.error("Scheduled full sync failed: %s", e)


def start_scheduler():
    global _scheduler
    if os.getenv("ENABLE_SCHEDULER", "0") != "1":
        log.info("Scheduler disabled — set ENABLE_SCHEDULER=1 to enable background sync jobs.")
        return None

    _scheduler = BackgroundScheduler(timezone="UTC")

    _scheduler.add_job(
        _incremental_sync_job,
        trigger=CronTrigger(hour=4, minute=0),
        id="daily_incremental_sync",
        name="Daily incremental player sync",
        replace_existing=True,
    )

    _scheduler.add_job(
        _full_sync_job,
        trigger=CronTrigger(day_of_week="mon", hour=3, minute=0),
        id="weekly_full_sync",
        name="Weekly full player sync",
        replace_existing=True,
    )

    wc_minutes = int(os.getenv("WORLD_CUP_SYNC_MINUTES", "15"))
    _scheduler.add_job(
        _world_cup_sync_job,
        trigger=IntervalTrigger(minutes=wc_minutes),
        id="world_cup_sync",
        name="Frequent World Cup sync",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    _scheduler.start()
    log.info(
        "Scheduler started — World Cup every %s min, daily incremental 04:00 UTC, weekly full Monday 03:00 UTC",
        wc_minutes,
    )
    return _scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("Scheduler stopped.")


def get_scheduler():
    return _scheduler
