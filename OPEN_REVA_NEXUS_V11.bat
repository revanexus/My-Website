@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
start "" cmd /c "node server.js"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000/"
start "" "http://localhost:3000/admin"
