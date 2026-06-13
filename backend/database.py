from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

SQLALCHEMY_DATABASE_URL = "sqlite:///./pitchiq.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def ensure_schema(base_model):
    base_model.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    columns = {col["name"] for col in inspector.get_columns("players")}
    wanted = {
        "source_player_id": "INTEGER",
        "source_team_id": "INTEGER",
        "source_league_id": "INTEGER",
        "source_season": "INTEGER",
        "last_synced_at": "TEXT",
    }

    with engine.begin() as conn:
        for name, sql_type in wanted.items():
            if name not in columns:
                conn.execute(text(f"ALTER TABLE players ADD COLUMN {name} {sql_type}"))

        # Partial unique index: one row per (player, competition, season).
        # WHERE clause excludes seeded rows that have NULL source IDs.
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_player_competition_season
            ON players (source_player_id, source_league_id, season)
            WHERE source_player_id IS NOT NULL
        """))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
