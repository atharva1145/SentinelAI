@echo off
title SentinelAI Platform Launcher
cls
echo ======================================================================
echo    SentinelAI — Intelligent Data Quality & Anomaly Detection Platform
echo ======================================================================
echo.

set "PROJECT_DIR=%~dp0"

echo [1/3] Starting FastAPI Backend on http://localhost:8000 ...
start "SentinelAI Backend (FastAPI)" cmd /k "cd /d "%PROJECT_DIR%backend" && python -m uvicorn main:app --port 8000"

echo [2/3] Starting React Frontend on http://localhost:5173 ...
start "SentinelAI Frontend (Vite)" cmd /k "cd /d "%PROJECT_DIR%frontend" && npm.cmd run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 4 /nobreak >nul

echo.
echo Launching SentinelAI in your default web browser...
start http://localhost:5173

echo.
echo ======================================================================
echo  SentinelAI is running!
echo  - Frontend Dashboard: http://localhost:5173
echo  - Interactive Swagger API Docs: http://localhost:8000/docs
echo  - Health Check: http://localhost:8000/health
echo.
echo  Keep the backend and frontend terminal windows open.
echo ======================================================================
pause
