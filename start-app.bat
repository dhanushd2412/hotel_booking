@echo off
cd /d "%~dp0backend"
docker compose up -d
cd /d "%~dp0"
start /B python "C:\Users\dhanu\OneDrive\Documents\hotel-booking-app\backend\chat_service.py"
start "" "%~dp0index.html"
echo Hotel Vinayagam app started.
echo Backend API:      http://localhost:4000
echo Chat service:     http://localhost:5001
echo Database UI:      http://localhost:8080
pause
