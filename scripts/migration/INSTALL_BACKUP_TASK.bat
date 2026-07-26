@echo off
echo =======================================
echo MneOS Chronos Backup - Task Installer
echo =======================================
echo.
echo Checking for MneOS_Chronos_Backup.ps1 in Downloads folder...
if not exist "%USERPROFILE%\Downloads\MneOS_Chronos_Backup.ps1" (
    echo ERROR: Could not find MneOS_Chronos_Backup.ps1 in your Downloads folder.
    echo Please make sure Tailscale successfully received the file.
    pause
    exit /b 1
)

echo Moving script to root C:\ drive for safe execution...
copy /Y "%USERPROFILE%\Downloads\MneOS_Chronos_Backup.ps1" "C:\MneOS_Chronos_Backup.ps1"

echo.
echo Registering Windows Scheduled Task (Runs Daily at 03:00 AM as SYSTEM)...
powershell -Command "Register-ScheduledTask -TaskName 'MneOS_Chronos_Backup' -Trigger (New-ScheduledTaskTrigger -Daily -At 3am) -Action (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -WindowStyle Hidden -File C:\MneOS_Chronos_Backup.ps1') -User 'SYSTEM' -RunLevel Highest -Force"

echo.
echo =======================================
echo SUCCESS! Task Installed.
echo You can close this window.
echo =======================================
pause
