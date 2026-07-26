@echo off
title MneOS Sovereign Core HUD
color 0a
cls
echo Starting Sovereign Genesis Cluster HUD...
echo Please ensure the Telemetry Daemon is running on the cluster nodes.
cd /d "%~dp0scripts\infrastructure"
python MneOS_Genesis_HUD.py
pause
