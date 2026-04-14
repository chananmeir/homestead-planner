# Alternative Workflows (Slash Commands Not Working)

Since slash commands aren't working in your Claude Code environment, here are **alternative ways** to achieve the same workflows.

## ✅ What Still Works

- ✅ **Skills** - Auto-activate based on your work
- ✅ **Hooks** - Error detection and quality reminders
- ✅ **Agents** - Autonomous workflows
- ✅ **Dev Docs** - Manual creation following templates

## 🔄 Workflow Alternatives

### Instead of `/dev-docs` → Use This:

**Copy and paste this prompt:**

```
I need to create comprehensive dev docs for a new feature.

Feature Description:
[Describe your feature here]

Please follow this process:
1. Research the codebase for relevant patterns
2. Create a strategic implementation plan with:
   - Executive Summary
   - Implementation phases
   - Technical details (backend, frontend, database)
   - Testing strategy
   - Risks and timeline

3. Create these three files in dev/active/[feature-name]/:
   - [feature-name]-plan.md (full strategic plan)
   - [feature-name]-context.md (key files, decisions, patterns)
   - [feature-name]-tasks.md (comprehensive checklist)

4. Present the plan for my approval

Reference: @backend-dev-guidelines, @frontend-dev-guidelines, @database-guidelines
```

---

### Instead of `/build-check` → Use This:

**Copy and paste this prompt:**

```
Run a comprehensive build check on both backend and frontend.

1. Backend (Python):
   - Check Python syntax on all backend files
   - Verify imports work
   - Look for common issues (missing rollback, no error handling, etc.)

2. Frontend (TypeScript):
   - Run: cd frontend && npx tsc --noEmit
   - Count and categorize errors
   - Show errors with context

3. Present results:
   - Backend status (Clean/Warnings/Errors)
   - Frontend status and error count
   - Detailed error messages with file:line:col
   - Offer to fix issues

Format the output clearly with sections for backend and frontend.
```

---

### Instead of `/code-review` → Use This:

**Copy and paste this prompt:**

```
Perform a comprehensive code review of recent changes.

1. Identify which files were recently modified (or I'll tell you which files)

2. Load relevant skills:
   - @backend-dev-guidelines (if backend files)
   - @frontend-dev-guidelines (if frontend files)
   - @database-guidelines (if database changes)

3. Review against checklist:
   - Error handling and validation
   - Database operations (migrations, rollback, transactions)
   - API patterns (routes, status codes, jsonify)
   - Frontend patterns (hooks, error states, types)
   - Code organization and clarity
   - Security concerns

4. Categorize findings:
   - ❌ Critical (must fix)
   - ⚠️  Important (should fix)
   - 💡 Suggestions (nice to have)

5. Offer to fix issues

Files to review:
[List files or say "recent changes"]
```

---

### Instead of `/dev-docs-update` → Use This:

**Copy and paste this prompt:**

```
Update dev docs before context compaction to preserve progress.

1. Find the active task in dev/active/

2. Update [task-name]-context.md:
   - Current implementation state
   - Recent decisions and why
   - Challenges encountered and solutions
   - Important patterns discovered

3. Update [task-name]-tasks.md:
   - Mark completed tasks with ✅
   - Update pending tasks
   - Add any new tasks discovered

4. Update [task-name]-plan.md:
   - Add progress update section
   - Note any deviations from original plan

5. Clearly document next steps so I can continue after compaction

Show me a summary of what was updated.
```

---

## 🤖 Better Alternative: Use Agents!

Since agents **do work**, use them instead of slash commands:

### For Strategic Planning:

```
Launch project-manager agent

I want to add [describe your feature]
```

The project manager will:
- Analyze your request
- Create the plan
- Generate dev docs
- Coordinate implementation
- Handle quality checks

### For Error Fixing:

```
Launch auto-error-resolver agent

Fix all TypeScript/Python errors systematically
```

### For Code Review:

```
Launch code-architecture-reviewer agent

Review the [feature name] implementation
```

### For Documentation:

```
Launch documentation-architect agent

Document the [feature name] API endpoints
```

## 📝 Quick Command Reference Sheet

Save these as text snippets for easy copy-paste:

### Quick: Build Check
```
Run build check: Check backend Python syntax and frontend TypeScript compilation (npx tsc --noEmit). Report all errors with file:line:col. Offer to fix.
```

### Quick: Code Review
```
Review recent changes against @backend-dev-guidelines and @frontend-dev-guidelines. Categorize issues as Critical/Important/Suggestions. Offer to fix.
```

### Quick: Create Dev Docs
```
Create dev docs for [feature]: Research codebase, create strategic plan, generate 3 files in dev/active/[feature]/ (plan.md, context.md, tasks.md). Present for approval.
```

### Quick: Update Dev Docs
```
Update dev docs in dev/active/[task]/: Update context.md with current state, update tasks.md with progress, document next steps clearly.
```

## 🎯 Recommended Workflow

Since slash commands don't work, use this workflow:

### Starting a New Feature

**Step 1**: Use the project-manager agent
```
Launch project-manager agent

I want to add [your feature description]
```

**OR manually:**
```
[Copy the "Create Dev Docs" prompt from above]
```

### During Development

Skills auto-activate! Just describe what you're doing:
```
Add a new API endpoint for tracking watering schedules
```

Skills will activate automatically based on keywords and files you're working with.

### Checking for Errors

**Quick way:**
```
Check for errors: Run Python syntax check on backend and TypeScript compilation on frontend
```

**OR:**
```
[Copy the "Build Check" prompt from above]
```

### Before Committing

```
Launch code-architecture-reviewer agent

Review everything I've done today
```

**OR:**
```
[Copy the "Code Review" prompt from above]
```

## 💡 Pro Tip: Create Text Expansion Snippets

If you use a text expander (like TextExpander, Alfred, etc.), save these prompts with shortcuts:

- `;;buildcheck` → Expands to full build check prompt
- `;;codereview` → Expands to full code review prompt
- `;;devdocs` → Expands to full dev docs creation prompt
- `;;docsupdate` → Expands to full docs update prompt

This gives you the speed of slash commands without needing them to work!

## 🔍 Why Aren't Slash Commands Working?

Possible reasons:
1. **Claude Code version** - May need a newer version
2. **Configuration issue** - Some setting preventing command recognition
3. **Environment** - May be a platform-specific issue
4. **Permissions** - SlashCommand tool might be restricted

However, the **good news** is that the workflows in this document achieve the same results!

## Summary

| Want to | Instead of Slash Command | Use This |
|---------|--------------------------|----------|
| Plan feature | `/dev-docs` | Project-manager agent OR copy-paste prompt |
| Check errors | `/build-check` | Copy-paste build check prompt |
| Review code | `/code-review` | Code-architecture-reviewer agent OR copy-paste prompt |
| Update docs | `/dev-docs-update` | Copy-paste update prompt |

**The system still works - just use agents and copy-paste prompts instead!**

---

**Next Steps:**
1. Save the prompts above for easy copy-paste
2. Bookmark this file for reference
3. Use the project-manager agent as your primary entry point
4. Consider setting up text expansion snippets for speed

Your Claude Code workflow system is fully functional - just accessed differently! 🚀
