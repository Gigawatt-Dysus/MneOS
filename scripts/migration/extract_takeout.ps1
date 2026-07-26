param(
    [string]$SourceDir = "I:\LifeOS_Archive",
    [string]$DestDir = "I:\LifeOS_Archive\Lifeboat_Extracted"
)

# Ensure 7-Zip is installed
$7zPath = "C:\Program Files\7-Zip\7z.exe"
if (-not (Test-Path $7zPath)) {
    Write-Host "[ERROR] 7-Zip not found at $7zPath. Please install it or update the path." -ForegroundColor Red
    exit
}

# Create destination if it doesn't exist
if (-not (Test-Path $DestDir)) {
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
    Write-Host "[INFO] Created destination directory: $DestDir" -ForegroundColor Cyan
}

# Find all zip files recursively in the subfolders (lifeboat_alpha, lifeboat_beta, etc.)
$zipFiles = Get-ChildItem -Path $SourceDir -Filter *.zip -Recurse

if ($zipFiles.Count -eq 0) {
    Write-Host "[WARN] No .zip files found in $SourceDir or its subdirectories." -ForegroundColor Yellow
    exit
}

Write-Host "[INFO] Found $($zipFiles.Count) zip archives. Beginning extraction..." -ForegroundColor Green

foreach ($zip in $zipFiles) {
    Write-Host "[EXTRACTING] $($zip.FullName) -> $DestDir" -ForegroundColor Cyan
    
    # Run 7-zip: 
    # x = extract with full paths
    # -o = output directory
    # -y = assume yes on all queries (overwrites duplicate metadata files silently)
    & $7zPath x $zip.FullName "-o$DestDir" -y
}

Write-Host "[SUCCESS] All archives have been merged into $DestDir!" -ForegroundColor Green
