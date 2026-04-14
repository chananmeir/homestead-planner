@echo off
REM ===================================================================
REM Homestead Planner - Frontend Startup Script
REM ===================================================================
REM This script starts the React development server on port 3000
REM ===================================================================

echo.
echo ========================================
echo  Homestead Planner - Frontend Server
echo ========================================
echo.

REM Get the directory where this script is located
cd /d "%~dp0"

REM Check if node_modules exists
if not exist "frontend\node_modules\" (
    echo [WARNING] node_modules directory not found!
    echo.
    echo You may need to install dependencies first:
    echo   1. Navigate to the frontend directory
    echo   2. Run: npm install
    echo.
    echo Attempting to start anyway...
    echo.
    timeout /t 3 /nobreak >nul
)

echo [1/2] Navigating to frontend directory...
cd frontend

echo [2/2] Starting React development server...
echo.
echo Frontend will be available at: http://localhost:3000
echo Browser will open automatically...
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

npm start

REM If we get here, the server stopped or failed
echo.
echo.
echo ========================================
echo Frontend server stopped.
echo ========================================
pause
