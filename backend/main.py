import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

load_dotenv()

import models
from database import ensure_schema
from routers import players, compare, admin, teams, media
from scheduler import start_scheduler, stop_scheduler

ensure_schema(models.Base)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="PitchVision API",
    version="1.0.0",
    description="Soccer player analytics API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router, prefix="/api")
app.include_router(teams.router, prefix="/api")
app.include_router(compare.router, prefix="/api")
app.include_router(admin.router,   prefix="/api")
app.include_router(media.router,   prefix="/api")

# Remove 307 redirects — FastAPI adds trailing-slash redirects by default
app.router.redirect_slashes = False


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok", "version": "1.0.0"}


# Dynamic sitemap — static pages + every World Cup player & match.
# Declared before the SPA catch-all so it takes precedence over any static file.
@app.get("/sitemap.xml", include_in_schema=False)
def sitemap():
    from fastapi.responses import Response
    from database import SessionLocal
    import models

    base = "https://www.pitchvision.app"
    urls = [
        (f"{base}/", "daily", "1.0"),
        (f"{base}/world-cup", "hourly", "0.9"),
        (f"{base}/world-cup/matches", "hourly", "0.8"),
        (f"{base}/scouting-board", "daily", "0.7"),
        (f"{base}/compare", "weekly", "0.5"),
        (f"{base}/about", "monthly", "0.4"),
        (f"{base}/how-it-works", "monthly", "0.4"),
        (f"{base}/faq", "monthly", "0.4"),
        (f"{base}/coverage", "monthly", "0.4"),
        (f"{base}/methodology", "monthly", "0.4"),
    ]
    db = SessionLocal()
    try:
        players = (
            db.query(models.Player.id)
            .filter(models.Player.league == "FIFA World Cup", models.Player.season == "2026")
            .all()
        )
        for (pid,) in players:
            urls.append((f"{base}/player/{pid}", "weekly", "0.6"))
        # Match URLs from already-synced data (no live API calls in the sitemap).
        fixture_ids = (
            db.query(models.PlayerMatchStat.fixture_id)
            .filter(models.PlayerMatchStat.source_league_id == 16,
                    models.PlayerMatchStat.source_season == 58210)
            .distinct()
            .all()
        )
        for (fid,) in fixture_ids:
            if fid:
                urls.append((f"{base}/world-cup/matches/{fid}", "weekly", "0.6"))
    finally:
        db.close()

    body = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, freq, pri in urls:
        body.append(f"<url><loc>{loc}</loc><changefreq>{freq}</changefreq><priority>{pri}</priority></url>")
    body.append("</urlset>")
    return Response("\n".join(body), media_type="application/xml")


# --- World Cup stat-leader share cards (Twitter/X image + OG page) ---
@app.get("/api/share/wc-leaders.png", include_in_schema=False)
def share_leaders_png(tab: str = "goals"):
    from fastapi.responses import Response
    from database import SessionLocal
    import crud, share_cards

    db = SessionLocal()
    try:
        players = crud.get_players(db, league="FIFA World Cup", season="2026", limit=2000)
    finally:
        db.close()
    label, rows, _ = share_cards.rank_players(players, tab)
    if not label:
        label, rows = "Goals", []
    png = share_cards.render_leaders_png(label, rows or [])
    return Response(png, media_type="image/png", headers={"Cache-Control": "public, max-age=600"})


@app.get("/share/wc-leaders", include_in_schema=False)
def share_leaders_page(tab: str = "goals"):
    from fastapi.responses import HTMLResponse
    import share_cards
    spec = share_cards.TABS.get(tab)
    label = spec[0] if spec else "Goals"
    return HTMLResponse(share_cards.share_page_html(label, tab))


@app.get("/api/share/xi.png", include_in_schema=False)
def share_xi_png(f: str = "4-3-3", p: str = ""):
    from fastapi.responses import Response
    from database import SessionLocal
    import models, share_cards

    ids = [int(x) for x in p.split(",") if x.strip().isdigit()]
    names = []
    if ids:
        db = SessionLocal()
        try:
            by_id = {pl.id: pl.name for pl in db.query(models.Player).filter(models.Player.id.in_(ids)).all()}
        finally:
            db.close()
        names = [by_id.get(i, "") for i in ids]
    png = share_cards.render_xi_png(f, names)
    return Response(png, media_type="image/png", headers={"Cache-Control": "public, max-age=600"})


@app.get("/share/xi", include_in_schema=False)
def share_xi_page(f: str = "4-3-3", p: str = ""):
    from fastapi.responses import HTMLResponse
    import share_cards
    return HTMLResponse(share_cards.xi_share_page_html(f, p))


# Serve React frontend — must come after all /api routes
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        # Serve real root-level static files (og-image.png, robots.txt,
        # sitemap.xml, favicon, etc.) when they exist; otherwise fall back to
        # the SPA so client-side routing works.
        if full_path:
            candidate = os.path.normpath(os.path.join(_static_dir, full_path))
            if candidate.startswith(_static_dir) and os.path.isfile(candidate):
                return FileResponse(candidate)
        return FileResponse(os.path.join(_static_dir, "index.html"))
