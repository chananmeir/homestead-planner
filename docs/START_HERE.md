# START HERE - Homestead Planner Claude Code System

## ⚠️ Important Note About Slash Commands

The slash commands (`/dev-docs`, `/build-check`, etc.) are **not working** in your Claude Code environment.

**BUT DON'T WORRY!** Everything still works - just use these alternatives instead:

## ✅ What Works (Use These!)

### 1. Project Manager Agent (EASIEST WAY)

**For anything complex, just use this:**

```
Launch project-manager agent

I want to add [describe what you want to build]
```

The project manager will:
- Figure out what's needed
- Create plans and dev docs
- Activate the right skills
- Coordinate everything
- Handle quality checks

**This is your best starting point!**

---

### 2. Specialized Agents

For specific tasks:

**Fix errors:**
```
Launch auto-error-resolver agent

Fix all compilation errors systematically
```

**Review code quality:**
```
Launch code-architecture-reviewer agent

Review the [feature name] I just built
```

**Create documentation:**
```
Launch documentation-architect agent

Document the [feature name] API
```

---

### 3. Skills (Auto-Activate!)

Skills automatically activate when you work on:
- Backend files → @backend-dev-guidelines
- Frontend files → @frontend-dev-guidelines
- Database/migrations → @database-guidelines

**Just describe what you're doing naturally:**
```
Add a new API endpoint for tracking pest treatments
```

Skills will activate and guide you automatically!

---

### 4. Manual Workflows

For slash command alternatives, see: **`ALTERNATIVE_WORKFLOWS.md`**

It has copy-paste prompts for:
- Creating dev docs (instead of `/dev-docs`)
- Running build checks (instead of `/build-check`)
- Code reviews (instead of `/code-review`)
- Updating docs (instead of `/dev-docs-update`)

---

## 🚀 Quick Start Guide

### Brand New? Do This:

**Step 1**: Test the system
```
Check for errors: Run Python syntax check on backend and TypeScript compilation on frontend
```

**Step 2**: Try the project manager
```
Launch project-manager agent

Explain the current project structure and how I can use this system to build features
```

**Step 3**: Build something!
```
Launch project-manager agent

I want to add a notes field to garden beds where I can write general observations
```

---

### Want to Build a Feature?

**Option A - Let project manager handle it (RECOMMENDED):**
```
Launch project-manager agent

[Describe your feature]
```

**Option B - Manual planning:**
Use the "Create Dev Docs" prompt from `ALTERNATIVE_WORKFLOWS.md`

---

### Made Changes? Check for Errors:

```
Check for errors: Run Python syntax check on backend (py_compile on app.py, models.py) and TypeScript compilation on frontend (npx tsc --noEmit). Show all errors.
```

---

### Ready to Commit? Review Quality:

**Option A - Use agent:**
```
Launch code-architecture-reviewer agent

Review my recent changes
```

**Option B - Manual review:**
Use the "Code Review" prompt from `ALTERNATIVE_WORKFLOWS.md`

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| **`ALTERNATIVE_WORKFLOWS.md`** | ⭐ Copy-paste prompts (slash command alternatives) |
| **`QUICK_START.md`** | Workflows and examples |
| **`CLAUDE.md`** | Project guidelines |
| **`.claude/agents/README.md`** | All available agents |
| **`.claude/skills/README.md`** | Skills system |
| **`dev/README.md`** | Dev docs system |

---

## 🎯 Common Scenarios

### "I don't know where to start"
```
Launch project-manager agent

Help me understand this system and what I can build
```

### "I want to add a feature"
```
Launch project-manager agent

I want to add [feature description]
```

### "I have errors"
```
Check for errors in backend and frontend. Show all compilation errors.
```

### "Is my code good?"
```
Launch code-architecture-reviewer agent

Review everything I've done today
```

### "I need to document something"
```
Launch documentation-architect agent

Document [what needs documenting]
```

---

## 💡 Pro Tips

1. **Always use project-manager agent when unsure** - It figures everything out for you
2. **Skills auto-activate** - Just describe your work naturally
3. **Agents work autonomously** - They handle complex multi-step tasks
4. **Save the prompts from ALTERNATIVE_WORKFLOWS.md** - For quick copy-paste
5. **Check for errors frequently** - Catch issues early

---

## ⚡ Try It Right Now!

Copy this and press Enter:

```
Launch project-manager agent

Give me a tour of this homestead planner app and show me how I can use Claude Code to build new features for it.
```

The project manager will explain everything and show you how to get started!

---

## 🆘 Need Help?

1. **Read** `ALTERNATIVE_WORKFLOWS.md` for copy-paste prompts
2. **Read** `QUICK_START.md` for detailed workflows
3. **Ask** the project-manager agent to explain things
4. **Reference** `.claude/skills/README.md` to understand skills

---

**Your system is ready - just use agents and natural descriptions instead of slash commands! 🚀**
