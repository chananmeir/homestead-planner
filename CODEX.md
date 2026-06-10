# Codex Workflow

This file is the short operating guide for Codex work in this repository. Use `CLAUDE.md` as the full safety reference and `AGENTS.md` as the agent-routing reference.

## Startup Checklist

1. Read `AGENTS.md`.
2. Read this file.
3. Read `CLAUDE.md` when the task touches backend, database, API contracts, date handling, calculations, Garden Designer, Garden Planner, or other high-risk areas.
4. Check `git status --short` before edits.
5. Identify the task domain: frontend, backend, database, tests, docs, or cross-domain.
6. Check `dev/active/` when the user references an audit, plan, report, or previous developer handoff.

## Local-Only Files

These are known local/untracked items. Do not stage or delete them unless the user explicitly asks:

- `.claude/settings.local.json`
- `.claude/agent-memory/`
- `.claude/commands/agents/agents - Shortcut.lnk`
- `This PC - Shortcut.lnk`
- `docs/homestead-planner - Shortcut.lnk`
- `frontend/playwright-report/`
- `frontend/test-results/`

## Working Rules

- Make small, focused changes that directly address the user's issue.
- Do not refactor unrelated code while fixing a bug.
- Stage only files related to the task.
- Commit only when the user asks.
- Push only when the user asks.
- Never use destructive git commands unless the user explicitly approves them.
- Preserve user changes in the working tree.
- For frontend changes, run focused Jest tests when available, then `npm run build`.
- For backend changes, run focused pytest tests when available.
- For database schema changes, use Flask-Migrate only. Do not edit SQLite directly.

## Agent Use

Detailed agent instructions live in `.claude/agents/`.

When a task clearly matches an agent, read that agent file before working. For cross-domain work, read `project-manager.md` first, then the specialist files it routes to.

Default to working directly for small issues.

Use or recommend agents when:

- The work crosses frontend and backend.
- A database migration is involved.
- A feature needs UI, API, tests, and docs.
- The bug location is unclear and parallel investigation would save time.
- A risky change needs review before commit.

Recommended routing:

- Frontend UI/component bugs: `frontend-debugger`
- Flask/API/service bugs: `backend-debugger`
- Frontend/backend contract mismatch: `sync-validator`
- Database migration safety: `migration-guardian`
- Test coverage or failing suites: `test-engineer`
- Cross-domain features: `project-manager`
- Pre-commit risk review: `code-review`

## Updating Agent Files

Update an agent file when:

- We discover a repeatable mistake that agent should prevent.
- A workflow changes, such as a new required test command or verification step.
- A repo structure change moves files that the agent owns.
- A new API contract, migration rule, date rule, or sync rule affects that agent.
- A completed task produces a reusable checklist that would help future work.

Do not update agent files for one-off task details. Put task-specific notes in `dev/active/` or the relevant report instead.

## High-Risk Reminders

- Keep backend snake_case and frontend camelCase API contracts aligned.
- Use explicit `is not None` / `!= null` checks for nullable numeric values.
- Use `backend/utils/helpers.py::parse_iso_date()` for inbound backend dates.
- Use `frontend/src/utils/dateUtils.ts::parseLocalDate()` for frontend local-date parsing.
- Keep space-calculation and plant-data files synchronized across backend and frontend.
- Treat `CLAUDE.md` as authoritative for detailed constraints and verification guidance.
