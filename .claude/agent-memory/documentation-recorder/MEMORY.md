# Documentation Recorder - Agent Memory

## Documentation File Locations
- `CLAUDE.md` (project root): Development constraints -- PROPOSE changes only, never edit directly
- `MIGRATIONS.md` (project root): Database schema change log
- `dev/active/`: Active task documentation (plan.md, context.md, tasks.md per task)
- `dev/completed/`: Completed task documentation (move from active when done)
- `.claude/agent-memory/`: Per-agent persistent memory files
- `.claude/Agents/README.md`: Agent system documentation

## Documentation Format Conventions
- Bug docs: symptom, root cause, fix, lessons learned, files affected
- Task docs: scope, design decisions, files modified, edge cases, testing, dependencies
- Migration docs: migration file path, fields changed, nullability/defaults, rollback notes
- Always include file paths relative to project root
- Use code blocks with language identifiers
- Use inverted pyramid (most important info first)

## Case Convention Reminders
- Backend/DB: snake_case (seed_start_date)
- Frontend/API response: camelCase (seedStartDate)
- Exception: /api/plants returns mixed casing from raw PLANT_DATABASE

## Recurring Documentation Themes
- Deep-link / focus-prop patterns: callback + focus-atom (app has no URL router). See `needs-attention-deep-link.md` in user memory.
- Null-id handling: `!= null` in TS / `is not None` in Python per CLAUDE.md. Surprising `0` values are the common regression.
- Synchronized file pairs (space calc, plant DB, SFG) show up repeatedly — always enumerate all affected files in bug/feature docs.
- Id-table mismatches (e.g., `HarvestRecord.id` vs `PlantingEvent.id`) are easy to miss — flag explicitly when found.

## When to Propose CLAUDE.md Updates
- New high-risk areas discovered
- New "Common AI Mistakes to Avoid" patterns observed 3+ times
- Architecture changes affecting development constraints
- New synchronized file pairs identified
- Write proposals to `dev/active/proposed-claude-md-updates.md`
