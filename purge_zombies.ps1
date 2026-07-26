$ports = @(3000, 3001, 5000, 5001, 5173, 5005)
foreach ($port in $ports) {
    $zombies = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($zombies) {
        foreach ($zombie in $zombies) {
            Stop-Process -Id $zombie -Force -ErrorAction SilentlyContinue
            Write-Host "Killed process on port $port"
        }
    }
}

Get-CimInstance Win32_Process | Where-Object { 
    ($_.Name -eq 'powershell.exe' -and $_.CommandLine -match '-NoExit') -or 
    ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'staging_api|vercel|serve|build') -or 
    ($_.Name -eq 'python.exe' -and $_.CommandLine -match 'vector_server')
} | ForEach-Object { 
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue 
    Write-Host "Killed script process: $($_.Name)"
}

$badPids = @(49828, 9780, 31448, 28540, 30584, 12336, 12336, 4028, 9308, 50284, 25952, 51592, 31308, 41240, 41212, 31040, 5756, 51684, 40308, 40240, 33332, 46812, 4960, 28104, 25856, 49244, 22456, 36948, 3556, 28512, 27740, 39800, 36080, 35884, 29368, 30724, 36032, 36004, 30404, 37004, 19500, 11556, 37524, 50412)
foreach ($p in $badPids) { 
    Stop-Process -Id $p -Force -ErrorAction SilentlyContinue 
}

Write-Host "Surgical sweep complete. The runway is clear."
