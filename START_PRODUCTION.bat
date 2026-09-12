@echo off
cd /d "%~dp0"
if not exist .env copy .env.example .env
echo Starting Reva Nexus V11 Production stack...
docker compose up -d --build
timeout /t 4 /nobreak >nul
start "" "http://localhost:3000/"
start "" "http://localhost:3000/admin"
