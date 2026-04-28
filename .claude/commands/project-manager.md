---
description: Launch project manager agent to orchestrate fixes across multiple sub-agents
---

# Project Manager - Launch Specialist Agent

You are being asked to launch the **project-manager agent**. This agent knows how to research, plan, delegate to specialist agents (`backend-debugger`, `frontend-debugger`, `auto-error-resolver`, `code-review`, `documentation-recorder`), and verify results. It never implements code itself.

## Instructions

### Step 1: Parse User Request

Extract from the user's request:
- **Task Name**: What are they trying to fix/build?
- **Scope**: What areas are affected? (backend, frontend, database, etc.)
- **Objective**: What's the end goal?

### Step 2: Launch the Project Manager Agent

Use the **Agent tool** with `subagent_type: "project-manager"` to launch the agent.

Pass a prompt that includes:
1. The task name and objective
2. The scope (backend, frontend, both, database, etc.)
3. Any specific details or error messages the user mentioned
4. The user's exact words so the agent has full context
5. **MANDATORY**: The delegation enforcement footer (see below)

**IMPORTANT**: Use `subagent_type: "project-manager"` — NOT `"general-purpose"`.

### Prompt Template

Structure the prompt like this — describe the PROBLEM, not the solution. Let the PM research and plan:

```
TASK: [What needs to be fixed/built]
SCOPE: [Which domains are affected]
OBJECTIVE: [End goal in user's terms]

CONTEXT:
[User's exact words and any screenshots/errors]
[Prior investigation results if any — but do NOT prescribe exact file edits]

---
DELEGATION ENFORCEMENT REMINDER:
You are the orchestrator, NOT the implementer. Your report MUST include a Delegation Log
showing which specialist agents you spawned. If you edited any source files yourself,
you violated the mandatory delegation rule in your agent definition. Spawn backend-debugger
for backend work, frontend-debugger for frontend work, migration-guardian for schema changes.
Launch independent tasks in parallel.
```

**Key principle**: Describe the problem and constraints. Do NOT list specific file:line edits in the prompt — that tempts the PM to "just do it" instead of delegating. Let the PM research first, then delegate with specifics to the right specialist.

### Step 3: Present Results

When the agent returns, check the **Delegation Log** in its report:
- If it lists agents spawned → good, the system worked as designed
- If the Delegation Log is empty or missing → flag this to the user as a delegation failure

Then offer to:
- Fix any remaining issues
- Launch additional agents if needed
- Review specific changes in detail
- Continue with next phase
