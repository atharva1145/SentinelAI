# SentinelAI Launcher
$ErrorActionPreference = "Continue"

$root = $PSScriptRoot
if (-not $root) {
    $root = "C:\Users\shiva\OneDrive\Desktop\Projects\SENTIN~1"
}

$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   SentinelAI - Intelligent Data Quality and Anomaly Detection" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Starting FastAPI Backend on http://localhost:8001 ..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -WorkingDirectory $backendDir -ArgumentList "/k", "python -m uvicorn main:app --port 8001"

Write-Host "[2/3] Starting React Frontend on http://localhost:5174 ..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -WorkingDirectory $frontendDir -ArgumentList "/k", "npm.cmd run dev"

Write-Host "[3/3] Initializing servers (waiting 6 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 6

Write-Host ""
Write-Host "Opening SentinelAI Web App at http://localhost:5174 ..." -ForegroundColor Green
Start-Process "http://localhost:5174"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " SentinelAI is running!" -ForegroundColor Green
Write-Host " - Frontend Web App:     http://localhost:5174" -ForegroundColor White
Write-Host " - Interactive API Docs: http://localhost:8001/docs" -ForegroundColor White
Write-Host " - Backend Health Check: http://localhost:8001/health" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Keep the Backend and Frontend terminal windows open." -ForegroundColor Gray
Write-Host "Press any key to close this launcher..." -ForegroundColor Gray
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    Start-Sleep -Seconds 2
}
