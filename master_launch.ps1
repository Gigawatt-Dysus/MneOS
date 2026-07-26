param (
    [string]$Location = "Home",
    [string]$Mode = "All"
)

# master_launch.ps1
# The Single Invocation Ignition Matrix

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ">>> THE COMMANDER'S MASTER IGNITION   <<<" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  -> Location Profile: $Location" -ForegroundColor Yellow
Write-Host "  -> Ignition Target: $Mode Mode" -ForegroundColor Yellow
Write-Host ""

cd $PSScriptRoot

# 1. PURGE ZOMBIES
Write-Host "[PHASE 1] Purging lingering processes..." -ForegroundColor Yellow
if (Test-Path ".\shutdown.ps1") {
    powershell.exe -ExecutionPolicy Bypass -File .\shutdown.ps1 -Mode $Mode
} else {
    Write-Host "  -> shutdown.ps1 not found. Skipping." -ForegroundColor DarkGray
}
Write-Host ""

# 2. LAUNCH CORE MATRIX (Minimized)
Write-Host "[PHASE 2] Spooling core infrastructure..." -ForegroundColor Yellow
if (Test-Path ".\launch.ps1") {
    powershell.exe -ExecutionPolicy Bypass -File .\launch.ps1 -Mode $Mode
} else {
    Write-Host "  -> launch.ps1 not found. Skipping." -ForegroundColor DarkGray
}

Write-Host "  -> Core matrix ignited. Waiting 5 seconds to stabilize..." -ForegroundColor DarkGray
Start-Sleep -Seconds 5
Write-Host ""

# 3. LAUNCH ORCHESTRATOR (Vision Only Mode)
if ($Mode -eq "All" -or $Mode -eq "Remote") {
    if ($Location -eq "Work") {
        Write-Host "[PHASE 3] SKIPPED: Work Profile Detected (T-Mobile Safety Interlock)" -ForegroundColor Red
        Write-Host "  -> Sovereign Orchestrator & Vision Pipeline disabled to conserve metered bandwidth." -ForegroundColor DarkGray
        Write-Host ""
    } else {
        Write-Host "[PHASE 3] Engaging Sovereign Orchestrator (Vision Only)..." -ForegroundColor Yellow
        Write-Host "  -> Passing control to Node.js telemetry dashboard." -ForegroundColor DarkGray
        Write-Host ""

        # Call the orchestrator with the new --vision-only flag to bypass the prompt
        # node .\scripts\migration\sovereign_orchestrator.js --vision-only
        Write-Host "  -> [ZEN] Orchestrator disabled per user request to prevent system lockups." -ForegroundColor DarkGray
    }
} else {
    Write-Host "[PHASE 3] SKIPPED: Orchestrator excluded in $Mode Mode." -ForegroundColor DarkGray
}
Write-Host ""

# 4. LAUNCH CONTEXT SENTINEL
Write-Host "[PHASE 4] Spooling Context Sentinel (Miles-to-E Monitor)..." -ForegroundColor Yellow
if (Test-Path ".\scripts\zen_sentinel.cjs") {
    Start-Process npx.cmd -ArgumentList "nodemon .\scripts\zen_sentinel.cjs" -WindowStyle Minimized
    Write-Host "  -> Sentinel daemon running in minimized window." -ForegroundColor DarkGray
} else {
    Write-Host "  -> zen_sentinel.cjs not found. Skipping." -ForegroundColor DarkGray
}
Write-Host ""

# 5. LAUNCH HESTIA CARETAKER
Write-Host "[PHASE 5] Spooling Hestia Caretaker (Cloud Linter)..." -ForegroundColor Yellow
if (Test-Path ".\scripts\hestia_caretaker.cjs") {
    Start-Process node -ArgumentList ".\scripts\hestia_caretaker.cjs" -WindowStyle Minimized
    Write-Host "  -> Hestia daemon running in minimized window." -ForegroundColor DarkGray
} else {
    Write-Host "  -> hestia_caretaker.cjs not found. Skipping." -ForegroundColor DarkGray
}
Write-Host ""
