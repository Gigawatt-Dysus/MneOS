@echo off
color 0B
echo Igniting Remote Desktop connections to Genesis cluster via Tailscale...
echo.

echo Connecting to Gigi-Genesis-Alpha...
start mstsc.exe /v:Gigi-Genesis-Alpha
timeout /t 1 >nul

echo Connecting to Gigi-Genesis-Beta...
start mstsc.exe /v:Gigi-Genesis-Beta
timeout /t 1 >nul

echo Connecting to Gigi-Genesis-Gamma...
start mstsc.exe /v:Gigi-Genesis-Gamma

echo.
color 0A
echo Cluster connections launched successfully.
timeout /t 2 >nul
