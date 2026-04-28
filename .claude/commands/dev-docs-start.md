# Start New Dev Docs Task

**Objective**: Set up dev docs structure for a new feature or task

## Instructions

You are being asked to initialize a new development task with proper documentation structure.

### Step 1: Get Task Name
Ask the user what they want to call this task (use kebab-case, e.g., "variety-support", "multi-animal-livestock").

### Step 2: Create Directory Structure
Create the following:
```
dev/active/[task-name]/
├── [task-name]-plan.md
├── [task-name]-context.md
└── [task-name]-tasks.md
```

### Step 3: Initialize Files from Templates

Copy and customize the templates from `dev/templates/`:

1. **[task-name]-plan.md** - Copy from `task-plan-template.md`
   - Fill in task name, creation date
   - Leave rest for planning phase

2. **[task-name]-context.md** - Copy from `task-context-template.md`
   - Fill in task name, creation date
   - Leave rest to be filled during implementation

3. **[task-name]-tasks.md** - Copy from `task-tasks-template.md`
   - Fill in task name, creation date
   - Create initial task checklist based on user's request

### Step 4: Enter Planning Mode

After creating the structure, tell the user:

"Dev docs structure created at `dev/active/[task-name]/`. I'm ready to help plan this task. What would you like to accomplish?"

Then engage in planning:
- Understand requirements
- Research existing code if needed
- Draft implementation approach
- Identify phases and tasks
- Document in the plan.md file

### Step 5: Fill Out the Plan

Once planning is complete:
1. Update `[task-name]-plan.md` with full implementation plan
2. Update `[task-name]-context.md` with any initial context discovered
3. Update `[task-name]-tasks.md` with comprehensive task checklist

### Step 6: Ready to Implement

Ask the user: "Plan is complete and documented. Ready to begin implementation, or would you like to review/adjust the plan first?"

## Important Notes

- Use the Task tool for any codebase exploration needed during planning
- Be thorough in planning - it saves time later
- Break down complex tasks into clear phases
- Document WHY decisions are made, not just WHAT
- Create specific, actionable tasks in the checklist
