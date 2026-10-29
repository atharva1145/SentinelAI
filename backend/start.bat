@echo off
title SentinelAI Backend (FastAPI)
cd /d "%~dp0"
echo ======================================================================
echo  Starting SentinelAI Backend on http://localhost:8001
echo ======================================================================
echo.
python -m uvicorn main:app --port 8001
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Backend failed to start.
    pause
)
