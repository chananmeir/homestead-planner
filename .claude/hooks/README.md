# Claude Code Hooks for Homestead Planner

This directory contains TypeScript hooks that enhance Claude Code's workflow by automatically activating skills, checking for errors, and tracking changes.

## Overview

Based on best practices from the [Claude Code Reddit post](https://www.reddit.com/r/ClaudeAI/comments/1oivjvm/claude_code_is_a_beast_tips_from_6_months_of/), these hooks implement:

1. **Skill Auto-Activation** - Skills activate automatically based on context
2. **Error Detection** - Catch TypeScript/Python errors immediately
3. **Code Quality Reminders** - Gentle reminders for best practices
4. **Edit Tracking** - Track which files/repos are modified

## Hooks

### 1. user-prompt-submit.ts

**When**: Runs BEFORE Claude sees your message

**Purpose**: Auto-activate relevant skills based on:
- Keywords in your prompt
- Intent patterns (regex matching)
- Files in context (path and content)

**Example Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The following skills are relevant to this task:

📚 **backend-dev-guidelines**
   Flask/Python backend development best practices

📚 **database-guidelines**
   Database operations and migration guidelines

   ⚠️ NEVER modify the database directly!
   ⚠️ Always use 'flask db migrate' for schema changes

Please reference these skills when implementing the solution.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Configuration**: See `skill-rules.json` for trigger rules

### 2. stop.ts

**When**: Runs AFTER Claude finishes responding

**Purpose**:
- Check for TypeScript/Python errors in edited files
- Run build checks on affected repos
- Provide gentle reminders for code quality
- Detect risky patterns (try-catch, async, db operations)

**Example Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  TYPESCRIPT ERRORS (3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

frontend/src/components/GardenPlanner.tsx:45:12
  error TS2339: Property 'width' does not exist on type 'GardenBed'

Please fix these errors before proceeding.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 BACKEND CODE SELF-CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  Backend Changes Detected (2 files)

   ❓ Are database operations wrapped in try-except with rollback?
   ❓ Do route handlers return proper HTTP status codes?
   ❓ Are errors logged or returned to the client appropriately?

💡 Best Practices:
   - All database operations should have try-except with db.session.rollback()
   - Route handlers should validate input and return appropriate status codes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. post-tool-use.ts

**When**: Runs AFTER Edit, Write, or MultiEdit tool use

**Purpose**:
- Track which files were edited
- Log which repos were modified
- Maintain edit history for Stop hook

**What It Creates**:
- `.claude/edit-log.json` - Detailed edit history (last 100 edits)
- `.claude/edited-files.json` - List of edited files for current session

**Example Log Entry**:
```json
{
  "timestamp": "2025-11-11T13:45:00.000Z",
  "file": "backend/models.py",
  "repo": "backend",
  "tool": "Edit"
}
```

## Configuration

### skill-rules.json

Defines which skills activate under what conditions:

```json
{
  "backend-dev-guidelines": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "description": "Flask/Python backend development best practices",
    "promptTriggers": {
      "keywords": ["backend", "flask", "route", "api", "model"],
      "intentPatterns": [
        "(create|add).*(route|endpoint)",
        "(how to|best practice).*(backend|flask)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": ["backend/**/*.py"],
      "contentPatterns": ["@app\\.route", "db\\.Model"]
    }
  }
}
```

**Fields**:
- `type`: "domain" (skill type)
- `enforcement`: "suggest" | "strict" (how aggressively to activate)
- `priority`: "critical" | "high" | "medium" | "low" (activation priority)
- `description`: Short description shown in activation message
- `promptTriggers`: Detect from user prompt
  - `keywords`: Simple keyword matches
  - `intentPatterns`: Regex patterns for intent matching
- `fileTriggers`: Detect from file context
  - `pathPatterns`: File path glob patterns
  - `contentPatterns`: Regex patterns in file content
- `criticalReminders`: Special warnings for critical skills (optional)

## How It Works

### Skill Auto-Activation Flow

```
User submits prompt
  ↓
user-prompt-submit.ts hook runs
  ↓
Load skill-rules.json
  ↓
Analyze prompt for keywords/patterns
  ↓
Check files in context
  ↓
Calculate activation scores
  ↓
Inject skill reminders BEFORE Claude sees prompt
  ↓
Claude receives enhanced prompt with skill guidance
  ↓
Claude implements solution following skills
```

### Error Checking Flow

```
Claude finishes responding
  ↓
post-tool-use.ts logged edited files
  ↓
stop.ts hook runs
  ↓
Read edited files from log
  ↓
Determine which repos were modified
  ↓
Run appropriate checks:
  - Backend: Python syntax check
  - Frontend: TypeScript compiler (tsc --noEmit)
  ↓
Check for risky patterns in edited files
  ↓
Display errors + reminders to Claude
  ↓
Claude fixes issues before user sees them
```

## Benefits

### From the Reddit Post

The creator reported these benefits after 6 months:

**Before Hooks**:
- Claude would forget to check guidelines
- Errors left behind for hours before discovery
- Inconsistent code patterns
- Manual reminder every time

**After Hooks**:
- Skills activate automatically
- Zero errors left behind (#NoMessLeftBehind)
- Consistent patterns enforced
- Claude self-corrects proactively

### For This Project

**Skill Auto-Activation**:
- Backend work automatically references Flask patterns
- Frontend work automatically references React patterns
- Database changes automatically show migration warnings
- No more "wait, which pattern should I use?"

**Error Detection**:
- TypeScript errors caught immediately
- Python syntax errors caught immediately
- Can't forget to run builds
- Issues fixed before context compaction

**Code Quality**:
- Gentle reminders for error handling
- Prompts for proper state management
- Encourages best practices
- Non-blocking, awareness-building

## Customization

### Adding New Trigger Keywords

Edit `skill-rules.json`:

```json
{
  "backend-dev-guidelines": {
    "promptTriggers": {
      "keywords": [
        "backend",
        "flask",
        "your-new-keyword"  // Add here
      ]
    }
  }
}
```

### Adding New Intent Patterns

```json
{
  "promptTriggers": {
    "intentPatterns": [
      "(create|add).*(route|endpoint)",
      "(your|custom).*(pattern)"  // Add regex patterns
    ]
  }
}
```

### Adding New File Patterns

```json
{
  "fileTriggers": {
    "pathPatterns": [
      "backend/**/*.py",
      "backend/your-custom-path/**/*"  // Add paths
    ],
    "contentPatterns": [
      "@app\\.route",
      "your-pattern-here"  // Add content patterns
    ]
  }
}
```

### Adjusting Priorities

```json
{
  "priority": "critical"  // critical > high > medium > low
}
```

Critical priority skills:
- Show first in activation messages
- Display critical reminders
- Used for must-follow guidelines (like database migrations)

### Adding New Skills

1. Create skill in `.claude/skills/new-skill/SKILL.md`
2. Add entry to `skill-rules.json`:

```json
{
  "new-skill": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "medium",
    "description": "Your skill description",
    "promptTriggers": {
      "keywords": ["keyword1", "keyword2"],
      "intentPatterns": ["pattern1", "pattern2"]
    },
    "fileTriggers": {
      "pathPatterns": ["path/**/*"],
      "contentPatterns": ["pattern"]
    }
  }
}
```

## Troubleshooting

### Skills Not Activating

**Check**:
1. Is `skill-rules.json` valid JSON?
2. Are keywords/patterns matching your prompt?
3. Are file paths normalized correctly? (use forward slashes)
4. Try adding more trigger keywords

**Debug**:
- Add `console.log` statements to `user-prompt-submit.ts`
- Check if activation score >= 1
- Verify pattern regexes are correct

### Stop Hook Not Running

**Check**:
1. Are files actually being edited?
2. Is `.claude/edited-files.json` being created?
3. Are build tools available (tsc, python)?
4. Check hook execution logs

### False Positives

If hooks trigger too often:
- Increase activation score threshold (change `>= 1` to `>= 2`)
- Make patterns more specific
- Adjust priority levels

### Performance Issues

If hooks are slow:
- Reduce number of content pattern checks
- Simplify regex patterns
- Limit file scanning

## Testing Hooks

### Test Skill Activation

```
# Should activate backend-dev-guidelines
Prompt: "Create a new Flask route for handling garden bed updates"

# Should activate frontend-dev-guidelines
Prompt: "Add a React component for displaying planting calendar"

# Should activate database-guidelines
Prompt: "I need to add a new column to the planting_event table"

# Should activate multiple skills
Prompt: "Create a full-stack feature for tracking pest control"
```

### Test Error Detection

```
# Introduce TypeScript error
Edit a .tsx file with invalid TypeScript

# Introduce Python error
Edit a .py file with invalid syntax

# Check that Stop hook catches it
```

### Test Edit Tracking

```
# Edit a file
Edit backend/models.py

# Check log created
cat .claude/edit-log.json
```

## Future Enhancements

Based on the Reddit post, consider adding:

1. **Build Error Resolver Agent**:
   - Automatically fix common TypeScript errors
   - Launch when > 5 errors detected

2. **Prettier Formatting Hook** (⚠️ Note from post):
   - Can consume significant tokens
   - Better to run manually between sessions

3. **Database Verification Guardrail**:
   - Block edits that modify DB directly
   - Force use of migrations

4. **Progressive Skill Loading**:
   - Load only relevant resource files
   - Improve token efficiency 40-60%

5. **Hook Analytics**:
   - Track which skills activate most
   - Measure error prevention rate
   - Optimize trigger rules

## Resources

- [Claude Code Hooks Documentation](https://docs.claude.com/docs/claude-code/hooks)
- [Original Reddit Post](https://www.reddit.com/r/ClaudeAI/comments/1oivjvm/claude_code_is_a_beast_tips_from_6_months_of/)
- [Example Repository](https://github.com/diet103/claude-code-infrastructure-showcase)

---

**Last Updated**: 2025-11-11
