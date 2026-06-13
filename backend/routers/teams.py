from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

import crud
import schemas
from database import get_db

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("/", response_model=List[schemas.TeamOut])
def list_teams(
    league: Optional[str] = Query(None),
    season: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return crud.get_teams(db, league=league, season=season)
