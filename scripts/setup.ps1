param(
    [switch]$SkipPython,
    [switch]$SkipNode,
    [switch]$SkipDB
)

$ErrorActionPreference = "Stop"

Write-Host "Setting up Study Assistant..." -ForegroundColor Cyan

if (-Not $SkipPython) {
    Write-Host "`n[1/4] Setting up Python Backend..." -ForegroundColor Yellow
    if (-Not (Test-Path "backend\.venv")) {
        Write-Host "Creating Python virtual environment in backend\.venv..."
        python -m venv backend\.venv
    }
    
    Write-Host "Installing backend dependencies..."
    & "backend\.venv\Scripts\python.exe" -m pip install -e "backend[ai,test]"
}

if (-Not $SkipNode) {
    Write-Host "`n[2/4] Setting up Node Frontend..." -ForegroundColor Yellow
    Set-Location "frontend"
    npm install
    Set-Location ".."
}

if (-Not $SkipDB) {
    Write-Host "`n[3/4] Running Database Migrations & Seeding..." -ForegroundColor Yellow
    Write-Host "Ensure PostgreSQL is running locally with the credentials in .env!"
    
    # Run alembic migrations
    Set-Location "backend"
    & ".\.venv\Scripts\alembic.exe" upgrade head
    
    # Run DB seed
    & ".\.venv\Scripts\python.exe" -m app.seed
    Set-Location ".."
}

Write-Host "`n[4/4] Setup Complete!" -ForegroundColor Green
Write-Host "You can now run '.\scripts\doctor.ps1' to verify prerequisites, or '.\scripts\start-dev.ps1' to start the application."
