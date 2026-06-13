"""
backfill_possession.py

Fetches team possession % for every synced fixture and stores it in
PlayerMatchStat.stats["teamPossession"]. Then re-aggregates each affected
player's season stats so defensiveIntensity is computed correctly.

Cost: 2 API calls per fixture (event info + statistics).
Run once from the backend directory with the venv active:
    python backfill_possession.py [--dry-run] [--limit N]
"""
import argparse
import time
import sys

def run(dry_run=False, limit=None):
    from database import SessionLocal
    from models import Player, PlayerMatchStat, SyncedFixture
    from fetcher import _get, _safe_int, _round1, _finalize_aggregate_stats, _base_stats, _add_match_stats, LEAGUES

    db = SessionLocal()

    try:
        fixtures = db.query(SyncedFixture).order_by(SyncedFixture.fixture_date.desc()).all()
        if limit:
            fixtures = fixtures[:limit]

        print(f"Processing {len(fixtures)} fixtures {'[DRY RUN]' if dry_run else ''}...")

        updated_fixtures = 0
        skipped = 0
        affected_players = set()

        for i, sf in enumerate(fixtures, 1):
            fid = sf.fixture_id
            try:
                # 1. Get home/away team IDs
                event_data = _get(f"/api/v1/event/{fid}")
                event = event_data.get("event", {})
                home_team_id = _safe_int((event.get("homeTeam") or {}).get("id"))
                away_team_id = _safe_int((event.get("awayTeam") or {}).get("id"))

                if not home_team_id or not away_team_id:
                    skipped += 1
                    continue

                # 2. Get possession stats
                stat_data = _get(f"/api/v1/event/{fid}/statistics")
                home_poss, away_poss = 0, 0
                for group in stat_data.get("statistics", []):
                    if group.get("period") != "ALL":
                        continue
                    for g in group.get("groups", []):
                        for s in g.get("statisticsItems", []):
                            if s.get("key") == "ballPossession":
                                home_poss = _safe_int(s.get("homeValue"))
                                away_poss = _safe_int(s.get("awayValue"))

                if not home_poss and not away_poss:
                    skipped += 1
                    continue

                # 3. Update PlayerMatchStat rows for this fixture
                rows = db.query(PlayerMatchStat).filter(
                    PlayerMatchStat.fixture_id == fid
                ).all()

                for row in rows:
                    team_id = row.source_team_id
                    if team_id == home_team_id:
                        poss = home_poss
                    elif team_id == away_team_id:
                        poss = away_poss
                    else:
                        continue

                    if not dry_run:
                        stats = dict(row.stats or {})
                        stats["teamPossession"] = poss
                        row.stats = stats
                        affected_players.add(row.source_player_id)

                updated_fixtures += 1
                if i % 50 == 0:
                    print(f"  [{i}/{len(fixtures)}] {updated_fixtures} updated, {skipped} skipped...")
                    if not dry_run:
                        db.commit()

            except Exception as exc:
                print(f"  Fixture {fid} failed: {exc}")
                skipped += 1
                time.sleep(1)

        if not dry_run:
            db.commit()

        print(f"\nFixtures updated: {updated_fixtures}, skipped: {skipped}")
        print(f"Affected players: {len(affected_players)}")

        if dry_run or not affected_players:
            return

        # 4. Re-aggregate player stats for affected players
        print("\nRe-aggregating player stats...")
        league_by_sid = {l["season_id"]: l for l in LEAGUES}
        players = db.query(Player).filter(
            Player.source_player_id.in_(affected_players)
        ).all()

        reaggregated = 0
        for player in players:
            match_rows = (
                db.query(PlayerMatchStat)
                .filter(PlayerMatchStat.source_player_id == player.source_player_id)
                .all()
            )
            if not match_rows:
                continue

            # Group by season and re-aggregate per competition row
            # Simplest: rebuild avgTeamPossession from all match rows for this player
            mins_with_poss = 0
            poss_sum = 0.0
            for row in match_rows:
                s = row.stats or {}
                mins = _safe_int(s.get("minutesPlayed"))
                poss = s.get("teamPossession")
                if mins and poss:
                    mins_with_poss += mins
                    poss_sum += poss * mins

            avg_poss = _round1(poss_sum / mins_with_poss) if mins_with_poss else None

            # Update player.stats with avgTeamPossession
            stats = dict(player.stats or {})
            if avg_poss is not None:
                stats["avgTeamPossession"] = avg_poss
                player.stats = stats
                reaggregated += 1

        db.commit()
        print(f"Re-aggregated {reaggregated} players.")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    run(dry_run=args.dry_run, limit=args.limit)
