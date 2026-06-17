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

# Serve React frontend — must come after all /api routes
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        return FileResponse(os.path.join(_static_dir, "index.html"))
