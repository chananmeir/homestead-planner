# Codex Startup Prompt

Copy and paste this at the start of a new Codex session for this repository:

```text
Read CODEX.md and follow it for this repo.

Then read AGENTS.md and use the agent files in .claude/agents when the task matches one.

Check git status before making changes.

Use CLAUDE.md as the full safety reference when the task touches backend, database, API contracts, date handling, calculations, Garden Designer, Garden Planner, migrations, or any other high-risk area.

Before editing files, tell me which area the task belongs to: frontend, backend, database, tests, docs, or cross-domain.

Make small focused changes, stage only task-related files, run the relevant focused tests/build, and only commit or push when I explicitly ask.
```

## Expected Session Behavior

After this prompt, Codex should:

- Read `CODEX.md`.
- Read `AGENTS.md`.
- Check `git status --short`.
- Open the matching `.claude/agents/*.md` file when the task fits an agent.
- Read `CLAUDE.md` for high-risk work.
- Preserve unrelated local changes.
- Avoid staging local-only files listed in `CODEX.md`.
- Commit only when asked.
- Push only when asked.
