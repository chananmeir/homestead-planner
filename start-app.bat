@echo off
REM ===================================================================
REM Homestead Planner - Master Startup Script
REM ===================================================================
REM This script starts both backend and frontend servers
REM ===================================================================

echo.
echo ============================================================
echo           HOMESTEAD PLANNER - Application Launcher
echo ============================================================
echo.
echo This will start both the backend and frontend servers
echo in separate console windows.
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo ============================================================
echo.

REM Get the directory where this script is located
cd /d "%~dp0"

REM Start backend in a new window
echo [1/3] Starting backend server...
start "Homestead Planner - Backend (Port 5000)" cmd /k "%~dp0start-backend.bat"

REM Wait for backend to initialize
echo [2/3] Waiting for backend to initialize (5 seconds)...
timeout /t 5 /nobreak >nul

REM Start frontend in a new window
echo [3/3] Starting frontend server...
start "Homestead Planner - Frontend (Port 3000)" cmd /k "%~dp0start-frontend.bat"

REM Display success message
echo.
echo ============================================================
echo  SUCCESS! Application is starting...
echo ============================================================
echo.
echo Two console windows have been opened:
echo   - Backend Server (Flask) on port 5000
echo   - Frontend Server (React) on port 3000
echo.
echo Your browser should open automatically to:
echo   http://localhost:3000
echo.
echo To stop the application:
echo   - Close both console windows, or
echo   - Press Ctrl+C in each window
echo.
echo ============================================================
echo.
echo You can close this window now.
echo.

pause
