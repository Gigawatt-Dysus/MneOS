$date = Get-Date -Format "yyyy-MM-dd_HH-mm"
$source = $PSScriptRoot
$destinationFolder = Join-Path $source "_backups"
$zipName = "backup_$date.zip"
$destinationPath = Join-Path $destinationFolder $zipName

# Ensure destination folder exists
if (!(Test-Path -Path $destinationFolder)) {
    New-Item -ItemType Directory -Path $destinationFolder | Out-Null
}

$exclude = @(
    "node_modules", 
    ".git", 
    ".firebase", 
    "dist", 
    "coverage", 
    ".vs", 
    ".gemini", 
    "_backups",
    "artifacts"
)

Write-Host "Starting backup to: $destinationPath"
Write-Host "Excluding: $($exclude -join ', ')"

# Get items to compress
$items = Get-ChildItem -Path $source | Where-Object { 
    $_.Name -notin $exclude 
}

# Compress
Compress-Archive -Path $items.FullName -DestinationPath $destinationPath -CompressionLevel Optimal

Write-Host "Backup created successfully at: $destinationPath"
