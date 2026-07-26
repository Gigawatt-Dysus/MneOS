@echo off
color 0B
echo Severing RDP connections to Genesis cluster cleanly...
echo.
:: Killing the mstsc client process drops the connection locally
:: exactly like clicking the 'X' or losing network. 
:: The server-side sessions remain completely intact and running.
taskkill /F /IM mstsc.exe >nul 2>&1

color 0A
echo All Remote Desktop sessions disconnected.
timeout /t 2 >nul
