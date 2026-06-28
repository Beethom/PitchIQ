#!/usr/bin/env bash
# PitchVision VPS deploy: pull latest code, rebuild, restart the API service.
# Run on the server:  bash /opt/pitchiq/deploy.sh
# The live database (backend/pitchiq.db) is protected from being overwritten
# by `git update-index --skip-worktree backend/pitchiq.db` (run once on setup).
set -euo pipefail

APP_DIR="/opt/pitchiq"
cd "$APP_DIR"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Updating backend dependencies"
cd "$APP_DIR/backend"
venv/bin/pip install -q -r requirements.txt

echo "==> Building frontend"
cd "$APP_DIR/frontend"
npm install --no-audit --no-fund
npm run build
rm -rf "$APP_DIR/backend/static"
cp -r dist "$APP_DIR/backend/static"

echo "==> Restarting service"
systemctl restart pitchiq
sleep 3
curl -fsS http://127.0.0.1:8000/api/health && echo " <- API healthy" || echo "WARNING: health check failed"

echo "==> Done"
