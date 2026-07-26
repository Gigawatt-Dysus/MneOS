param(
    [string]$Mode = "Prompt"
)

if ($Mode -eq "Prompt") {
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "  MNEOS SHUTDOWN PROTOCOL" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "1. ALL (Scorched Earth - Default)"
    Write-Host "2. DEV (Frontend & API)"
    Write-Host "3. REMOTE (Vector & Airlock)"
    Write-Host "4. API ONLY (Sovereign API / Port 3000)"
    Write-Host ""
    $choice = Read-Host "Select mode [1]"
    switch ($choice) {
        "2" { $Mode = "Dev" }
        "3" { $Mode = "Remote" }
        "4" { $Mode = "ApiOnly" }
        default { $Mode = "All" }
    }
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ">>> INITIATING MNEOS SHUTDOWN SEQUENCE ($Mode Mode)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$targetShells = ""
$targetNodes = ""
$targetPythons = ""
$ports = @()

if ($Mode -eq "All") {
    $targetShells = 'Functions Emulator|Staging Airlock|Python Vector API|Sovereign API|MneOS Frontend|ComfyUI Engine|Erato Forge'
    $targetNodes = 'staging_api|api-dev-server|serve|vite|sovereign_orchestrator|airlock_ingest|forge_sync|zen_sentinel|hestia_caretaker|erato_forge'
    $targetPythons = 'vector_server.py|victus_ai_sweeper.py'
    $ports = @(3000, 3001, 5000, 5001, 5173, 5005, 8188, 31337)
} elseif ($Mode -eq "Dev") {
    $targetShells = 'Sovereign API|MneOS Frontend|ComfyUI Engine|Erato Forge'
    $targetNodes = 'api-dev-server|vite|zen_sentinel|hestia_caretaker|erato_forge'
    $targetPythons = 'xyz_none_match'
    $ports = @(3000, 5173, 8188, 31337)
} elseif ($Mode -eq "Remote") {
    $targetShells = 'Functions Emulator|Staging Airlock|Python Vector API'
    $targetNodes = 'staging_api|serve|sovereign_orchestrator|airlock_ingest|forge_sync|zen_sentinel|hestia_caretaker'
    $targetPythons = 'vector_server.py|victus_ai_sweeper.py'
    $ports = @(3001, 5000, 5001, 5005)
} elseif ($Mode -eq "ApiOnly") {
    $targetShells = 'Sovereign API'
    $targetNodes = 'api-dev-server'
    $targetPythons = 'xyz_none_match'
    $ports = @(3000)
}

Write-Host "[1/2] Decapitating Target Terminals & Processes..." -ForegroundColor Yellow

# WMI is currently hanging. Bypassing precise CommandLine matching and relying on port sweeps + WindowTitles.
Get-Process | Where-Object { $_.MainWindowTitle -match $targetShells } | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    Write-Host "  -> Severed Window $($_.MainWindowTitle) (PID: $($_.Id))" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/2] Sweeping Matrix Ports for Orphans..." -ForegroundColor Yellow

foreach ($port in $ports) {
    $netstatOutput = netstat -ano | findstr ":$port " | findstr "LISTENING"
    if ($netstatOutput) {
        foreach ($line in $netstatOutput -split "`r`n") {
            if ($line -match '\s+(\d+)$') {
                $zombie = $matches[1]
                Stop-Process -Id $zombie -Force -ErrorAction SilentlyContinue
                Write-Host "  -> Purged orphan squatting on port $port (PID: $zombie)" -ForegroundColor Green
            }
        }
    }
}

Write-Host ""
if ($Mode -eq "All" -or $Mode -eq "Dev") {
    Write-Host "[3/3] Scorched Earth: Purging all Node.js zombies..." -ForegroundColor Yellow
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
    Write-Host "  -> All node.exe processes eliminated." -ForegroundColor Green
    Write-Host ""
}

Write-Host "[OK] Target MneOS components have been safely spun down." -ForegroundColor DarkCyan
Start-Sleep -Seconds 3
