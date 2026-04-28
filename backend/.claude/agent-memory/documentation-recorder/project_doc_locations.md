---
name: Documentation Locations
description: Where to write different types of project documentation — dev/active for bugs, CLAUDE.md proposals to dev/active/proposed-claude-md-updates.md
type: reference
---

**Bug documentation**: `dev/active/<bug-name>/context.md` — add fix history entries with date, symptom, root cause, fix, files, and lessons learned.

**CLAUDE.md proposals**: `dev/active/proposed-claude-md-updates.md` — never edit CLAUDE.md directly; write proposed changes here for human review.

**Task tracking**: `dev/active/<task-name>/tasks.md` — update status and progress notes.

**Completed work**: `dev/completed/` — move from active when fully done (directory may not exist yet).

**Migration docs**: `MIGRATIONS.md` in project root — for database schema changes.

**Agent memory**: `.claude/agent-memory/documentation-recorder/` (project root) and `backend/.claude/agent-memory/documentation-recorder/` — persistent knowledge across sessions.

**How to apply:** Before writing documentation, always read the existing file first to avoid contradictions or duplicates. Use the fix history pattern (date header, symptom, root cause, fix, files, lessons) for consistency.
