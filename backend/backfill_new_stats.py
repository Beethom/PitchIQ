"""
backfill_new_stats.py

Re-syncs competitions that have players with missing new stat fields
(saves, totalShotsFaced, punches, runOuts, highClaims, bigChancesCreated,
bigChancesMissed, missedChances, clearances).

Run from the backend directory with the venv active:
    python backfill_new_stats.py [--dry-run] [--competition "Premier League"]

Options:
    --dry-run          Print what would be synced without writing to DB
    --competition X    Only backfill a single competition (can repeat)
    --position GK      Only check a specific position (default: GK)
    --all              Backfill all competitions regardless of missing stats
"""
import argparse
import sys
import time

NEW_FIELDS = ("saves", "totalShotsFaced", "punches", "runOuts", "highClaims",
              "bigChancesCreated", "bigChancesMissed", "missedChances", "clearances")


def find_competitions_needing_backfill(db, position_filter=None):
    from models import Player
    q = db.query(Player.league, Player.season).distinct()
    if position_filter:
        q = q.filter(Player.position == position_filter)
    all_comps = q.all()

    needing = []
    for row in all_comps:
        players = (
            db.query(Player)
            .filter(Player.league == row.league, Player.season == row.season)
        )
        if position_filter:
            players = players.filter(Player.position == position_filter)
        players = players.all()
        missing_count = sum(
            1 for p in players
            if any(p.stats.get(f) is None for f in NEW_FIELDS)
        )
        if missing_count:
            needing.append({
                "league": row.league,
                "season": row.season,
                "missing": missing_count,
                "total": len(players),
            })

    return needing


def run_backfill(competitions_filter=None, dry_run=False, position_filter="GK", backfill_all=False):
    from database import SessionLocal
    from fetcher import sync_full

    db = SessionLocal()
    try:
        if backfill_all:
            from models import Player
            rows = db.query(Player.league).distinct().all()
            to_sync = [{"league": r.league} for r in rows]
            print(f"Backfilling all {len(to_sync)} competitions.")
        else:
            print(f"Scanning for {position_filter or 'all'} players missing new stat fields…")
            to_sync = find_competitions_needing_backfill(db, position_filter)

            if not to_sync:
                print("Nothing to backfill — all players already have new stat fields.")
                return

            print(f"\nFound {len(to_sync)} competition(s) to backfill:\n")
            for item in to_sync:
                print(f"  {item['league']} {item['season']} — {item['missing']}/{item['total']} players missing fields")
    finally:
        db.close()

    # Apply filter if provided
    if competitions_filter:
        norm = {c.strip().casefold() for c in competitions_filter}
        to_sync = [c for c in to_sync if c["league"].casefold() in norm]
        if not to_sync:
            print("\nNo matching competitions found for the given filter.")
            return

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Starting backfill for {len(to_sync)} competition(s)…\n")

    total_updated = 0
    for i, item in enumerate(to_sync, 1):
        league = item["league"]
        print(f"[{i}/{len(to_sync)}] Syncing {league}…", end=" ", flush=True)
        try:
            result = sync_full(dry_run=dry_run, competitions=[league])
            updated = result.get("players", 0)
            total_updated += updated
            print(f"✓ {updated} player rows written")
        except Exception as exc:
            print(f"✗ FAILED: {exc}")
        # Small pause between competitions to respect rate limits
        if i < len(to_sync):
            time.sleep(1)

    print(f"\nBackfill complete — {total_updated} player rows updated across {len(to_sync)} competition(s).")

    if not dry_run:
        print("\nVerifying…")
        db = SessionLocal()
        try:
            from models import Player
            q = db.query(Player)
            if position_filter:
                q = q.filter(Player.position == position_filter)
            remaining = sum(
                1 for p in q.all()
                if any(p.stats.get(f) is None for f in NEW_FIELDS)
            )
            if remaining:
                print(f"  ⚠  {remaining} player(s) still missing fields (may be in competitions not covered by this run).")
            else:
                print("  ✓ All players now have new stat fields.")
        finally:
            db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill new stat fields for all players.")
    parser.add_argument("--dry-run", action="store_true", help="Scan and report without writing to DB")
    parser.add_argument("--competition", action="append", dest="competitions", metavar="NAME",
                        help="Limit to specific competition(s) — repeat for multiple")
    parser.add_argument("--position", default="GK", metavar="POS",
                        help="Position to check for missing fields (default: GK, use '' for all)")
    parser.add_argument("--all", dest="backfill_all", action="store_true",
                        help="Backfill all competitions regardless of missing stats")
    args = parser.parse_args()

    run_backfill(
        competitions_filter=args.competitions,
        dry_run=args.dry_run,
        position_filter=args.position if args.position else None,
        backfill_all=args.backfill_all,
    )
