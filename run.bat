@echo off
title SentinelAI Platform Launcher
cls
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Launcher encountered an error.
    pause
)
