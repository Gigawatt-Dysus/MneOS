<#
.SYNOPSIS
Project GIGI: Mnemosyne (MneOS)
Chronos Backup Protocol - Native Alpha N-Deep Archiver

.DESCRIPTION
This script is designed to run natively on the Alpha node via Windows Task Scheduler.
It performs a native mongodump inside the sovereign_db Docker container,
extracts the archive to the JBOD via its immutable Volume GUID, handles
Grandfather-Father-Son (GFS) rotation pruning, and offloads a cloud replica to Backblaze B2.
#>

param (
    [Parameter(Mandatory=$false)]
    [string]$JbodVolumeGuid = "\\?\Volume{cfe26eb2-7824-4bb4-bdf5-001af2460362}\",
    
    [Parameter(Mandatory=$false)]
    [string]$B2BucketPath = "s3://LifeOS-Media/database_vault/",
    
    [Parameter(Mandatory=$false)]
    [string]$MongoContainerName = "sovereign_db"
)

# ---------------------------------------------------------
# 1. PRE-FLIGHT VERIFICATIONS
# ---------------------------------------------------------
Write-Host "======================================="
Write-Host "🛡️ MneOS Chronos Backup Initiated"
Write-Host "======================================="

if (-not (Test-Path $JbodVolumeGuid)) {
    Write-Error "FATAL: JBOD Volume GUID not found: $JbodVolumeGuid"
    Write-Error "Ensure the external drive is connected."
    exit 1
}

# Create backup directory on JBOD if it doesn't exist
$BackupTargetDir = Join-Path $JbodVolumeGuid "MneOS_Chronos_Vault"
if (-not (Test-Path $BackupTargetDir)) {
    New-Item -ItemType Directory -Path $BackupTargetDir | Out-Null
}

# ---------------------------------------------------------
# 2. DETERMINE GFS ROTATION TAG
# ---------------------------------------------------------
$CurrentDate = Get-Date
$DateStamp = $CurrentDate.ToString("yyyyMMdd_HHmmss")
$Tag = "Daily"

# If it's the 1st of the month, it's a Monthly
if ($CurrentDate.Day -eq 1) {
    $Tag = "Monthly"
}
# If it's Sunday (and not the 1st), it's a Weekly
elseif ($CurrentDate.DayOfWeek -eq [System.DayOfWeek]::Sunday) {
    $Tag = "Weekly"
}

$ArchiveFilename = "MneOS_${Tag}_${DateStamp}.gz"
$FinalArchivePath = Join-Path $BackupTargetDir $ArchiveFilename
$TempArchivePath = "C:\temp_mneos_dump.gz"

Write-Host "⏳ Generating $Tag Archive: $ArchiveFilename"

# ---------------------------------------------------------
# 3. NATIVE DOCKER MONGODUMP
# ---------------------------------------------------------
Write-Host "📦 Commanding container '$MongoContainerName' to execute mongodump..."
# We dump into the container's /data/db/ directory as a temp hold
docker exec $MongoContainerName mongodump --gzip --archive=/data/db/temp_dump.gz

if ($LASTEXITCODE -ne 0) {
    Write-Error "FATAL: Docker mongodump failed."
    exit 1
}

Write-Host "🚚 Extracting archive from container to local Temp..."
docker cp "${MongoContainerName}:/data/db/temp_dump.gz" $TempArchivePath

Write-Host "💾 Moving archive to JBOD Cold Storage..."
Move-Item -Path $TempArchivePath -Destination $FinalArchivePath -Force

# Clean up the container's internal temp file
docker exec $MongoContainerName rm /data/db/temp_dump.gz

# ---------------------------------------------------------
# 4. PRUNING PROTOCOL (CLEANUP OLD ARCHIVES)
# ---------------------------------------------------------
Write-Host "🧹 Executing Pruning Protocol on JBOD..."

# Daily: Keep 7 days
Get-ChildItem -Path $BackupTargetDir -Filter "MneOS_Daily_*.gz" | 
    Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-7) } | 
    Remove-Item -Force

# Weekly: Keep 4 weeks (28 days)
Get-ChildItem -Path $BackupTargetDir -Filter "MneOS_Weekly_*.gz" | 
    Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-28) } | 
    Remove-Item -Force

# Monthly: Keep 12 months (365 days)
Get-ChildItem -Path $BackupTargetDir -Filter "MneOS_Monthly_*.gz" | 
    Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-365) } | 
    Remove-Item -Force

Write-Host "✅ Local Pruning Complete."

# ---------------------------------------------------------
# 5. OFFSITE SYNC (B2)
# ---------------------------------------------------------
Write-Host "☁️ Dispatching Replica to Backblaze B2..."

# Ensure AWS CLI is installed and configured on Alpha
$AwsCheck = Get-Command "aws" -ErrorAction SilentlyContinue
if ($AwsCheck) {
    # Using the standard s3 profile (must be configured via `aws configure`)
    aws s3 cp $FinalArchivePath $B2BucketPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Cloud Dispatch Successful."
    } else {
        Write-Warning "⚠️ Cloud Dispatch Failed. Check AWS CLI credentials."
    }
} else {
    Write-Warning "⚠️ AWS CLI not found. Skipping Cloud Dispatch."
}

Write-Host "======================================="
Write-Host "🎉 MneOS Chronos Backup Complete."
Write-Host "======================================="
exit 0
