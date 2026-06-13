from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db

router = APIRouter(prefix="/compare", tags=["compare"])


@router.get("/", response_model=schemas.CompareOut)
def compare_players(
    player_a: int = Query(..., description="ID of Player A"),
    player_b: int = Query(..., description="ID of Player B"),
    db: Session = Depends(get_db),
):
    a = crud.get_visible_player(db, player_a)
    b = crud.get_visible_player(db, player_b)

    if not a:
        raise HTTPException(status_code=404, detail=f"Player with id={player_a} not found")
    if not b:
        raise HTTPException(status_code=404, detail=f"Player with id={player_b} not found")

    return {"playerA": a, "playerB": b}
