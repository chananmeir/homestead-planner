# Claude Code Agents for Homestead Planner

Specialized agents for debugging, implementation, synchronization validation, testing, error resolution, code review, and documentation tasks.

## What are Agents?

Agents are autonomous AI workflows launched via the `Task` tool. Each agent has deep domain knowledge, specific methodologies, and access to project-specific context. They work independently to investigate issues, implement fixes, validate sync, write tests, and document changes.

## Available Agents

### project-manager
**Purpose**: Orchestrates complex, multi-domain tasks by researching, planning, delegating to specialist agents, and verifying results. Does NOT implement code directly.

**When to use**: Multi-file changes spanning frontend + backend, tasks requiring coordination, when you don't know which specialist to use, feature planning.

**Key behavior**: Delegates all implementation to specialist agents via the Task tool. Parses `CROSS_DOMAIN_ALERT` blocks from sub-agents and chains to the appropriate counterpart. Always spawns `documentation-recorder` after successful multi-file completion.

---

### backend-debugger
**Purpose**: All backend debugging and implementation — Flask, SQLAlchemy, API endpoints, services, migrations, database queries.

**Covers**: Space calculations, succession planting logic, conflict detection, crop rotation, seed saving, export-to-calendar, garden planner season planning, indoor seed starting, nutrition calculations, and all Flask blueprint/route work.

**Key behavior**: Includes `CROSS_DOMAIN_ALERT` in output when changes require frontend updates.

---

### frontend-debugger
**Purpose**: All frontend debugging and implementation — React, TypeScript, components, state management, styling, API integration.

**Covers**: Component rendering, TypeScript errors, @dnd-kit drag-and-drop, Garden Designer visual editing, future plantings overlay, footprint calculator, seed saving UI, quick harvest filter, space calculation sync (frontend side), and all UI/UX work.

**Key behavior**: Includes `CROSS_DOMAIN_ALERT` in output when changes require backend updates.

---

### sync-validator
**Purpose**: Validates synchronization between paired backend/frontend file groups — the #1 documented risk in CLAUDE.md.

**When to use**: After any change to space calc files, plant database, SFG lookup tables, or spacing methods. Also for periodic health checks and after PM delegates work to both backend and frontend specialists.

**What it validates**: 6 sync groups — space calculator (4 files), SFG lookup (2 files), MIGardener spacing (2 files), intensive spacing (2 files), plant database (2 files), API contracts (models.py to_dict ↔ types.ts).

**Key behavior**: Read-only — never modifies files. Produces a structured sync report. Runs existing sync test suites (114 backend + 55 frontend tests).

**Model**: Sonnet (pattern matching for comparison).

---

### test-engineer
**Purpose**: Writes, maintains, and analyzes tests — pytest for backend, Jest/RTL for frontend, Playwright for E2E.

**When to use**: After feature implementations, bug fixes, or when test coverage gaps are identified. PM should delegate as a standard post-implementation step.

**What it covers**: Backend service tests, API endpoint tests, frontend component tests, E2E user flow tests, coverage analysis, test data factories.

**Key behavior**: Tests synchronized calculations on BOTH sides with identical inputs. Prioritizes edge cases (0, 1, null, max values). Runs tests after writing to verify they pass.

**Model**: Opus (deep understanding needed for meaningful tests).

---

### migration-guardian
**Purpose**: Specialized agent for database schema changes, migration safety, and data integrity.

**When to use**: Any task involving adding/modifying database columns, changing model relationships, running data migrations.

**What it covers**: Migration chain integrity, schema-model desync detection, nullable validation, FK/index verification, cascade behavior, MIGRATIONS.md updates, to_dict() sync.

**Model**: Sonnet (procedural checks).

---

### auto-error-resolver
**Purpose**: Systematic build error resolution — catalogs all errors, identifies root causes vs cascade errors, and fixes them in dependency order.

**When to use**: After the stop hook reports build errors, after multi-file changes produce compilation failures, when the user asks to "fix all errors."

**Key behavior**: Triages by priority (P1: imports → P2: type definitions → P3: component errors → P4: warnings). Documents fix patterns in agent memory.

**Model**: Sonnet (faster iteration for repetitive fix cycles).

---

### code-review
**Purpose**: Deep code review with build verification, CLAUDE.md constraint checking, anti-pattern scanning, and sync file auditing.

**When to use**: PR reviews, post-implementation quality checks, periodic codebase health audits, verifying changes follow CLAUDE.md constraints.

**Key behavior**: Runs builds, checks all CLAUDE.md rules per file, greps for anti-patterns, performs semantic sync comparison between paired files. Reports findings — never makes changes.

**Model**: Opus (deep reasoning for architectural review).

---

### documentation-recorder
**Purpose**: Records completed work for institutional knowledge — bug fixes, feature implementations, schema changes, design decisions.

**Key behavior**: Updates `dev/active/`, `dev/completed/`, `MIGRATIONS.md`, and agent memory. Proposes (but does not directly edit) CLAUDE.md changes.

---

## Cross-Domain Alert Protocol

Backend-debugger and frontend-debugger include structured `CROSS_DOMAIN_ALERT` blocks when their changes require updates in the OTHER stack:

```
CROSS_DOMAIN_ALERT:
- Modified: [file changed]
- Requires sync: [counterpart file needing update]
- What changed: [description]
- Urgency: BLOCKING | RECOMMENDED
```

The project-manager parses these blocks and dispatches the appropriate counterpart agent automatically.

## How to Launch Agents

```
# Via Task tool
subagent_type: "backend-debugger"
description: "Fix date parsing bug"
prompt: "Detailed description of the task..."
```

## Agents vs Slash Commands

| Feature | Agents | Slash Commands |
|---------|--------|----------------|
| Execution | Autonomous | Manual guidance |
| Best for | Complex multi-step tasks | Quick workflows |
| Control | Less hands-on | More interactive |

## Agent Routing Quick Reference

| Task involves... | Use agent |
|---|---|
| Frontend: React, TypeScript, components, Garden Designer, overlays | `frontend-debugger` |
| Backend: Flask, SQLAlchemy, API, services, migrations, nutrition | `backend-debugger` |
| Coordination across frontend + backend | `project-manager` |
| Verifying sync between paired backend/frontend files | `sync-validator` |
| Writing tests: pytest, Jest, Playwright | `test-engineer` |
| Database schema changes, migration safety | `migration-guardian` |
| Build errors: TypeScript compilation failures, Python import errors | `auto-error-resolver` |
| Code quality: PR reviews, CLAUDE.md compliance, sync audits | `code-review` |
| Post-task documentation | `documentation-recorder` |
| Read-only codebase exploration | `Explore` |
| Architecture/approach planning | `Plan` |

---

**Agent Count**: 9
**Last Updated**: 2026-04-11
