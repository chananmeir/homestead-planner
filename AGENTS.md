# Repository Guidelines

## Agent System (9 Agents)

This project uses a multi-agent system for autonomous development. See `.claude/Agents/README.md` for full details.

### Agent Routing Quick Reference

| Task involves... | Use agent |
|---|---|
| Frontend: React, TypeScript, components, Garden Designer, overlays | `frontend-debugger` |
| Backend: Flask, SQLAlchemy, API, services, migrations, nutrition | `backend-debugger` |
| Coordination across frontend + backend | `project-manager` |
| Verifying sync between paired backend/frontend files | `sync-validator` |
| Writing tests: pytest, Jest, Playwright | `test-engineer` |
| Database schema changes, migration safety | `migration-guardian` |
| Build errors: TypeScript compilation, Python imports | `auto-error-resolver` |
| Code quality: PR reviews, CLAUDE.md compliance | `code-review` |
| Post-task documentation | `documentation-recorder` |

### Cross-Domain Alert Protocol

Backend-debugger and frontend-debugger include `CROSS_DOMAIN_ALERT` blocks in their output when changes require updates in the OTHER stack. The project-manager parses these and dispatches the appropriate specialist.

## Project Structure & Module Organization
- `backend/` contains the Flask API, SQLAlchemy models, migrations, and service layer logic. Critical business code lives in `backend/services/` (e.g., `space_calculator.py`) and blueprints under `backend/blueprints/`.
- `frontend/` hosts the React + TypeScript client; source lives under `frontend/src/`, static assets in `frontend/public/`, and plant data helpers in `frontend/src/data/`.
- Shared docs such as `claude.md`, `dev/active/`, and automation scripts in `scripts/` capture team processes; keep them in sync with new workflows.
- Tests currently live beside their domains (Python tests in `backend/tests/`, UI tests in `frontend/src/__tests__/`). Mirror directory layout when adding new suites.

## Build, Test, and Development Commands
- `start-backend.bat` / `start-frontend.bat`: launch the Flask API on :5000 and React dev server on :3000 with sensible defaults.
- `cd backend && flask db migrate && flask db upgrade`: manage schema changes exclusively through Flask-Migrate; never touch the SQLite file directly.
- `cd backend && python -m pytest`: run backend unit and service tests; required before merging backend changes.
- `cd frontend && npm run build`: performs a type-safe production build; run `npm test` for unit/component suites when available.

## Coding Style & Naming Conventions
- Python follows PEP 8: 4-space indent, snake_case fields, explicit `is not None` checks for nullable overrides, and service functions in `backend/services/`.
- TypeScript uses camelCase props, PascalCase components, and shared types in `frontend/src/types.ts`; keep backend `to_dict()` converters aligned with frontend DTOs.
- Space-calculation constants exist in four synced files (`backend/services/space_calculator.py`, `backend/plant_database.py`, `frontend/src/utils/gardenPlannerSpaceCalculator.ts`, `frontend/src/utils/sfgSpacing.ts`). Touch all or none to prevent regressions.
- Prefer descriptive file-scoped comments for complex logic; otherwise keep code-comment noise low.

## Testing Guidelines
- Name Python tests `test_<unit>.py`; colocate fixtures near the modules under test (`backend/tests/services/`).
- Frontend tests should mirror component folders and use `.test.tsx`. Mock API calls with the existing utilities under `frontend/src/utils/__mocks__/`.
- Gate regressions by running `python -m pytest` plus `npm run build` before every pull request; document any skipped suites and why.

## Commit & Pull Request Guidelines
- Commits are short, present-tense summaries (`Fix succession planting space calculation race condition`). Squash noisy WIP history locally.
- Every PR description should include: purpose, scope, risk assessment (especially around planning math or migrations), test evidence (`python -m pytest`, `npm run build` output), and any migration/rollback notes.
- Link the relevant Linear/GitHub issue and attach screenshots or JSON payloads when UI or API changes affect user-visible flows.

## Security & Configuration Tips
- Never hardcode secrets; backend configs belong in environment variables or `instance/config.py`. Frontend API targets go into `frontend/.env.local` (e.g., `REACT_APP_API_URL`).
- Treat the SQLite DB under `backend/instance/` as disposable; reseed via migrations instead of editing it manually.
