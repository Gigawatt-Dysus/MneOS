@echo off
title MneOS Telemetry Daemon
color 0a
cls
echo Starting MneOS Telemetry Daemon...
cd /d "%~dp0scripts\infrastructure"
python genesis_telemetry_daemon.py
pause
