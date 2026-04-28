---
description: Update dev docs before context compaction to preserve progress and context
---

# Dev Docs Update - Pre-Compaction

Update dev docs before context compaction to preserve progress and context.

## Instructions

Before compacting context, update the dev docs to ensure no progress or important context is lost.

### 1. Find Active Task

Look in `dev/active/` for the current task directory:

```bash
ls dev/active/
```

If no active task, inform the user and exit.

### 2. Update Context File

Update `dev/active/[task-name]/[task-name]-context.md`:

**Add/Update Sections**:

**Current State**:
- What has been completed so far
- What is currently in progress
- What is not yet started

**Recent Decisions**:
- Any new architectural decisions made
- Why those decisions were made
- Alternatives considered

**Discoveries & Learnings**:
- Things learned during implementation
- Gotchas discovered
- Patterns that worked well
- Patterns that didn't work

**Technical Context**:
- New files created
- Files modified significantly
- Key code locations (file:line)
- Integration points

**Next Steps** (CRITICAL):
- Immediate next action to take
- Following 2-3 actions
- Any blockers or uncertainties
- Specific file/function to work on next

**Last Updated**: [Current timestamp]

### 3. Update Tasks File

Update `dev/active/[task-name]/[task-name]-tasks.md`:

**Mark Completed Tasks**:
- Check off all tasks that are done (✅)
- Be honest - partial work is NOT completed

**Add New Tasks**:
- Tasks discovered during implementation
- Unexpected work that needs doing

**Update Blockers**:
- Tasks that are blocked and why
- Tasks deferred and why

**Update Progress**:
- Count of completed tasks
- Percentage progress

**Last Updated**: [Current timestamp]

### 4. Quick Status Update in Plan

Update `dev/active/[task-name]/[task-name]-plan.md`:

Add a **Progress Update** section at the top:

```markdown
## Progress Update - [Date]

**Status**: [In Progress / Blocked / Nearly Complete]
**Completed Phases**: [List]
**Current Phase**: [Name]
**Blockers**: [None / List]

**Summary**: 1-2 sentences on current state
```

### 5. Verify Critical Info Captured

Double-check these are documented:

- ✅ Next immediate action is clear
- ✅ Important decisions are recorded with rationale
- ✅ Completed work is marked
- ✅ Any blockers or issues are noted
- ✅ File locations for key code are listed
- ✅ Integration points are documented

### 6. Present Summary

Show the user:

1. **What was completed** since last update
2. **Current state** of the task
3. **Next steps** clearly outlined
4. **Updated timestamps** on all files

## Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 DEV DOCS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task: [task-name]

✅ Completed:
   - [List completed items]

🔄 In Progress:
   - [Current work]

📋 Next Steps:
   1. [Immediate next action]
   2. [Following action]
   3. [After that]

📊 Progress: X/Y tasks completed (Z%)

⏰ Files Updated:
   - context.md (Last Updated: timestamp)
   - tasks.md (Last Updated: timestamp)
   - plan.md (Progress Update added)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ready for context compaction!
After compaction, read these files to continue.
```

## Important Notes

- Be thorough - this is your memory after compaction
- Focus on "why" not just "what"
- Be specific about next steps
- Update ALL timestamps
- Don't mark tasks complete unless truly done
- Document blockers and uncertainties
- Include file paths with line numbers when relevant

## Example Usage

```
/dev-docs-update

I'm running low on context and need to compact soon.
Update the dev docs for the current task.
```

The command will:
1. Find the active task
2. Update all three dev docs files
3. Ensure next steps are crystal clear
4. Present a summary

---

**Remember**: These docs are your lifeline after compaction. Make them count!
