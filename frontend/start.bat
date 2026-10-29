@echo off
title SentinelAI Frontend (Vite)
cd /d "%~dp0"
echo ======================================================================
echo  Starting SentinelAI Frontend on http://localhost:5174
echo ======================================================================
echo.
call npm.cmd run dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Frontend failed to start.
    pause
)
