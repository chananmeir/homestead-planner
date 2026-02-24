# Create Windows Batch Startup Scripts - Implementation Plan

**Task**: Create Windows .bat files for easy application startup
**Started**: 2025-11-11
**Completed**: 2025-11-11
**Status**: Completed Successfully

## Objective

Create user-friendly Windows batch files that allow starting the Homestead Planner application without manually using the terminal.

## Requirements Discovery

### Backend Environment
- **Location**: `backend/`
- **Virtual Environment**: `backend/venv/Scripts/activate.bat` (confirmed exists)
- **Startup Command**: `python app.py`
- **Port**: 5000
- **Server**: Flask with debug=True, host='0.0.0.0'

### Frontend Environment
- **Location**: `frontend/`
- **Package Manager**: npm
- **Startup Command**: `npm start`
- **Port**: 3000 (default for react-scripts)
- **Dependencies**: node_modules exists

## Proposed Solution

### Scripts to Create

1. **start-backend.bat**
   - Navigate to backend directory
   - Activate Python virtual environment
   - Start Flask application
   - Open in new console window with title
   - Error handling for missing venv

2. **start-frontend.bat**
   - Navigate to frontend directory
   - Check for node_modules (warn if missing)
   - Start React dev server
   - Open in new console window with title
   - Error handling for missing dependencies

3. **start-app.bat** (Master Script)
   - Start backend in separate window
   - Wait 5 seconds for backend initialization
   - Start frontend in separate window
   - Display success message with URLs
   - Minimal error handling (delegates to individual scripts)

4. **STARTUP.md** (Documentation)
   - Usage instructions
   - Troubleshooting guide
   - Prerequisites
   - What each script does

### Design Decisions

1. **Separate Windows**: Each service runs in its own console window so users can see logs
2. **Error Messages**: Clear, actionable error messages for common issues
3. **Path Handling**: Use `cd /d "%~dp0"` to handle script location correctly
4. **Wait Time**: 5-second delay between backend and frontend to ensure backend is ready
5. **No Auto-Browser**: Let npm start handle browser opening (default behavior)

### Technical Approach

- Use `@echo off` for clean output
- Use `start "Title" cmd /k command` to open persistent windows
- Use `timeout /t N /nobreak` for delays
- Use quoted paths to handle spaces
- Use `pause` on errors to keep window open
- Add color-coded output using echo statements

## Success Criteria

- [ ] User can double-click start-app.bat to launch both services
- [ ] Each service runs in its own visible console window
- [ ] Clear error messages if prerequisites missing
- [ ] Scripts work regardless of where they're run from
- [ ] Documentation explains usage and troubleshooting

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Port conflicts | Scripts check if ports in use (nice-to-have) |
| Missing dependencies | Clear error messages directing to setup docs |
| Path issues | Use `%~dp0` for script-relative paths |
| Permission issues | Document need to run as user (not admin) |

## Out of Scope

- Auto-installation of dependencies
- Service management (stop/restart beyond basic)
- Linux/Mac equivalents (focus on Windows .bat)
- GUI launcher application

---

**Last Updated**: 2025-11-11
