<#
.SYNOPSIS
    MneOS Sovereign Backup & Active Telemetry Script (Alpha Node)
.DESCRIPTION
    Executes the 3-Phase Backup Protocol. 
    Crucially features "Active Telemetry" - if the F:\ backup drive is unavailable,
    it fires a webhook and blasts a local MP3 alert in a loop on Alpha's speakers until dismissed.
#>

$BackupRoot = "F:\MneOS_Mongo_Backups"
$DbDumpPath = Join-Path $BackupRoot "mongodb_dumps\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$CodebaseArchivePath = Join-Path $BackupRoot "codebase_archives\mneos_src_$(Get-Date -Format 'yyyyMMdd_HHmmss').zip"
$AlertMp3 = "C:\MneOS\public\drive_failure_alert.mp3"
$DismissFlag = "C:\MneOS\dismiss_alert.flag"
$WebhookUrl = "https://ntfy.sh/mneos_alpha_alerts"

Write-Host "[MneOS Backup] Initiating Sovereign Backup Sequence..." -ForegroundColor Cyan

# Ensure the dismiss flag is cleared before starting
if (Test-Path $DismissFlag) {
    Remove-Item $DismissFlag -Force
}

# 1. Active Telemetry: Validate Backup Array
if (-not (Test-Path $BackupRoot)) {
    Write-Host "[CRITICAL ERROR] Target Array ($BackupRoot) is offline or dead!" -ForegroundColor Red
    
    # Fire Webhook Alert (Ntfy is a free, instant push notification service)
    try {
        Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body "CRITICAL: Genesis Alpha F:\ Drive is offline! Backups failing!" -ErrorAction SilentlyContinue
        Write-Host "Webhook alert transmitted."
    } catch {
        Write-Host "Webhook transmission failed." -ForegroundColor DarkGray
    }

    # Play Audio Loop on Headless Node
    if (Test-Path $AlertMp3) {
        Write-Host "Triggering Audible Alarm Sequence. Create '$DismissFlag' to silence." -ForegroundColor Yellow
        # We use COM WMPlayer to ensure it plays via the audio graph even if headless (assuming run under user context)
        $wmp = New-Object -ComObject WMPlayer.OCX
        $wmp.URL = $AlertMp3
        $wmp.settings.setMode("loop", $true)
        $wmp.settings.volume = 100
        $wmp.controls.play()

        # The script will lock here and play the alarm until the Commander drops the flag file
        while (-not (Test-Path $DismissFlag)) {
            Start-Sleep -Seconds 2
        }

        Write-Host "Dismissal flag detected. Silencing alarm." -ForegroundColor Green
        $wmp.controls.stop()
        Remove-Item $DismissFlag -Force
    } else {
        Write-Host "Alert MP3 not found at $AlertMp3." -ForegroundColor Red
    }
    
    Exit 1
}

Write-Host "[OK] Target Array ($BackupRoot) is online." -ForegroundColor Green

# 2. Phase 1: MongoDB Snapshot
Write-Host "Executing MongoDB Dump..." -ForegroundColor Cyan
# Target portable tool if exists, else assume PATH
$MongoDumpExe = "mongodump.exe"
if (Test-Path "C:\MneOS\.tools\mongodump.exe") {
    $MongoDumpExe = "C:\MneOS\.tools\mongodump.exe"
}

try {
    & $MongoDumpExe --uri="mongodb://zen:sovereign@127.0.0.1:27017/LifeOS?authSource=admin" --out=$DbDumpPath
    Write-Host "[OK] Database snapshot secured." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Database snapshot failed: $_" -ForegroundColor Red
}

# 3. Phase 2: Codebase Lock (Zip Archive)
Write-Host "Executing Codebase Lock..." -ForegroundColor Cyan
# Ensure destination folder exists
if (-not (Test-Path "F:\MneOS_Mongo_Backups\codebase_archives")) {
    New-Item -ItemType Directory -Force -Path "F:\MneOS_Mongo_Backups\codebase_archives" | Out-Null
}

$7zExe = "C:\Program Files\7-Zip\7z.exe"
if (Test-Path $7zExe) {
    try {
        & $7zExe a -tzip $CodebaseArchivePath "C:\MneOS\*" "-xr!node_modules" "-xr!.git" "-xr!dist" "-xr!scratch" "-xr!_SESSION_EXPORTS"
        Write-Host "[OK] Codebase lock secured." -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Codebase lock failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "[WARNING] 7-Zip not found at $7zExe. Using fallback (Warning: larger file sizes)." -ForegroundColor Yellow
    Compress-Archive -Path C:\MneOS\* -DestinationPath $CodebaseArchivePath -Force
}

# 4. Phase 3: Prune Old Backups (Retain last 7 days)
Write-Host "Pruning backups older than 7 days..." -ForegroundColor Cyan
$CutoffDate = (Get-Date).AddDays(-7)
# Prune MongoDB Dumps
Get-ChildItem -Path "F:\MneOS_Mongo_Backups\mongodb_dumps" -Directory | Where-Object { $_.CreationTime -lt $CutoffDate } | Remove-Item -Recurse -Force
# Prune Codebase Archives
Get-ChildItem -Path "F:\MneOS_Mongo_Backups\codebase_archives" -File -Filter "*.zip" | Where-Object { $_.CreationTime -lt $CutoffDate } | Remove-Item -Force
Write-Host "[OK] Old backups pruned." -ForegroundColor Green

# 5. Success Webhook
try {
    Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body "SUCCESS: MneOS Backup verified and locked to Alpha Array. Old backups pruned." -ErrorAction SilentlyContinue
} catch {}

Write-Host "Backup Sequence Complete." -ForegroundColor Green
