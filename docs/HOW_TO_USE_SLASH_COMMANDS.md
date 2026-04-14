# How to Use Slash Commands

Your slash commands **are working**! Here's exactly how to use them.

## Quick Reference

You have **4 custom slash commands**:

| Command | Purpose | Example Usage |
|---------|---------|---------------|
| `/dev-docs` | Create strategic plan + dev docs | Planning new features |
| `/dev-docs-update` | Update dev docs before compaction | Low context warning |
| `/code-review` | Quality check against guidelines | After implementing |
| `/build-check` | Check for compilation errors | After making changes |

## How to Use Them

### Format

Type the slash command, press Enter, then add your description (if needed):

```
/command-name

Your description here (if the command needs it)
```

### Example 1: Planning a New Feature

```
/dev-docs

I want to add a watering schedule tracker where users can:
- Set watering frequency per garden bed
- Track last watered date
- Get reminders when beds need watering
```

**What happens:**
1. Claude researches your codebase
2. Creates a comprehensive strategic plan
3. Generates 3 dev docs files (plan, context, tasks)
4. Presents the plan for your approval

### Example 2: Checking for Errors

```
/build-check
```

**What happens:**
1. Checks Python syntax (backend)
2. Runs TypeScript compiler (frontend)
3. Reports any errors found
4. Offers to fix them

### Example 3: Code Review

```
/code-review

Review the pest control feature I just added
```

**What happens:**
1. Identifies recently changed files
2. Reviews against project guidelines
3. Categorizes findings (Critical/Important/Suggestions)
4. Offers to fix issues

### Example 4: Update Before Compaction

```
/dev-docs-update
```

**What happens:**
1. Finds your active task in dev/active/
2. Updates context.md with current state
3. Updates tasks.md with progress
4. Ensures next steps are clear

## Complete Workflow Example

Here's how to use commands together when building a feature:

### Step 1: Plan
```
/dev-docs

Add a pest tracking system with treatments and timeline
```
→ Creates plan and dev docs

### Step 2: Implement
Follow the plan that was created. Skills will auto-activate to guide you.

### Step 3: Check for Errors
```
/build-check
```
→ Catches compilation errors

### Step 4: Review Quality
```
/code-review

Review the pest tracking feature
```
→ Checks code quality

### Step 5: Update (if needed)
```
/dev-docs-update
```
→ Preserves progress before compaction

## Alternative: Use the Project Manager Agent

Don't know which command to use? Let the project manager decide:

```
Launch project-manager agent

I want to add a watering schedule tracker
```

The project manager will:
- Analyze your request
- Determine which commands to run
- Activate the right skills
- Coordinate the entire workflow

## Common Questions

**Q: Do I always need a description?**
A: No. Commands like `/build-check` and `/dev-docs-update` work without descriptions.

**Q: Can I use commands in sequence?**
A: Yes! Commands work great together in workflows.

**Q: What if a command doesn't do what I expect?**
A: You can provide additional guidance. Commands are flexible and Claude will adapt.

**Q: Can I create my own commands?**
A: Yes! Create a `.md` file in `.claude/commands/`. See `.claude/commands/README.md` for details.

## Documentation Location

- **Commands Guide**: `.claude/commands/README.md`
- **Skills Guide**: `.claude/skills/README.md`
- **Agents Guide**: `.claude/agents/README.md`
- **Quick Start**: `QUICK_START.md`
- **Project Guidelines**: `CLAUDE.md`

## Test It Now!

Try this simple command:

```
/build-check
```

This will check both your backend and frontend for any compilation errors.

---

**Your slash commands are ready to use! Just type them and press Enter.**
