# Homestead Planner - Startup Scripts Guide

This guide explains how to use the Windows batch files to start the Homestead Planner application.

## Quick Start

**Easiest Method**: Double-click `start-app.bat` in the project root directory.

This will automatically start both the backend and frontend servers in separate console windows.

## Prerequisites

Before using the startup scripts, ensure you have completed the initial setup:

### Backend Setup
1. Python 3.7+ installed
2. Virtual environment created in `backend/venv/`
3. Dependencies installed: `pip install -r backend/requirements.txt`

See `backend/README.md` for detailed setup instructions.

### Frontend Setup
1. Node.js and npm installed
2. Dependencies installed: `npm install` (from frontend directory)

See `frontend/README.md` for detailed setup instructions.

## Available Scripts

### 1. `start-app.bat` (Recommended)

**Purpose**: Master script that starts both backend and frontend servers.

**Usage**: Double-click the file or run from command prompt:
```
start-app.bat
```

**What it does**:
- Opens a new console window for the backend server (port 5000)
- Waits 5 seconds for backend initialization
- Opens a new console window for the frontend server (port 3000)
- Browser opens automatically to http://localhost:3000

**To stop**: Close both console windows or press Ctrl+C in each window.

---

### 2. `start-backend.bat`

**Purpose**: Starts only the Flask backend server.

**Usage**: Double-click the file or run from command prompt:
```
start-backend.bat
```

**What it does**:
- Activates the Python virtual environment
- Starts Flask app on http://localhost:5000
- Shows server logs in the console

**When to use**:
- Testing backend changes without frontend
- Running backend independently
- Debugging backend issues

**To stop**: Close the console window or press Ctrl+C.

---

### 3. `start-frontend.bat`

**Purpose**: Starts only the React development server.

**Usage**: Double-click the file or run from command prompt:
```
start-frontend.bat
```

**What it does**:
- Starts React dev server on http://localhost:3000
- Opens browser automatically
- Shows build logs and errors in the console

**When to use**:
- Testing frontend changes with an already-running backend
- Running frontend independently
- Debugging frontend issues

**To stop**: Close the console window or press Ctrl+C.

---

## Troubleshooting

### Error: "Virtual environment not found"

**Problem**: The backend script cannot find the Python virtual environment.

**Solution**:
1. Navigate to `backend/` directory
2. Create virtual environment: `python -m venv venv`
3. Activate it: `venv\Scripts\activate`
4. Install dependencies: `pip install -r requirements.txt`

See `backend/SETUP_MIGRATIONS.md` for detailed setup.

---

### Warning: "node_modules directory not found"

**Problem**: Frontend dependencies are not installed.

**Solution**:
1. Navigate to `frontend/` directory
2. Run: `npm install`
3. Wait for installation to complete
4. Try starting the frontend again

---

### Error: "Port already in use"

**Problem**: Another application is using port 5000 or 3000.

**Symptoms**:
- Backend fails with "Address already in use" error
- Frontend shows "Something is already running on port 3000"

**Solution**:

**For Backend (port 5000)**:
1. Find what's using port 5000:
   ```
   netstat -ano | findstr :5000
   ```
2. Stop that process or change Flask port in `backend/app.py`

**For Frontend (port 3000)**:
1. When prompted, press 'Y' to run on a different port
2. Or stop the other application using port 3000

---

### Browser doesn't open automatically

**Problem**: Browser should open to http://localhost:3000 but doesn't.

**Solution**:
1. Manually open your browser
2. Navigate to: http://localhost:3000
3. Check frontend console for errors

---

### Backend window closes immediately

**Problem**: Backend crashes on startup.

**Possible causes**:
- Database migration needed
- Missing dependencies
- Python syntax error

**Solution**:
1. Run `start-backend.bat` separately to see error message
2. Check if migrations are up to date:
   ```
   cd backend
   venv\Scripts\activate
   flask db upgrade
   ```
3. Verify all dependencies installed:
   ```
   pip install -r requirements.txt
   ```

---

### Frontend shows "Failed to compile"

**Problem**: Frontend build errors prevent server from starting.

**Solution**:
1. Check the console window for specific error messages
2. Common issues:
   - TypeScript errors: Fix type issues in source code
   - Missing imports: Add missing dependencies
   - Syntax errors: Review recent code changes
3. See `frontend/README.md` for debugging tips

---

## How the Scripts Work

### Technical Details

**Path Resolution**: Scripts use `%~dp0` to find their location, so they work regardless of where they're run from.

**Virtual Environment**: Backend script automatically activates the Python venv before running.

**Persistent Windows**: Scripts use `cmd /k` to keep console windows open so you can see logs.

**Timing**: Master script waits 5 seconds between starting backend and frontend to ensure backend is ready.

### Console Windows

When using `start-app.bat`, you'll see three windows:
1. **Launcher window**: Shows startup progress (can be closed after launch)
2. **Backend window**: Shows Flask logs (keep open while using app)
3. **Frontend window**: Shows React dev server logs (keep open while using app)

### Stopping the Application

To completely stop the application:
1. Close the "Backend" console window (or press Ctrl+C)
2. Close the "Frontend" console window (or press Ctrl+C)
3. The launcher window can be closed anytime

**Important**: Make sure to stop both servers to free up ports 5000 and 3000.

---

## Development Workflow

### Typical Workflow

1. **Morning startup**:
   - Double-click `start-app.bat`
   - Wait for both servers to start
   - Browser opens automatically

2. **During development**:
   - Leave both console windows open
   - Watch for errors in console logs
   - Frontend auto-reloads on code changes
   - Backend requires manual restart for most changes

3. **End of day**:
   - Close both console windows
   - Or press Ctrl+C in each window

### Restarting After Changes

**Frontend changes**: Usually auto-reload, no restart needed

**Backend changes**:
1. Go to backend console window
2. Press Ctrl+C to stop
3. Press Up arrow, then Enter to restart
4. Or close window and run `start-backend.bat` again

---

## Additional Resources

- **Full Setup Guide**: See `README.md` in project root
- **Backend Documentation**: `backend/README.md`
- **Frontend Documentation**: `frontend/README.md`
- **Database Migrations**: `backend/SETUP_MIGRATIONS.md`
- **Project Guidelines**: `CLAUDE.md`

---

## Quick Reference

| Script | Purpose | Port | Auto-Open Browser |
|--------|---------|------|-------------------|
| `start-app.bat` | Start both servers | 5000 & 3000 | Yes (via frontend) |
| `start-backend.bat` | Backend only | 5000 | No |
| `start-frontend.bat` | Frontend only | 3000 | Yes |

**URLs**:
- Backend API: http://localhost:5000
- Frontend App: http://localhost:3000

---

**Last Updated**: 2025-11-11
