---
description: Resume work on an active dev docs task by reading plan, context, and tasks
---

# Dev Docs Continue - Resume Task

Resume work on an active development task by loading all context and documentation.

## Instructions

You are being asked to resume work on a previously started development task. Your goal is to read all the dev docs, understand the current state, and help the user continue where they left off.

### Step 1: Find Active Tasks

List all active tasks:

```bash
ls dev/active/
```

If there are multiple tasks, ask the user which one to continue with.

If there are no active tasks, inform the user and suggest using `/dev-docs-start` to begin a new task.

### Step 2: Read All Three Dev Docs Files

For the selected task `[task-name]`, read in this order:

1. **Plan** (`dev/active/[task-name]/[task-name]-plan.md`)
   - Understand the overall objective
   - Review the approach and phases
   - Note any progress updates

2. **Context** (`dev/active/[task-name]/[task-name]-context.md`)
   - Read current state
   - Review important decisions made
   - Note key file locations
   - Read discoveries and gotchas
   - **Pay special attention to "Next Steps"**

3. **Tasks** (`dev/active/[task-name]/[task-name]-tasks.md`)
   - See what's completed
   - See what's in progress
   - See what's upcoming
   - Note any blockers

### Step 3: Verify File Locations

Check that key files mentioned in context.md actually exist and are in the expected state.

### Step 4: Present Comprehensive Summary

Show the user a clear summary:

```

=Â RESUMING TASK: [task-name]


=Ë OBJECTIVE:
   [Brief summary of what this task is trying to accomplish]

 COMPLETED:
   - [Major items completed so far]
   - [...]

= CURRENT STATE:
   [Brief description of where we are now]

=Ê PROGRESS:
   X/Y tasks completed (Z%)
   Current phase: [phase name]

<¯ NEXT STEPS:
   1. [Immediate next action from context.md]
   2. [Following action]
   3. [Action after that]

   IMPORTANT CONTEXT:
   - [Key decision 1 and why]
   - [Key decision 2 and why]
   - [Important gotcha/discovery]

=Á KEY FILES:
   - [file:line] - [description]
   - [file:line] - [description]

=§ BLOCKERS:
   [None / List any blockers]

ð LAST UPDATED:
   Plan: [date]
   Context: [date]
   Tasks: [date]



Ready to continue! Should I proceed with: [next immediate action]?
```

### Step 5: Propose Next Action

Based on the "Next Steps" in context.md and the task list, propose the immediate next action and ask if the user wants to proceed.

## Important Notes

- Read ALL three files - don't skip any
- Pay special attention to "Next Steps" in context.md
- Highlight any blockers or uncertainties
- Include file paths with line numbers for quick navigation
- Propose a concrete next action
- Ask before proceeding with implementation

## When to Use This

- After context compaction
- Starting a new session
- Switching back to a task after working on something else
- When you need to refresh your understanding of where you are

## Example Usage

```
/dev-docs-continue

I'm picking up this project again after a break.
Let me know where we are.
```

The command will:
1. Find active tasks
2. Read all dev docs
3. Present comprehensive summary
4. Propose next action

---

**Remember**: Take the time to thoroughly understand the context before diving back in. A few minutes reviewing saves hours of confusion!
