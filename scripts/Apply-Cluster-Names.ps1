# Requires -RunAsAdministrator

$hostsPath = "$env:windir\System32\drivers\etc\hosts"
$entries = @(
    "100.116.12.18    Gigi-Genesis-Alpha",
    "100.65.97.113    Gigi-Genesis-Beta",
    "100.105.114.31   Gigi-Genesis-Gamma"
)

Write-Host "Injecting Genesis Cluster aliases into system hosts file..." -ForegroundColor Cyan

foreach ($entry in $entries) {
    # Check if the entry already exists to avoid duplicates
    $ip = ($entry -split '\s+')[0]
    $name = ($entry -split '\s+')[1]
    
    if (Select-String -Path $hostsPath -Pattern $name -Quiet) {
        Write-Host "Alias for $name already exists, skipping." -ForegroundColor Yellow
    } else {
        Add-Content -Path $hostsPath -Value $entry
        Write-Host "Added $name -> $ip" -ForegroundColor Green
    }
}

Write-Host "`nHosts file successfully updated. You may now close this window." -ForegroundColor Green
Start-Sleep -Seconds 3
