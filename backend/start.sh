#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "→ Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate

echo "→ Installing dependencies..."
pip install -r requirements.txt -q

echo "→ Seeding database..."
python seed.py

echo "→ Starting PitchIQ API on http://localhost:8000"
echo "   Docs available at http://localhost:8000/docs"
echo ""
uvicorn main:app --reload --host 0.0.0.0 --port 8000
