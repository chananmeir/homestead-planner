# Claude Code Slash Commands for Homestead Planner

Custom slash commands that expand into detailed prompts for common workflows.

## Overview

Slash commands are shortcuts that expand into comprehensive prompts with detailed instructions. They help maintain consistency and ensure Claude follows the right process for common tasks.

## Available Commands

### Planning & Documentation

#### `/dev-docs`

**Purpose**: Create comprehensive development documentation for a new task/feature

**What it does**:
1. Research relevant parts of the codebase
2. Create a strategic implementation plan
3. Generate all three dev docs files (plan, context, tasks)
4. Present plan for approval

**When to use**:
- Starting any new feature or significant change
- Before implementing complex functionality
- When you need a clear roadmap

**Usage**:
```
/dev-docs

I want to add a feature for tracking pest control treatments.
Include database storage, API endpoints, and a frontend form.
```

**Output**:
- Codebase research findings
- Strategic plan with phases
- Three dev docs files created
- Ready to implement after approval

---

#### `/dev-docs-start`

**Purpose**: Set up dev docs structure for a new feature or task

**What it does**:
1. Ask for task name
2. Create directory structure in dev/active/
3. Copy and initialize templates (plan, context, tasks)
4. Enter planning mode
5. Create comprehensive plan and task checklist
6. Prepare for implementation

**When to use**:
- Starting any new feature
- Beginning a significant change
- When you want structured planning
- Alternative to `/dev-docs` for more hands-on approach

**Usage**:
```
/dev-docs-start

I want to add a weather tracking feature
```

**Output**:
- Task directory created
- Three dev docs files initialized
- Planning discussion and plan creation
- Ready to implement

---

#### `/dev-docs-update`

**Purpose**: Update dev docs before context compaction to preserve progress

**What it does**:
1. Find active task in dev/active/
2. Update context.md with current state and decisions
3. Update tasks.md with completed/pending tasks
4. Add progress update to plan.md
5. Ensure next steps are crystal clear

**When to use**:
- Before context compaction
- End of work session
- After completing major milestones
- When switching tasks

**Usage**:
```
/dev-docs-update

Running low on context. Update dev docs before I compact.
```

**Output**:
- Updated context.md with latest decisions
- Updated tasks.md with progress
- Clear next steps documented
- Summary of what's been done

---

#### `/dev-docs-continue`

**Purpose**: Resume work on an active dev docs task by reading plan, context, and tasks

**What it does**:
1. List active tasks in dev/active/
2. Read all three dev docs files (plan, context, tasks)
3. Verify key files mentioned exist
4. Present comprehensive summary of current state
5. Propose next action based on context

**When to use**:
- After context compaction
- Starting a new session
- Switching back to a task
- When you need to refresh understanding

**Usage**:
```
/dev-docs-continue

I'm back after a break, where were we?
```

**Output**:
- Complete state summary
- What's been done
- What's next
- Key decisions and context
- Proposed immediate action

---

### Orchestration & Automation

#### `/project-manager`

**Purpose**: Launch manager agent that orchestrates multiple sub-agents for complex tasks

**What it does**:
1. Launches ONE manager agent
2. Manager reads dev docs (if they exist)
3. Manager launches 2-3 exploration agents in parallel
4. Manager creates comprehensive plan
5. Manager launches 2-4 implementation agents in parallel
6. Manager launches validation agents (code review, build check)
7. Manager updates dev docs throughout
8. Manager returns comprehensive final report

**When to use**:
- Complex fixes across multiple areas
- Large features requiring backend + frontend + database work
- When you want fully autonomous execution
- When you want parallel agent work for speed

**Usage**:
```
/project-manager

Fix the plant variety feature - it's not saving correctly
and the frontend dropdown isn't showing all options
```

Or:
```
/project-manager

Build a new weather tracking feature with database storage,
API endpoints, and frontend charts
```

**Output**:
- Executive summary of all work done
- List of all agents launched and their tasks
- Complete list of file changes
- Issues found and fixed
- Validation results (build, tests, code review)
- Dev docs location and status
- Remaining work and next steps

**Key Feature**: Fully autonomous multi-agent orchestration - the manager coordinates 4-8 specialist agents working in parallel!

---

### Code Quality

#### `/code-review`

**Purpose**: Comprehensive architectural code review against guidelines

**What it does**:
1. Identify recently changed files
2. Load relevant skill guidelines
3. Review against comprehensive checklist
4. Categorize findings (Critical/Important/Suggestions)
5. Offer to fix issues

