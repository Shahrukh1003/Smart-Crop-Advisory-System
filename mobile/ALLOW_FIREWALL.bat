@echo off
echo Adding Windows Firewall Rules for Expo...
echo This requires Administrator privileges
echo.

REM Add firewall rules for Node.js
netsh advfirewall firewall add rule name="Expo Metro Bundler" dir=in action=allow protocol=TCP localport=8081
netsh advfirewall firewall add rule name="Expo Dev Server" dir=in action=allow protocol=TCP localport=19000-19001

echo.
echo Firewall rules added!
echo Now try: npx expo start
echo.
pause
