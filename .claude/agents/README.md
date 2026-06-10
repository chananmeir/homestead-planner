# Homestead Planner Agents

This folder contains reusable agent instructions for Homestead Planner work. `AGENTS.md` is the routing map. These files are the detailed role definitions.

## How To Use

1. Identify the task domain from `AGENTS.md`.
2. Read the matching agent file before starting that slice of work.
3. Follow `CODEX.md` for the operating workflow.
4. Follow `CLAUDE.md` for full safety rules and high-risk constraints.
5. Report changed files, verification, risks, and any cross-domain needs.

## Agent List

| Agent | Use For |
|---|---|
| `frontend-debugger` | React, TypeScript, UI behavior, component state, frontend API calls |
| `backend-debugger` | Flask, SQLAlchemy, routes, services, backend data behavior |
| `project-manager` | Planning and coordinating multi-area work |
| `sync-validator` | Backend/frontend contract and paired-file consistency |
| `test-engineer` | Jest, pytest, Playwright, regression coverage |
| `migration-guardian` | Database schema and migration safety |
| `auto-error-resolver` | Build, compile, import, and syntax failures |
| `code-review` | Bug-focused review before commit or closeout |
| `documentation-recorder` | Post-task documentation and audit notes |

## Cross-Domain Alert Format

Use this block when a change in one area requires action in another area:

```text
CROSS_DOMAIN_ALERT
Source agent: <agent-name>
Other domain needed: <frontend|backend|database|tests|docs>
Reason: <specific reason>
Files/contracts affected: <paths or API payloads>
Recommended next agent: <agent-name>
END_CROSS_DOMAIN_ALERT
```

## Shared Rules

- Keep changes focused on the user's issue.
- Do not stage unrelated local files.
- Do not overwrite user work.
- Prefer focused tests first, then broader verification.
- Surface uncertainty instead of guessing.
- If the work touches database schema, API contracts, calculations, dates, Garden Designer, or Garden Planner, consult `CLAUDE.md`.

## Maintenance

Update these agent files when a lesson is reusable across future tasks: a repeated bug pattern, a changed verification command, a moved ownership area, or a new high-risk rule. Do not add one-off task notes here; put those in `dev/active/` or task reports.
