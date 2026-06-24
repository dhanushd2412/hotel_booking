@echo off
cd /d "%~dp0backend"
docker compose up -d
cd /d "%~dp0"
start "" "%~dp0index.html"
echo Hotel Vinayagam app started.
echo Backend API: http://localhost:4000
echo Database UI: http://localhost:8080
pause
