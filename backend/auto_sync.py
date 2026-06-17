"""
Opportunistic background sync for live data.

Instead of relying solely on a cron scheduler (which doesn't fire reliably on
hosts that sleep when idle), we refresh World Cup data on demand: whenever a
World Cup page is requested and the data is older than a short threshold, we
kick off a non-blocking background sync. The triggering request returns
immediately with whatever is in the DB; the next request sees fresh data.
"""
import logging
import os
import threading
import time

log = logging.getLogger(__name__)

# Minimum seconds between automatic World Cup syncs.
WORLD_CUP_SYNC_INTERVAL = int(os.getenv("WORLD_CUP_AUTO_SYNC_SECONDS", "600"))
# Shorter interval while a match is live so leaderboards keep up with play.
WORLD_CUP_LIVE_SYNC_INTERVAL = int(os.getenv("WORLD_CUP_LIVE_SYNC_SECONDS", "180"))

# General (all-competitions) refresh runs far less often — club/league stats
# change at most daily, so we don't need to hammer the provider.
INCREMENTAL_SYNC_INTERVAL = int(os.getenv("INCREMENTAL_AUTO_SYNC_SECONDS", str(3 * 3600)))

# Each "channel" tracks its own throttle/in-flight state so a slow full sync
# never blocks the fast World Cup refresh and vice versa.
_state = {
    "world_cup": {"lock": threading.Lock(), "last": 0.0, "in_flight": False},
    "incremental": {"lock": threading.Lock(), "last": 0.0, "in_flight": False},
}


def _run_sync(channel: str, label: str, competitions):
    st = _state[channel]
    try:
        from fetcher import sync_recent

        log.info("Auto-sync: %s refresh starting…", label)
        result = sync_recent(competitions=competitions)
        log.info("Auto-sync: %s refresh complete — %s", label, result)
    except Exception as exc:  # pragma: no cover - best effort
        log.warning("Auto-sync: %s refresh failed: %s", label, exc)
    finally:
        with st["lock"]:
            st["last"] = time.time()
            st["in_flight"] = False


def _maybe_sync(channel: str, label: str, interval: int, competitions) -> bool:
    if not os.getenv("RAPIDAPI_KEY"):
        return False

    st = _state[channel]
    now = time.time()
    with st["lock"]:
        if st["in_flight"]:
            return False
        if now - st["last"] < interval:
            return False
        # Reserve the slot up front so concurrent requests don't pile on.
        st["in_flight"] = True
        st["last"] = now

    threading.Thread(
        target=_run_sync,
        args=(channel, label, competitions),
        name=f"{channel}-auto-sync",
        daemon=True,
    ).start()
    return True


def maybe_sync_world_cup(live: bool = False) -> bool:
    """Trigger a background World Cup sync if the data is stale.

    Returns True if a sync was started, False otherwise. Never blocks the
    caller — the actual sync runs on a daemon thread.
    """
    interval = WORLD_CUP_LIVE_SYNC_INTERVAL if live else WORLD_CUP_SYNC_INTERVAL
    return _maybe_sync("world_cup", "World Cup", interval, ["FIFA World Cup"])


def maybe_sync_incremental() -> bool:
    """Trigger a background all-competitions sync if the data is stale.

    Used by the general (non-World-Cup) sections so club/league data stays
    current too. Never blocks the caller.
    """
    return _maybe_sync("incremental", "incremental", INCREMENTAL_SYNC_INTERVAL, None)
