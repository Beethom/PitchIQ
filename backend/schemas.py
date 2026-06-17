from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class TeamBase(BaseModel):
    name: str
    league: str
    season: str
    logo_url: Optional[str] = None


class TeamOut(TeamBase):
    id: int

    model_config = {"from_attributes": True}


class PlayerBase(BaseModel):
    name:          str
    position:      str
    nationality:   str
    club:          str
    league:        str
    primary_league: Optional[str] = None
    age:           int
    season:        str
    stats:         Dict[str, Any]
    form:          List[Dict[str, Any]]
    photo_url:     Optional[str] = None
    club_logo_url: Optional[str] = None
    flag_code:     Optional[str] = None
    source_player_id: Optional[int] = None
    source_team_id:   Optional[int] = None
    last_synced_at: Optional[str] = None


class PlayerCreate(PlayerBase):
    pass


class PlayerOut(PlayerBase):
    id: int

    model_config = {"from_attributes": True}


class CompetitionBreakdown(BaseModel):
    id: int
    competition: str
    club: str
    season: str
    stats: Dict[str, Any]


class PlayerMatchLogItem(BaseModel):
    fixture_id: int
    date: str
    opponent: Optional[str] = None
    competition: Optional[str] = None
    has_detailed_stats: bool = False
    stats: Dict[str, Any]
    rating: Optional[Any] = None


class PlayerProfileOut(PlayerOut):
    competitions: List[CompetitionBreakdown] = []
    match_log: List[PlayerMatchLogItem] = []
    selected_competition: Optional[str] = None
    sync_pending: bool = False


class PlayerFixtureStats(BaseModel):
    player_id: int
    source_player_id: Optional[int] = None
    fixture_id: int
    fixture_date: Optional[str] = None
    opponent: Optional[str] = None
    competition: Optional[str] = None
    rating: Optional[Any] = None
    stats: Dict[str, Any]
    heatmap: List[Dict[str, Any]] = []
    shots: List[Dict[str, Any]] = []
    match_incidents: List[Dict[str, Any]] = []
    is_motm: bool = False
    event_meta: Dict[str, Any] = {}


class CompareOut(BaseModel):
    playerA: PlayerOut
    playerB: PlayerOut


class MatchCenterPlayer(BaseModel):
    id: Optional[int] = None
    name: str
    position: str
    club: str
    nationality: str
    photo_url: Optional[str] = None
    flag_code: Optional[str] = None
    source_player_id: Optional[int] = None
    stats: Dict[str, Any]


class MatchCenterTeam(BaseModel):
    name: str
    source_team_id: Optional[int] = None
    goals: int = 0
    rows: int = 0


class MatchCenterMatch(BaseModel):
    fixture_id: int
    date: str
    teams: List[MatchCenterTeam]
    top_performers: List[MatchCenterPlayer]


class WorldCupFixtureTeam(BaseModel):
    name: str
    short_name: Optional[str] = None
    source_team_id: Optional[int] = None
    flag_code: Optional[str] = None
    score: Optional[int] = None


class WorldCupFixture(BaseModel):
    fixture_id: int
    date: str
    timestamp: Optional[int] = None
    group: Optional[str] = None
    status: str
    status_type: str
    minute: Optional[int] = None
    current_period_start_timestamp: Optional[int] = None
    current_minute: Optional[int] = None
    home: WorldCupFixtureTeam
    away: WorldCupFixtureTeam


class WorldCupMatchStatItem(BaseModel):
    key: Optional[str] = None
    name: str
    group: Optional[str] = None
    period: Optional[str] = None
    home: Optional[Any] = None
    away: Optional[Any] = None
    home_raw: Optional[Any] = None
    away_raw: Optional[Any] = None


class WorldCupMatchDetail(BaseModel):
    fixture: WorldCupFixture
    synced_match: Optional[MatchCenterMatch] = None
    stats: List[WorldCupMatchStatItem] = []
    lineups: Optional[Dict[str, Any]] = None
    incidents: List[Dict[str, Any]] = []
    shotmap: List[Dict[str, Any]] = []
    momentum: List[Dict[str, Any]] = []
