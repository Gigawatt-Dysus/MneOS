$ErrorActionPreference = "Stop"

Write-Host "[STATUS] Initiating MneOS Local Android Forge Setup..." -ForegroundColor Cyan

# 1. Define Target Directories on D:\
$AndroidHome = "D:\Android\Sdk"
$GradleHome = "D:\.gradle"
$JavaHomeDir = "C:\Program Files\Eclipse Adoptium\jdk-17*" # Will resolve exactly after install

# 2. Create the directories if they don't exist
Write-Host "Verifying D:\ drive target structures..."
if (-not (Test-Path $AndroidHome)) { New-Item -ItemType Directory -Path $AndroidHome -Force | Out-Null }
if (-not (Test-Path $GradleHome)) { New-Item -ItemType Directory -Path $GradleHome -Force | Out-Null }

# 3. Set User Environment Variables
Write-Host "Setting core environment variables (ANDROID_HOME, GRADLE_USER_HOME)..."
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $AndroidHome, "User")
[Environment]::SetEnvironmentVariable("GRADLE_USER_HOME", $GradleHome, "User")

# 4. Inject Paths into the User PATH variable
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$PathsToAdd = @(
    "$AndroidHome\platform-tools",
    "$AndroidHome\cmdline-tools\latest\bin",
    "$AndroidHome\emulator"
)

$PathChanged = $false
foreach ($p in $PathsToAdd) {
    if ($UserPath -notmatch [regex]::Escape($p)) {
        $UserPath += ";$p"
        $PathChanged = $true
    }
}

if ($PathChanged) {
    Write-Host "Injecting Android tooling into User PATH..."
    [Environment]::SetEnvironmentVariable("Path", $UserPath, "User")
} else {
    Write-Host "PATH already contains Android tooling. Skipping."
}

Write-Host "[SUCCESS] MneOS Environment routing completed." -ForegroundColor Green
Write-Host "Note: You will need to restart your terminal for the PATH changes to take effect." -ForegroundColor Yellow
