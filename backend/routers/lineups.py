import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, Dict

import models
from database import get_db

router = APIRouter(prefix="/lineups", tags=["lineups"])

MAX_BYTES = 60_000  # guard against oversized payloads


@router.post("/")
def create_lineup(payload: Dict[str, Any], db: Session = Depends(get_db)):
    if not isinstance(payload, dict) or "picks" not in payload:
        raise HTTPException(status_code=400, detail="Invalid lineup payload")
    import json
    if len(json.dumps(payload)) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Lineup too large")
    lid = uuid.uuid4().hex[:10]
    db.add(models.SharedLineup(id=lid, data=payload, created_at=int(time.time())))
    db.commit()
    return {"id": lid}


@router.get("/{lineup_id}")
def get_lineup(lineup_id: str, db: Session = Depends(get_db)):
    row = db.query(models.SharedLineup).filter(models.SharedLineup.id == lineup_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Lineup not found")
    return row.data