**When to use**:
- After implementing a feature
- Before committing significant changes
- When you want a second opinion
- To catch issues early

**Usage**:
```
/code-review

Review the recent changes I made to the garden bed CRUD operations.
```

Or specify files:
```
/code-review

Review these files:
- backend/app.py
- frontend/src/components/GardenPlanner.tsx
```

**Output**:
- Critical issues (must fix)
- Important issues (should fix)
- Suggestions (nice to have)
- Good practices observed
- Offer to fix issues

---

#### `/build-check`

**Purpose**: Run build checks on backend and frontend to catch all errors

**What it does**:
1. Check Python syntax (backend)
2. Run TypeScript compiler (frontend)
3. Count and categorize errors
4. Present detailed error information
5. Offer to fix issues

**When to use**:
- After making changes
- Before committing
- To ensure everything compiles
- As part of your workflow

**Usage**:
```
/build-check

Run a full build check on both backend and frontend
```

**Output**:
- Backend status (Clean/Warnings/Errors)
- Frontend status (Clean/Warnings/Errors)
- Detailed error messages
- Context around errors
- Offer to fix issues

---

## How to Use Slash Commands

### Basic Usage

Type the slash command on its own line, then add your description (if needed):

**Example with description:**
```
/dev-docs

I want to add a pest tracking feature with database storage,
API endpoints, and a frontend form for recording treatments
```

**Example without description:**
```
/build-check
```

Press Enter and Claude will follow the command's workflow.

### Command Structure

Each slash command is a markdown file in `.claude/commands/` that contains:
- Instructions for Claude to follow
- Structured workflow steps
- Output format guidelines
- Examples and best practices

### Expansion Process

```
You type: /dev-docs
          ↓
Command file loaded: dev-docs.md
          ↓
Claude receives full instructions
          ↓
Claude follows the workflow
          ↓
Produces structured output
```

### Benefits

**Consistency**:
- Same workflow every time
- No forgetting steps
- Reliable results

**Efficiency**:
- Don't repeat instructions
- Pack complex workflows into simple commands
- Save typing

**Quality**:
- Built-in best practices
- Structured outputs
- Comprehensive checklists

## Command Reference

| Command | Purpose | Time Saved | Best Use |
|---------|---------|------------|----------|
| `/dev-docs` | Strategic planning | 10-15 min | Start of feature |
| `/dev-docs-start` | Initialize task structure | 5 min | Start of feature (manual) |
| `/dev-docs-continue` | Resume task | 5 min | After break/compaction |
| `/dev-docs-update` | Preserve context | 5-10 min | Before compaction |
| `/project-manager` | Multi-agent orchestration | 30-60 min | Complex multi-area tasks |
| `/code-review` | Quality check | 15-20 min | After implementation |
| `/build-check` | Error detection | 5 min | After changes |

## Usage Patterns

### Starting a New Feature (Option 1: Automated)

```
1. /dev-docs
   → Create plan and dev docs automatically

2. Implement feature
   → Follow the plan

3. /build-check
   → Verify no errors

4. /code-review
   → Quality check

5. /dev-docs-update (if needed)
   → Preserve progress
```

### Starting a New Feature (Option 2: Manual)

```
1. /dev-docs-start
   → Set up structure and plan interactively

2. Implement feature
   → Follow the plan

3. /build-check
   → Verify no errors

4. /code-review
   → Quality check

5. /dev-docs-update (if needed)
   → Preserve progress
```

### Resuming After Break

```
1. /dev-docs-continue
   → Load context and see current state

2. Continue implementation
   → Pick up where you left off

3. /build-check
   → Verify no new errors

4. /dev-docs-update (before next break)
   → Save progress
```

### Complex Multi-Area Tasks (Autonomous)

```
1. /project-manager
   → Describe the complex task
   → Manager launches 4-8 specialist agents
   → Everything done autonomously
   → Comprehensive report returned

2. Review the changes
   → Check what was done

3. Test manually if needed
   → Verify it works as expected

4. Commit or request adjustments
```

### During Development

```
1. Make changes

2. /build-check
   → Catch errors immediately

3. Continue development

4. Repeat
```

### Before Compaction

```
1. /dev-docs-update
   → Update all documentation

2. Review next steps

3. Compact context

4. /dev-docs-continue
   → Resume with full context
```

### Before Committing

