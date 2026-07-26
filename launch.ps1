param(
    [string]$Mode = "All"
)

# launch.ps1
# Bicameral Local Server Ignition Script
# Forces legacy conhost.exe to bypass Windows 11 Terminal hijacking and ensure windows actually minimize.

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ">>> IGNITING BICAMERAL LOCAL SERVER MATRIX ($Mode)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

cd\
cd C:\MneOS

Write-Host "[*] Spooling servers in MINIMIZED classic windows (bypassing Windows 11 Terminal)..." -ForegroundColor DarkCyan

if ($Mode -eq "All" -or $Mode -eq "Remote") {
    Write-Host "[1/5] Spooling Functions Emulator Proxy (T+0s)..." -ForegroundColor Yellow
    Start-Process powershell.exe -WindowStyle Minimized -ArgumentList "-NoExit -Command `" `$Host.UI.RawUI.WindowTitle = 'Functions Emulator (5000)'; cd 'C:\MneOS\functions'; npm run serve ; Read-Host `""
    
    Write-Host "      Waiting for Emulator Proxy to bind..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 4
    
    Write-Host "[2/5] Spooling Sovereign Staging API (T+4s)..." -ForegroundColor Yellow
    Start-Process powershell.exe -WindowStyle Minimized -ArgumentList "-NoExit -Command `" `$Host.UI.RawUI.WindowTitle = 'Staging Airlock (3001)'; cd 'C:\MneOS'; node scripts\migration\staging_api.js ; Read-Host `""
    
    Write-Host "      Waiting for Staging API to bind..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 2
    
    Write-Host "[3/5] Spooling Python Vector API (T+6s)..." -ForegroundColor Yellow
    Start-Process powershell.exe -WindowStyle Minimized -ArgumentList "-NoExit -Command `" `$Host.UI.RawUI.WindowTitle = 'Python Vector API (5005)'; cd 'C:\MneOS\scripts\migration'; python vector_server.py ; Read-Host `""
    
    Write-Host "      Waiting for Vector API to bind..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 2
}

if ($Mode -eq "All" -or $Mode -eq "Dev") {
    Write-Host "[4/5] Spooling Sovereign DB API Server (T+8s)..." -ForegroundColor Yellow
    Start-Process powershell.exe -WindowStyle Minimized -ArgumentList "-Command `" `$Host.UI.RawUI.WindowTitle = 'Sovereign API (3000)'; cd 'C:\MneOS'; npx nodemon -e js,cjs,ts,json api-dev-server.cjs `""
    
    Write-Host "      Waiting for Vercel to bind..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 4
    
    Write-Host "[5/6] Spooling Vite Frontend (T+12s)..." -ForegroundColor Yellow
    Start-Process powershell.exe -WindowStyle Minimized -ArgumentList "-Command `" `$Host.UI.RawUI.WindowTitle = 'MneOS Frontend (5173)'; cd 'C:\MneOS'; npm run dev `""

    Write-Host "      Waiting for Frontend to bind..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 4

    Write-Host "[6/7] Spooling ComfyUI Inference Engine (T+16s)..." -ForegroundColor Yellow
    Start-Process powershell.exe -WindowStyle Minimized -ArgumentList "-Command `" `$Host.UI.RawUI.WindowTitle = 'ComfyUI Engine (8188)'; cd 'C:\MneOS\scratch\MneOS_Comfy'; .\run_local_comfyui.bat `""

    Write-Host "      Waiting for ComfyUI to bind..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 4

    Write-Host "[7/7] Spooling Erato Forge Daemon (T+20s)..." -ForegroundColor Yellow
    Start-Process powershell.exe -WindowStyle Minimized -ArgumentList "-Command `" `$Host.UI.RawUI.WindowTitle = 'Erato Forge (31337)'; cd 'C:\MneOS\scratch'; node erato_forge.cjs `""
}

if ($Mode -eq "ApiOnly") {
    Write-Host "[1/1] Spooling Sovereign DB API Server (T+0s)..." -ForegroundColor Yellow
    Start-Process powershell.exe -WindowStyle Minimized -ArgumentList "-Command `" `$Host.UI.RawUI.WindowTitle = 'Sovereign API (3000)'; cd 'C:\MneOS'; npx nodemon -e js,cjs,ts,json api-dev-server.cjs `""
}

Write-Host ""
Write-Host "[OK] Ignition sequence complete!" -ForegroundColor Green
Write-Host "All selected servers are running strictly sequenced. Check your taskbar to view their minimized logs." -ForegroundColor Gray
