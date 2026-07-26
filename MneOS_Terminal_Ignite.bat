@echo off
title MneOS Genesis Cluster
color 0b
echo =========================================
echo [ZEN] IGNITING SOVEREIGN GENESIS CLUSTER
echo =========================================
powershell.exe -ExecutionPolicy Bypass -WindowStyle Normal -File "%~dp0master_launch.ps1" -Location Home -Mode All
