# Resonance Windows Installer
# Run in PowerShell as Administrator (recommended) or normal user
$ErrorActionPreference = "Stop"

$APPDIR = "$env:USERPROFILE\Apps\resonance"
$ZIP = "$env:USERPROFILE\Downloads\resonance-main.zip"

Write-Host "== Resonance Windows Installer ==" -ForegroundColor Cyan

# Check for required tools
$tools = @("git", "node", "cargo")
$missing = @()

foreach ($tool in $tools) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        $missing += $tool
    }
}

if ($missing.Count -gt 0) {
    Write-Host "Missing tools: $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please install:" -ForegroundColor Yellow
    Write-Host "  Git: https://git-scm.com/download/win" -ForegroundColor White
    Write-Host "  Node.js: https://nodejs.org/" -ForegroundColor White
    Write-Host "  Rust: https://rustup.rs/" -ForegroundColor White
    Write-Host ""
    Write-Host "After installing, restart PowerShell and run this script again." -ForegroundColor Yellow
    exit 1
}

# Create directories
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\Apps" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\bin" | Out-Null

# Get source code
if (Test-Path $ZIP) {
    Write-Host "[*] Extracting from ZIP..." -ForegroundColor Green
    Remove-Item -Recurse -Force $APPDIR -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "$env:USERPROFILE\Apps\resonance-main" -ErrorAction SilentlyContinue
    Expand-Archive -Path $ZIP -DestinationPath "$env:USERPROFILE\Apps"
    if (Test-Path "$env:USERPROFILE\Apps\resonance-main") {
        Rename-Item "$env:USERPROFILE\Apps\resonance-main" "resonance"
    }
} else {
    if (-not (Test-Path $APPDIR)) {
        Write-Host "[*] Cloning repository..." -ForegroundColor Green
        git clone https://github.com/pandejesal/resonance.git $APPDIR
    } else {
        Write-Host "[*] Updating repository..." -ForegroundColor Green
        Set-Location $APPDIR
        git pull
    }
}

Set-Location $APPDIR

# Create data directory
New-Item -ItemType Directory -Force -Path "data" | Out-Null

# Patch database path
Write-Host "[*] Patching database path..." -ForegroundColor Green
$mainRs = Get-Content "backend\src\main.rs" -Raw
$mainRs = $mainRs -replace '"/app/data/resonance.db"', "format!(\""sqlite:{}/Apps/resonance/data/resonance.db\"", std::env::var(\"HOME\").unwrap())"
Set-Content "backend\src\main.rs" $mainRs

# Build frontend
Write-Host "[*] Building frontend..." -ForegroundColor Green
Set-Location "$APPDIR\frontend"
npm install
npm run build
Set-Location $APPDIR

# Copy frontend to static
if (Test-Path "static") { Remove-Item -Recurse -Force "static" }
Copy-Item -Recurse "frontend\dist" "static"

if (-not (Test-Path "static\index.html")) {
    Write-Host "Frontend build failed." -ForegroundColor Red
    exit 1
}

# Build backend
Write-Host "[*] Building backend..." -ForegroundColor Green
cargo build --release

if (-not (Test-Path "target\release\resonance-backend.exe")) {
    Write-Host "Backend build failed." -ForegroundColor Red
    exit 1
}

# Create launcher script
$launcher = @'
@echo off
set APP=%USERPROFILE%\Apps\resonance
cd /d "%APP%"
mkdir data 2>nul
set DATABASE_URL=sqlite:%APP%\data\resonance.db
taskkill /f /im resonance-backend.exe 2>nul
start /b "%APP%\target\release\resonance-backend.exe" > "%APP%\logs\backend.log" 2>&1
timeout /t 2 >nul
start http://127.0.0.1:8080
echo Backend running on http://127.0.0.1:8080
'@

Set-Content "$env:USERPROFILE\bin\resonance.bat" $launcher

# Create doctor script
$doctor = @'
@echo off
cd /d "%USERPROFILE%\Apps\resonance"
echo Checking installation...
if exist "target\release\resonance-backend.exe" (echo Backend OK) else (echo Backend MISSING)
if exist "static\index.html" (echo Frontend OK) else (echo Frontend MISSING)
if exist "data" (echo Data dir OK) else (echo Data dir MISSING)
'@

Set-Content "$env:USERPROFILE\bin\resonance-doctor.bat" $doctor

# Create update script
$update = @'
@echo off
cd /d "%USERPROFILE%\Apps\resonance"
git pull
cd frontend
call npm install
call npm run build
cd ..
rmdir /s /q static
xcopy /e /i /q frontend\dist static
cargo build --release
echo Updated.
'@

Set-Content "$env:USERPROFILE\bin\resonance-update.bat" $update

# Add to PATH if not already
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$binPath = "$env:USERPROFILE\bin"
if ($userPath -notlike "*$binPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$binPath", "User")
    Write-Host "[*] Added $binPath to PATH" -ForegroundColor Green
}

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Run:" -ForegroundColor Cyan
Write-Host "  resonance" -ForegroundColor White
Write-Host "  or" -ForegroundColor Gray
Write-Host "  $env:USERPROFILE\bin\resonance.bat" -ForegroundColor White
Write-Host ""
Write-Host "Doctor:" -ForegroundColor Cyan
Write-Host "  resonance-doctor" -ForegroundColor White
Write-Host ""
Write-Host "Update:" -ForegroundColor Cyan
Write-Host "  resonance-update" -ForegroundColor White
