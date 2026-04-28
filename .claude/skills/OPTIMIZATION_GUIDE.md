# Skills Optimization Guide

## Progressive Disclosure with Resource Files

**From Reddit Post**: The creator reported 40-60% token efficiency improvement by splitting large skills into main file + resource files.

## Current State

Your skills are currently single files:
- `backend-dev-guidelines/SKILL.md` (~300 lines)
- `frontend-dev-guidelines/SKILL.md` (~350 lines)
- `database-guidelines/SKILL.md` (~250 lines)

These are within reasonable size (under Anthropic's 500-line recommendation), but could still benefit from splitting for token efficiency.

## When to Split Skills

Split skills when:
- Main SKILL.md is approaching 500 lines
- Skills cover multiple distinct topics
- You want better token efficiency
- You notice performance impacts

## How to Split Skills

### Structure

```
skill-name/
├── SKILL.md                    # Main file (<500 lines)
│   ├── Overview
│   ├── When to use
│   ├── Core principles
│   ├── Quick reference
│   └── Links to resource files
└── resources/
    ├── patterns.md             # Detailed code patterns
    ├── examples.md             # Comprehensive examples
    ├── advanced.md             # Advanced topics
    ├── checklist.md            # Detailed checklists
    └── troubleshooting.md      # Common issues
```

### Example: backend-dev-guidelines

**SKILL.md** (main file):
```markdown
# Backend Development Guidelines

## Overview
Flask/Python backend best practices for Homestead Planner.

## Core Principles
1. Follow Flask best practices
2. Use SQLAlchemy ORM
3. Always use migrations

## Quick Patterns

### Route Handler (Basic)
[Brief example]

For detailed patterns, see: @backend-dev-guidelines/patterns.md
For comprehensive examples, see: @backend-dev-guidelines/examples.md

## When to Use Resource Files

- **patterns.md**: When implementing routes, models, or business logic
- **examples.md**: When you need full implementation examples
- **advanced.md**: For complex scenarios, optimization, or unusual cases
```

**resources/patterns.md**:
```markdown
# Backend Development Patterns

## Route Handler Patterns

### GET Request
[Full detailed example with error handling]

### POST Request
[Full detailed example with validation]

### PUT Request
[Full detailed example]

### DELETE Request
[Full detailed example]
```

## Benefits

**Token Efficiency**:
- Load only what's needed
- Main file always loaded (lightweight)
- Resource files loaded on-demand
- 40-60% reduction in tokens per query

**Better Organization**:
- Easier to maintain
- Clearer structure
- Focused content

**Flexibility**:
- Add new resources without bloating main file
- Users can request specific resources

## When to Optimize

**Now**: Your skills are fine as-is for getting started

**Later**: Consider optimization when:
- You add more content to skills
- You notice performance impacts
- You want maximum token efficiency
- Skills approach 500+ lines

## Implementation Priority

**Priority 1** (Do this later):
- Split backend-dev-guidelines if it grows beyond 500 lines
- Split frontend-dev-guidelines if it grows beyond 500 lines

**Priority 2** (Nice to have):
- Extract examples into separate files
- Create advanced topics files

**Priority 3** (Optional):
- Troubleshooting guides
- FAQ resources

## How to Reference Resources in Main File

```markdown
## Route Handlers

Basic pattern:
[Quick example]

For complete patterns with all HTTP methods:
→ See @backend-dev-guidelines/patterns.md

For real-world examples:
→ See @backend-dev-guidelines/examples.md
```

Claude will load resource files when referenced.

## Monitoring Token Usage

Watch for:
- Skills being loaded frequently
- Long response times
- High context usage

If you notice these, consider splitting into resource files.

---

**Current Recommendation**: Your skills are fine as-is. Revisit this guide if skills grow significantly or you want to maximize token efficiency.