```
1. /build-check
   → Ensure everything compiles

2. /code-review
   → Final quality check

3. Fix any issues

4. Commit
```

## Creating Custom Commands

Want to add your own? Here's how:

### 1. Create Command File

Create `.claude/commands/your-command.md`:

```markdown
# Your Command - Short Description

Longer description of what this command does.

## Instructions

Step-by-step instructions for Claude to follow:

### 1. First Step
- What to do
- How to do it

### 2. Second Step
- More instructions

## Output Format

How to present results to the user.

## Important Notes

- Note 1
- Note 2

## Example Usage

\```
/your-command

Example of how user would invoke it
\```
```

### 2. Command Structure

Good commands include:
- Clear purpose statement
- Step-by-step instructions
- Output format guidelines
- Examples
- Important notes/caveats

### 3. Command Best Practices

**Be Specific**:
- Exact steps to follow
- No ambiguity
- Clear success criteria

**Be Thorough**:
- Don't skip important steps
- Include error handling
- Consider edge cases

**Be Structured**:
- Use consistent formatting
- Number steps
- Use sections

**Be Helpful**:
- Provide examples
- Explain why steps matter
- Include troubleshooting

## Examples of Custom Commands

Ideas for additional commands:

### `/test-run`
Run all tests and report results

### `/deploy-check`
Verify everything is ready for deployment

### `/migration-create`
Create a new database migration safely

### `/api-test`
Test API endpoints with various inputs

### `/security-check`
Check for common security issues

### `/performance-check`
Identify performance bottlenecks

### `/docs-update`
Update project documentation

## Tips for Using Commands

### Combine Commands

Commands work great in sequence:
```
/dev-docs
... implement feature ...
/build-check
/code-review
/dev-docs-update
```

### Customize Output

After command runs, you can ask for more:
```
/code-review
... review completes ...
"Now explain that critical issue in more detail"
```

### Adapt to Context

Commands are flexible:
```
/code-review

Focus specifically on error handling and database operations
```

### Use with Skills

Commands automatically reference skills:
```
/dev-docs
→ Will reference @backend-dev-guidelines and @frontend-dev-guidelines
```

## Troubleshooting

### Command Not Found

**Check**:
- Is file in `.claude/commands/`?
- Is filename correct (matches `/command-name`)?
- Is it a `.md` file?

### Command Not Working as Expected

**Check**:
- Are instructions clear and specific?
- Are there ambiguous steps?
- Is output format defined?

### Command Takes Too Long

**Consider**:
- Breaking into smaller commands
- Reducing scope
- Focusing on specific aspects

## Integration with Other Systems

### Works With Hooks

Commands benefit from hooks:
- Skills auto-activate during command execution
- Errors caught after command completes
- Quality reminders shown

### Works With Dev Docs

Commands often create/update dev docs:
- `/dev-docs` creates dev docs
- `/dev-docs-update` updates dev docs
- Other commands can reference dev docs

### Works With Skills

Commands reference skills automatically:
- Backend work references backend skill
- Frontend work references frontend skill
- Database work references database skill

## Best Practices

### When to Create a Command

Create a command when:
- You repeat the same workflow often
- The workflow has multiple steps
- Consistency matters
- You want to codify best practices

### When NOT to Create a Command

Skip commands for:
- One-off tasks
- Simple single-step operations
- Highly variable workflows
- Exploratory work

### Maintaining Commands

**Keep Updated**:
- Update as project evolves
- Refine based on usage
- Remove outdated steps

**Keep Concise**:
- Focus on essentials
- Remove unnecessary steps
- Combine related steps

**Keep Clear**:
- Use simple language
- Be explicit
- Avoid assumptions

## Resources

- [Claude Code Slash Commands Docs](https://docs.claude.com/docs/claude-code/slash-commands)
- [Reddit Post Example](https://www.reddit.com/r/ClaudeAI/comments/1oivjvm/claude_code_is_a_beast_tips_from_6_months_of/)
- Project Guidelines: `CLAUDE.md`
- Skills Documentation: `.claude/skills/README.md`

---

**Last Updated**: 2025-11-11

**Available Commands**: 7
- `/dev-docs` - Strategic planning (automated)
- `/dev-docs-start` - Initialize task structure (manual)
- `/dev-docs-continue` - Resume task after break
- `/dev-docs-update` - Preserve context before compaction
- `/project-manager` - Multi-agent orchestration for complex tasks
- `/code-review` - Quality check
- `/build-check` - Error detection
