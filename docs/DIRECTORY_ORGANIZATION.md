# Directory Organization

This document describes the project directory structure and organization.

## Root Directory Structure

```
homestead-planner/
├── backend/              # Flask backend application
├── frontend/             # React frontend application
├── dev/                  # Development documentation (active/completed/future tasks)
├── docs/                 # Project documentation
├── scripts/              # Utility scripts
├── tests/                # Test files
├── .claude/              # Claude Code configuration
├── CLAUDE.md             # Claude Code guidelines
├── README.md             # Main project README
├── package.json          # Node.js package configuration
├── package-lock.json     # Lock file for dependencies
├── start-app.bat         # Windows script to start both backend & frontend
├── start-backend.bat     # Windows script to start backend only
└── start-frontend.bat    # Windows script to start frontend only
```

## Directory Purposes

### `/backend/`
Flask/Python backend application containing:
- `app.py` - Main Flask application
- `models.py` - Database models
- `plant_database.py` - Plant data
- `instance/` - SQLite database files
- Migration scripts and utilities

### `/frontend/`
React/TypeScript frontend application containing:
- `src/` - Source code
- `public/` - Public assets including plant icons
- `node_modules/` - Dependencies

### `/dev/`
Development task documentation:
- `active/` - Current tasks in progress
- `completed/` - Finished tasks
- `future-enhancements/` - Planned features
- Each task has plan.md, context.md, and tasks.md files

### `/docs/`
Project documentation including:
- Feature plans and specifications
- Implementation guides
- Session summaries
- Analysis reports

### `/scripts/`
Utility scripts for:
- Code fixes and patches
- Data migrations
- Authentication setup
- ESLint fixes

### `/tests/`
Test files for:
- Backend functionality
- Frontend features
- Search logic
- Import/export functionality

## .BAT Files (Windows Launch Scripts)

The .bat files remain in the root for easy access:

- **start-app.bat** - Starts both backend and frontend
- **start-backend.bat** - Starts only the backend (port 5000)
- **start-frontend.bat** - Starts only the frontend (port 3000)

Double-click these files to launch the application quickly.

## Key Files in Root

- **CLAUDE.md** - Guidelines for Claude Code development
- **README.md** - Main project documentation
- **package.json** - Node.js configuration (for root-level scripts)

## Organization Rules

1. **Documentation** → `/docs/`
   - All .md files except CLAUDE.md and README.md
   - Session summaries
   - Feature documentation

2. **Scripts** → `/scripts/`
   - Python utility scripts
   - JavaScript fix scripts
   - Patch files

3. **Tests** → `/tests/`
   - All test-*.js files
   - Test specifications

4. **Keep in Root**
   - .bat files (for easy access)
   - CLAUDE.md (used by Claude Code)
   - README.md (standard location)
   - package.json/package-lock.json (Node.js standard)

5. **Delete**
   - Temporary files (tmpclaude-*, nul)
   - Cookie files
   - Malformed directory paths

## Maintenance

- Clean up temporary files regularly
- Archive old scripts that are no longer needed
- Move session summaries to an archive after a few months
- Keep root directory clean with only essential files

---

**Last Organized**: 2026-01-12
