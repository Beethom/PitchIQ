#!/bin/bash
set -e

REPO_NAME="PitchIQ"
GITHUB_USER="Beethom"
REMOTE_URL="https://github.com/$GITHUB_USER/$REPO_NAME.git"

echo "Checking secrets..."

# Stop tracking local secrets/databases if they were committed before.
git rm --cached backend/.env 2>/dev/null || true
git rm --cached pitchiq.db 2>/dev/null || true
git rm --cached backend/pitchiq.db 2>/dev/null || true

echo "Staging deployment files..."
git add .gitignore push-to-github.sh
git add Dockerfile backend frontend

git commit -m "Prepare PitchIQ for deployment" || true

echo "Setting main branch..."
git branch -M main

echo "Adding GitHub remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE_URL"

echo "Pushing to GitHub..."
git push -u origin main

echo "Done. Repo pushed to:"
echo "$REMOTE_URL"
