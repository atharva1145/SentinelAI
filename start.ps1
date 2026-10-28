# SentinelAI 1-Click PowerShell Launcher
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   SentinelAI — Intelligent Data Quality & Anomaly Detection Platform" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Item -LiteralPath ".").FullName }

$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

Write-Host "[1/3] Starting Backend API on http://localhost:8000 ..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$backendDir`" && python -m uvicorn main:app --port 8000"

Write-Host "[2/3] Starting Frontend Dashboard on http://localhost:5173 ..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$frontendDir`" && npm.cmd run dev"

Write-Host "[3/3] Waiting for servers to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 4

Write-Host "Redirecting to browser at http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "SentinelAI is live!" -ForegroundColor Green
Write-Host "- Dashboard: http://localhost:5173"
Write-Host "- API Docs:  http://localhost:8000/docs"
