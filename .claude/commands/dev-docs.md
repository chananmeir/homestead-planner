---
description: Create comprehensive development documentation for a new task or feature
---

# Dev Docs - Strategic Planning

Create comprehensive development documentation for a new task or feature.

## Instructions

You are starting a new task or feature. Follow these steps to create proper dev docs:

### 1. Research Phase

First, thoroughly research the codebase to understand:
- Relevant existing code and patterns
- Files that will need to be modified
- Dependencies and relationships
- Similar features already implemented
- Potential challenges or gotchas

Use the Explore tool to investigate the codebase. Look for:
- Related components (backend and frontend)
- Database models that might be affected
- API endpoints that might be relevant
- Similar functionality to learn from

### 2. Create Strategic Plan

Create a comprehensive strategic plan with these sections:

**Executive Summary**:
- 2-3 sentence overview
- What problem this solves
- Expected outcome

**Background**:
- Why this feature is needed
- Current state of the codebase
- User or business need

**Objectives**:
- Primary goals (must-haves)
- Secondary goals (nice-to-haves)
- Success criteria

**Implementation Approach**:
Break into phases with:
- Phase name and goal
- Specific steps for each phase
- Files that will be affected
- Expected challenges

**Technical Details**:
- Backend changes (models, routes, migrations)
- Frontend changes (components, types, API calls)
- Database schema changes (if any)
- New dependencies (if any)

**Testing Strategy**:
- What needs to be tested
- How to test it
- Edge cases to consider

**Risks & Mitigation**:
- Potential issues
- How to avoid/handle them

**Timeline Estimate**:
- Time estimate for each phase
- Total estimated time

### 3. Create Task Files

After creating the plan, generate the three dev docs files:

**Create Directory**:
```bash
mkdir -p dev/active/[task-name]
```

**Create Files**:

1. `dev/active/[task-name]/[task-name]-plan.md`
   - The full strategic plan from step 2
   - Include all sections listed above
   - Be specific and detailed

2. `dev/active/[task-name]/[task-name]-context.md`
   - Key files and their locations
   - Important architectural notes
   - Initial decisions made during planning
   - Dependencies and integrations
   - Code patterns to follow

3. `dev/active/[task-name]/[task-name]-tasks.md`
   - Comprehensive checklist broken down by:
     - Backend tasks (models, routes, logic, tests)
     - Frontend tasks (components, types, API, styling, tests)
     - Integration tasks
     - Documentation tasks
     - Quality assurance checks

### 4. Review with User

Present the plan to the user for review and approval before proceeding.

## Output Format

After research, present:

1. **Summary of findings** from codebase exploration
2. **Proposed approach** with phases
3. **The three dev docs files** created and ready
4. **Ask for approval** before implementing

## Important Notes

- Be thorough in research - don't skip this step
- Reference existing patterns from the codebase
- Use @backend-dev-guidelines and @frontend-dev-guidelines
- Include specific file paths and line numbers when referencing code
- Make tasks actionable and specific
- Document "why" decisions, not just "what"

## Example Usage

```
/dev-docs

I want to add a feature for tracking pest control treatments in the garden.
This should include:
- Database storage for treatments (date, method, pest type, results)
- API endpoints for CRUD operations
- Frontend form for adding treatments
- Display treatments on a timeline
```

The command will:
1. Research relevant parts of the codebase
2. Create a comprehensive strategic plan
3. Generate all three dev docs files
4. Present for approval

---

**Remember**: Good planning saves hours of wandering. Take time to plan thoroughly!
