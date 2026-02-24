# Dev Docs System

This directory contains the development documentation system for tracking tasks, context, and decisions throughout the development of Homestead Planner.

## Purpose

The dev docs system helps prevent "losing the plot" during complex development tasks by:
- Maintaining clear plans and objectives
- Tracking important context and decisions
- Providing task checklists to ensure nothing is forgotten
- Surviving context compactions and session changes

## Directory Structure

```
dev/
├── README.md              # This file
├── PROJECT_ARCHITECTURE.md  # Overall system architecture
├── active/                # Current/in-progress tasks
│   └── [task-name]/
│       ├── [task-name]-plan.md
│       ├── [task-name]-context.md
│       └── [task-name]-tasks.md
├── completed/             # Finished tasks (archive)
│   └── [task-name]/
│       └── ...
└── templates/             # Templates for new tasks
    ├── task-plan-template.md
    ├── task-context-template.md
    └── task-tasks-template.md
```

## Workflow

### Starting a New Task

1. **Create Task Directory**:
   ```bash
   mkdir -p dev/active/my-new-feature
   ```

2. **Copy Templates**:
   ```bash
   cp dev/templates/task-plan-template.md dev/active/my-new-feature/my-new-feature-plan.md
   cp dev/templates/task-context-template.md dev/active/my-new-feature/my-new-feature-context.md
   cp dev/templates/task-tasks-template.md dev/active/my-new-feature/my-new-feature-tasks.md
   ```

3. **Fill Out the Plan**:
   - Use planning mode in Claude Code
   - Document objectives, approach, phases
   - Review and approve before starting implementation

4. **Begin Implementation**:
   - Work through tasks one by one
   - Update context.md with important decisions
   - Mark completed tasks immediately

### During Development

**Update Context Frequently**:
- Document why decisions were made
- Note important file locations
- Record discoveries and gotchas
- Track dependencies and integrations

**Keep Tasks Current**:
- Mark tasks complete immediately
- Add new tasks as they're discovered
- Note blockers and deferred items
- Update "Last Updated" timestamps

**Before Context Compaction**:
- Update context.md with current state
- Mark completed tasks
- Note next steps clearly
- Update "Last Updated" timestamps

### Continuing After a Break

1. **Check Active Tasks**:
   ```bash
   ls dev/active/
   ```

2. **Read All Three Files**:
   - Plan: Understand the overall approach
   - Context: Get important details and decisions
   - Tasks: See what's done and what's next

3. **Update Timestamps**:
   - Update "Last Updated" in all three files

4. **Continue Work**:
   - Pick up where you left off
   - Update docs as you go

### Completing a Task

1. **Final Updates**:
   - Mark all tasks complete
   - Update context with final decisions
   - Note any follow-up work needed

2. **Archive the Task**:
   ```bash
   mv dev/active/my-feature dev/completed/my-feature
   ```

3. **Add Completion Date**:
   - Add completion date to plan.md header
   - Add brief summary of what was accomplished

## The Three Files Explained

### 1. [task-name]-plan.md

**Purpose**: The strategic plan for implementation

**Contains**:
- Executive summary
- Background and objectives
- Implementation phases
- Technical details
- Testing strategy
- Risks and mitigation
- Timeline estimates

**When to Update**:
- Created at task start
- Updated if approach changes significantly
- Marked complete when task finishes

### 2. [task-name]-context.md

**Purpose**: The living memory of important context

**Contains**:
- Key file locations
- Important decisions (with rationale)
- Technical context (schema, APIs, patterns)
- Discoveries and learnings
- Current state and next steps

**When to Update**:
- Constantly! This is your memory
- After important decisions
- When discovering gotchas
- Before context compaction
- When blocked or changing direction

### 3. [task-name]-tasks.md

**Purpose**: The detailed checklist of work

**Contains**:
- Pre-implementation setup
- Backend tasks (models, routes, tests)
- Frontend tasks (components, styling, tests)
- Integration tasks
- Documentation tasks
- Quality assurance checks

**When to Update**:
- Mark tasks complete immediately
- Add new tasks as discovered
- Note blockers and deferrals
- Update progress tracking

## Tips for Success

### 1. Plan First, Always
Don't skip planning. A solid plan saves hours of wandering.

### 2. Update Immediately
Mark tasks complete right away. Update context while it's fresh.

### 3. Document Decisions
Don't just document *what* you did, document *why* you did it.

### 4. Be Specific
"Fix the bug" is not helpful. "Fix ISO date parsing in PlantingEvent API endpoint" is.

### 5. Keep It Current
Stale documentation is worse than no documentation. Update timestamps.

### 6. Use During Compaction
Before compacting context, update your dev docs. They're your lifeline.

### 7. Break Down Large Tasks
If a task is taking multiple sessions, break it into smaller chunks.

## Example Task Lifecycle

```
Day 1: Planning
├── Create task directory
├── Use planning mode to research
├── Fill out plan.md
├── Fill out initial context.md
├── Create comprehensive tasks.md checklist
└── Review and approve plan

Day 1-3: Implementation (Phase 1)
├── Work through backend tasks
├── Mark tasks complete as you finish
├── Update context.md with decisions
├── Before compaction: update "next steps"

Day 4-5: Implementation (Phase 2)
├── Read all three files to resume
├── Continue with frontend tasks
├── Update context with integration notes
├── Add unexpected tasks discovered

Day 6: Testing & Completion
├── Complete remaining QA tasks
├── Update all docs with final state
├── Add completion date to plan
├── Move to dev/completed/
```

## Integration with Claude Code

### Slash Commands (Suggested)

Create custom slash commands for common operations:

**`/dev-docs-start`** - Start a new task
- Creates directory structure
- Copies templates
- Opens planning mode

**`/dev-docs-update`** - Update before compaction
- Updates context with current state
- Marks completed tasks
- Notes next steps

**`/dev-docs-continue`** - Resume a task
- Reads all three files
- Summarizes current state
- Suggests next actions

### Hooks (Suggested)

Create hooks to remind about dev docs:

**`UserPromptSubmit`** - Check for active tasks
- Reminds about updating context
- Suggests marking completed tasks

**`Stop`** - After completing work
- Reminds to update task files
- Suggests marking completed tasks

## Troubleshooting

**Q: I forgot to update context and now compaction happened. What do I do?**
A: Start a fresh context-only file noting what you remember. Better late than never.

**Q: My task is growing way beyond the original plan. What do I do?**
A: Break it into multiple tasks. Move completed work to a new task in `completed/`, create new task for remaining work.

**Q: Do I need dev docs for small changes?**
A: No. Quick fixes and minor tweaks don't need the full system. Use it for multi-session features.

**Q: How detailed should context.md be?**
A: Detailed enough that future-you (or AI) can resume work confidently. Include the "why" behind decisions.

## Additional Resources

- **Project Architecture**: See `PROJECT_ARCHITECTURE.md` for overall system design
- **Claude Code Guidelines**: See `../CLAUDE.md` for project-specific rules
- **Backend Docs**: See `../backend/README.md`
- **Frontend Docs**: See `../frontend/README.md`

---

**Remember**: The dev docs system is a tool to help you, not a burden. Use it when it's helpful, skip it when it's not. The goal is better code and less frustration, not perfect documentation.
