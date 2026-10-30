@echo off
title SentinelAI Git Sync & Push
cd /d "%~dp0"
cls
echo ======================================================================
echo    SentinelAI - Automatic Git Commit and Push to GitHub
echo ======================================================================
echo.
git add .
set /p commit_msg="Enter commit message (or press ENTER for default update): "
if "%commit_msg%"=="" set commit_msg=update: project refinements and improvements
git commit -m "%commit_msg%"
echo.
echo Pushing changes to https://github.com/atharva1145/SentinelAI ...
git push origin main
echo.
echo ======================================================================
echo  Successfully synced to GitHub!
echo ======================================================================
echo.
pause
