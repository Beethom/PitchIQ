from sqlalchemy import Column, Integer, String, JSON, UniqueConstraint
from database import Base


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("source_team_id", "season", name="uq_team_source_team_season"),
    )

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String,  nullable=False, index=True)
    league         = Column(String,  nullable=False, index=True)
    season         = Column(String,  nullable=False, index=True)
    logo_url       = Column(String,  nullable=True)
    source_team_id = Column(Integer, nullable=True, index=True)
    source_league_id = Column(Integer, nullable=True, index=True)
    source_season    = Column(Integer, nullable=True, index=True)
    last_synced_at   = Column(String,  nullable=True)


class Player(Base):
    __tablename__ = "players"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String,  nullable=False, index=True)
    position      = Column(String,  nullable=False, index=True)
    nationality   = Column(String,  nullable=False)
    club          = Column(String,  nullable=False)
    league        = Column(String,  nullable=False, index=True)
    age           = Column(Integer, nullable=False)
    season        = Column(String,  nullable=False, index=True)
    stats         = Column(JSON,    nullable=False)
    form          = Column(JSON,    nullable=False)
    photo_url     = Column(String,  nullable=True)
    club_logo_url = Column(String,  nullable=True)
    flag_code     = Column(String,  nullable=True)
    source_player_id = Column(Integer, nullable=True, index=True)
    source_team_id   = Column(Integer, nullable=True, index=True)
    source_league_id = Column(Integer, nullable=True, index=True)
    source_season    = Column(Integer, nullable=True, index=True)
    last_synced_at   = Column(String,  nullable=True)


class PlayerMatchStat(Base):
    __tablename__ = "player_match_stats"
    __table_args__ = (
        UniqueConstraint("fixture_id", "source_player_id", name="uq_fixture_player"),
    )

    id               = Column(Integer, primary_key=True, index=True)
    fixture_id       = Column(Integer, nullable=False, index=True)
    source_player_id = Column(Integer, nullable=False, index=True)
    source_team_id   = Column(Integer, nullable=True, index=True)
    source_league_id = Column(Integer, nullable=True, index=True)
    source_season    = Column(Integer, nullable=True, index=True)
    fixture_date     = Column(String,  nullable=False, index=True)
    opponent         = Column(String,  nullable=True)
    rating           = Column(String,  nullable=True)
    stats            = Column(JSON,    nullable=False)


class SyncedFixture(Base):
    __tablename__ = "synced_fixtures"

    fixture_id     = Column(Integer, primary_key=True, index=True)
    source_league_id = Column(Integer, nullable=True, index=True)
    source_season    = Column(Integer, nullable=True, index=True)
    fixture_date     = Column(String,  nullable=False, index=True)
    synced_at        = Column(String,  nullable=False)


class SyncState(Base):
    __tablename__ = "sync_state"

    key        = Column(String, primary_key=True, index=True)
    value      = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class CompetitionSyncState(Base):
    __tablename__ = "competition_sync_state"
    __table_args__ = (
        UniqueConstraint("competition_name", "season", name="uq_competition_sync_competition_season"),
    )

    id                  = Column(Integer, primary_key=True, index=True)
    competition_name    = Column(String, nullable=False, index=True)
    season              = Column(String, nullable=False, index=True)
    source_league_id    = Column(Integer, nullable=True, index=True)
    source_season       = Column(Integer, nullable=True, index=True)
    player_rows         = Column(Integer, nullable=False, default=0)
    team_rows           = Column(Integer, nullable=False, default=0)
    synced_fixtures     = Column(Integer, nullable=False, default=0)
    last_full_sync_at   = Column(String, nullable=True)
    last_recent_sync_at = Column(String, nullable=True)
    last_sync_status    = Column(String, nullable=True)
    last_error          = Column(String, nullable=True)


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id            = Column(Integer, primary_key=True, index=True)
    mode          = Column(String, nullable=False, index=True)
    competitions  = Column(JSON, nullable=False)
    dry_run       = Column(Integer, nullable=False, default=0)
    status        = Column(String, nullable=False, index=True)
    players       = Column(Integer, nullable=False, default=0)
    fixtures      = Column(Integer, nullable=False, default=0)
    pages         = Column(Integer, nullable=False, default=0)
    error         = Column(String, nullable=True)
    started_at    = Column(String, nullable=False)
    finished_at   = Column(String, nullable=True)
