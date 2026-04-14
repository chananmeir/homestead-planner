# Quick Start Guide - Building with Claude Code

Get started building features for Homestead Planner using the complete workflow system.

## 🚀 The Easiest Way to Start

Don't know which skills, agents, or commands to use? **Start with the project-manager agent!**

### Step 1: Launch the Project Manager

```
Launch project-manager agent

[Describe what you want to build in plain language]
```

**Example**:
```
Launch project-manager agent

I want to add a feature where users can track when they water
their plants and see which beds need watering soon
```

### Step 2: Review the Plan

The project-manager will:
- ✅ Analyze your request
- ✅ Determine what's needed (backend, frontend, database)
- ✅ Recommend which skills to activate
- ✅ Suggest which agents to use
- ✅ Create a detailed execution plan
- ✅ Estimate timeline

### Step 3: Choose How to Proceed

The project-manager will ask:

**A) Step-by-step with guidance** - You approve each phase
**B) Autonomous implementation** - Let it handle everything
**C) Adjust the plan** - Modify the approach

### Step 4: Build!

The project-manager coordinates everything:
- Activates the right skills automatically
- Runs the right commands (/dev-docs, /build-check, etc.)
- Launches other agents when needed
- Keeps you updated on progress

---

## 🎯 If You Know What You Want

### For Planning a Feature

Type the slash command followed by your description:
```
/dev-docs

I want to add a watering schedule tracker where users can set
how often each bed needs watering and track last watered dates
```

This will:
- Research your codebase
- Create strategic plan
- Generate dev docs (plan, context, tasks)
- Get you ready to implement

### For Quick Changes

Just describe it naturally:
```
Add a notes field to the garden bed model
```

Skills will activate automatically based on context.

### For Error Checking

```
/build-check
```

Checks both backend and frontend for errors.

### For Code Review

```
/code-review

Review the pest control feature I just added
```

Reviews recent changes for quality and best practices.

---

## 📚 Common Workflows

### Adding a New Feature (Full Process)

**1. Plan It**
```
/dev-docs

Add [feature description]
```

**2. Implement It**
```
[Follow the plan, Claude will guide you with skills active]
```

**3. Check for Errors**
```
/build-check
```

**4. Review Quality**
```
/code-review
```

**5. Before Compaction**
```
/dev-docs-update
```

**6. Commit**
```
git add .
git commit -m "Feature description"
```

### Fixing Many Errors

```
/build-check
[Shows 10 errors]

Launch auto-error-resolver agent
Fix all errors systematically
```

### Getting Architecture Feedback

```
Launch code-architecture-reviewer agent

Review the [feature name] implementation
```

### Creating Documentation

```
Launch documentation-architect agent

Document the [feature name] API endpoints
```

---

## 🎓 Learning the System

### Skills Auto-Activate

You don't need to think about skills - they activate automatically when:
- You work on backend files → @backend-dev-guidelines
- You work on frontend files → @frontend-dev-guidelines
- You work on database → @database-guidelines

### Hooks Run Automatically

After each response:
- ✅ Stop hook checks for errors
- ✅ Reminds you of best practices
- ✅ Post-tool-use hook tracks changes

### Commands Are Shortcuts

| Command | What It Does |
|---------|-------------|
| /dev-docs | Create strategic plan + dev docs |
| /dev-docs-update | Update dev docs before compaction |
| /code-review | Review code quality |
| /build-check | Check for compilation errors |

### Agents Work Autonomously

| Agent | What It Does |
|-------|-------------|
| project-manager | Coordinates everything |
| auto-error-resolver | Fixes errors systematically |
| code-architecture-reviewer | Deep architectural review |
| documentation-architect | Creates comprehensive docs |

---

## 💡 Pro Tips

### Tip 1: Always Start with Planning

For anything beyond a trivial change:
```
/dev-docs first
```

Creates a roadmap and prevents getting lost.

### Tip 2: Check Frequently

After making changes:
```
/build-check
```

Catches errors immediately.

### Tip 3: Update Before Compaction

When context is low:
```
/dev-docs-update
```

Preserves your progress.

### Tip 4: Use Project Manager When Unsure

Don't know what to do?
```
Launch project-manager agent

[Describe what you want]
```

It figures out the rest.

### Tip 5: Let Skills Guide You

Skills activate automatically and remind you of:
- Patterns to follow
- Best practices
- Common pitfalls

---

## 🎯 Try It Now!

### Beginner: Simple Feature

```
Launch project-manager agent

Add a notes field to garden beds where I can write general notes
```

**Estimated Time**: 15-20 minutes

### Intermediate: Medium Feature

```
Launch project-manager agent

Add a watering schedule tracker:
- Set watering frequency per bed
- Track last watered date
- Show which beds need water
```

**Estimated Time**: 2-3 hours

### Advanced: Complex Feature

```
Launch project-manager agent

Add a soil health monitoring system:
- Track pH, NPK levels over time
- Show trends and changes
- Recommend amendments based on test results
```

**Estimated Time**: 4-6 hours (1 day)

---

## 📖 Reference

### All Commands

```bash
/dev-docs              # Strategic planning
/dev-docs-update       # Update before compaction
/code-review          # Quality review
/build-check          # Error checking
```

### All Agents

```bash
Launch project-manager agent              # Orchestrates everything
Launch auto-error-resolver agent          # Fixes errors
Launch code-architecture-reviewer agent   # Architecture review
Launch documentation-architect agent      # Creates docs
```

### All Skills (Auto-Activate)

- @backend-dev-guidelines - Flask/Python patterns
- @frontend-dev-guidelines - React/TypeScript patterns
- @database-guidelines - Migrations & database
- @skill-developer - Creating new skills

---

## 🆘 Need Help?

### "I don't know where to start"
```
Launch project-manager agent

[Describe what you want in plain language]
```

### "I have errors"
```
/build-check

[If many errors]
Launch auto-error-resolver agent
```

### "Is my code good?"
```
/code-review

OR

Launch code-architecture-reviewer agent
```

### "I need docs"
```
Launch documentation-architect agent

Document [what you want documented]
```

### "I'm running low on context"
```
/dev-docs-update
```

---

## 🎉 You're Ready!

The system is designed to guide you automatically. Just:

1. **Start with project-manager** if unsure
2. **Let skills activate** automatically
3. **Check frequently** with /build-check
4. **Review when done** with /code-review or agents
5. **Update dev docs** before compaction

**Pick a feature and start building!** 🚀

---

**For Complete Documentation**:
- System Overview: `.claude/SETUP_COMPLETE.md`
- Skills Guide: `.claude/skills/README.md`
- Hooks Guide: `.claude/hooks/README.md`
- Commands Guide: `.claude/commands/README.md`
- Agents Guide: `.claude/agents/README.md`
