@echo off
REM ===================================================================
REM Homestead Planner - Backend Startup Script
REM ===================================================================
REM This script starts the Flask backend server on port 5000
REM ===================================================================

echo.
echo ========================================
echo  Homestead Planner - Backend Server
echo ========================================
echo.

REM Get the directory where this script is located
cd /d "%~dp0"

REM Check if virtual environment exists
if not exist "backend\venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found!
    echo.
    echo Expected location: backend\venv\Scripts\activate.bat
    echo.
    echo Please set up the Python virtual environment first:
    echo   1. Navigate to the backend directory
    echo   2. Run: python -m venv venv
    echo   3. Run: venv\Scripts\activate
    echo   4. Run: pip install -r requirements.txt
    echo.
    echo See backend\README.md for detailed setup instructions.
    echo.
    pause
    exit /b 1
)

echo [1/3] Navigating to backend directory...
cd backend

echo [2/3] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/3] Starting Flask backend server...
echo.
echo Backend will be available at: http://localhost:5000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

python app.py

REM If we get here, the server stopped or failed
echo.
echo.
echo ========================================
echo Backend server stopped.
echo ========================================
pause
