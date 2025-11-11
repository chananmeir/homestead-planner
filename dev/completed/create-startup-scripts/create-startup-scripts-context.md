# Create Windows Batch Startup Scripts - Context

**Task**: Create Windows .bat files for easy application startup
**Last Updated**: 2025-11-11

## Key Files

### Project Structure
```
C:\Users\march\Downloads\homesteader\homestead-planner\
├── backend/
│   ├── venv/
│   │   └── Scripts/
│   │       └── activate.bat     [Confirmed exists]
│   └── app.py                   [Main Flask app]
├── frontend/
│   ├── node_modules/            [Confirmed exists]
│   └── package.json             [npm scripts defined]
└── [NEW] Batch files to create
```

### Backend Details (app.py)
- **Entry Point**: `if __name__ == '__main__':`
- **Startup**: `app.run(debug=True, host='0.0.0.0', port=5000)`
- **Database**: Auto-creates tables on startup
- **Dependencies**: Managed via venv

### Frontend Details (package.json)
- **Start Script**: `"start": "react-scripts start"`
- **Default Port**: 3000 (react-scripts default)
- **Auto-Open**: Browser opens automatically by default

## Technical Decisions

### Why Separate Console Windows?
- Users can see real-time logs from both services
- Easy to stop services (close window or Ctrl+C)
- Debugging is easier with visible output
- Matches development workflow expectations

### Why 5-Second Delay?
- Backend needs time to:
  - Initialize database
  - Load all models and routes
  - Start Flask server
- Frontend makes API calls on load, needs backend ready
- Conservative timing to ensure reliability

### Path Resolution Strategy
```batch
@echo off
cd /d "%~dp0"
```
- `%~dp0` = directory containing the batch file
- `cd /d` = change drive and directory
- Ensures scripts work when double-clicked from Explorer

### Error Handling Philosophy
- Check for prerequisites (venv, node_modules)
- Display clear error messages
- Keep window open on error (`pause`)
- Direct users to setup documentation

## Windows Batch File Syntax Reference

### Key Commands Used
```batch
@echo off                          :: Suppress command echo
cd /d "%~dp0"                      :: Go to script directory
if exist path (command) else (cmd) :: Conditional execution
start "Title" cmd /k command       :: Open new persistent window
timeout /t 5 /nobreak              :: Wait 5 seconds
pause                              :: Wait for keypress
echo.                              :: Print blank line
```

### Console Window Options
- `/k` = Keep window open after command completes
- `/c` = Close window after command completes
- We use `/k` so users can see logs and manually stop services

## Environment Notes

### Verified Paths
- Backend venv: `C:\Users\march\Downloads\homesteader\homestead-planner\backend\venv\Scripts\activate.bat`
- Frontend deps: `C:\Users\march\Downloads\homesteader\homestead-planner\frontend\node_modules\`

### Port Configuration
- Backend: 5000 (hardcoded in app.py)
- Frontend: 3000 (default from react-scripts)
- No port conflicts expected in typical dev environment

## User Experience Considerations

### Success Flow
1. User double-clicks `start-app.bat`
2. Backend window opens, shows Flask startup logs
3. 5-second pause
4. Frontend window opens, shows React dev server logs
5. Browser opens automatically to http://localhost:3000
6. User sees success message with URLs

### Error Flows

**Missing venv**: Backend script shows error, pauses for user to read
**Missing node_modules**: Frontend script suggests running `npm install`
**Port in use**: Service fails with error visible in console

## Integration Points

### CLAUDE.md Alignment
- Scripts align with documented Quick Start Commands
- Backend activation: `venv\Scripts\activate` (Windows)
- Frontend start: `npm start`
- Ports match documented values (5000, 3000)

### Documentation to Create
- STARTUP.md with:
  - Prerequisites (Python venv setup, npm install completed)
  - How to use each script
  - Troubleshooting common errors
  - Links to full setup docs

## Testing Considerations

### What to Verify
- [ ] Scripts execute without syntax errors
- [ ] Paths resolve correctly
- [ ] Virtual environment activates
- [ ] Backend starts on port 5000
- [ ] Frontend starts on port 3000
- [ ] Error messages display correctly
- [ ] Windows stay open for viewing logs

### Manual Testing Required
- Double-click from Windows Explorer (not just command line)
- Test on system without ports in use
- Test error cases (rename venv temporarily, etc.)

---

**Last Updated**: 2025-11-11
