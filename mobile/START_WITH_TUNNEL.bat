@echo off
echo Starting Expo with Tunnel Mode...
echo This will create a public URL that works from anywhere
echo.
cd /d "%~dp0"
npx expo start --tunnel --clear
