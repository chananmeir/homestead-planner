# Claude Code Skills for Homestead Planner

This directory contains custom skills that provide best practices, patterns, and guidelines for developing Homestead Planner.

## Available Skills

### 1. backend-dev-guidelines

**Purpose**: Best practices for Flask/Python backend development

**When to Use**:
- Creating or modifying Flask routes
- Working with SQLAlchemy models
- Writing business logic in Python
- Working in `backend/` directory

**Key Topics**:
- Flask route patterns (GET, POST, PUT, DELETE)
- Model definition with relationships
- Error handling and validation
- Request/response patterns
- Date handling (ISO format)
- Testing patterns
- Code organization

**Example Triggers**:
- "Create a new API endpoint for..."
- "Add a model for..."
- "How do I handle errors in Flask?"

### 2. frontend-dev-guidelines

**Purpose**: Best practices for React/TypeScript frontend development

**When to Use**:
- Creating or modifying React components
- Working with TypeScript types
- Styling with Tailwind CSS
- Making API calls
- Working in `frontend/src/` directory

**Key Topics**:
- Functional components with hooks
- TypeScript type definitions
- API integration patterns (GET, POST, PUT, DELETE)
- Tailwind CSS styling
- State management (useState, useContext)
- Form handling with validation
- Custom hooks
- Date formatting

**Example Triggers**:
- "Create a component for..."
- "Add a form to..."
- "How do I fetch data from the API?"
- "Style this component with Tailwind..."

### 3. database-guidelines

**Purpose**: Guidelines for database operations and migrations

**When to Use**:
- Creating or modifying database schema
- Writing migrations
- Querying the database
- Managing relationships
- Database-related tasks

**Key Topics**:
- Migration workflow (NEVER modify DB directly!)
- Model relationships (one-to-many, many-to-many)
- Query patterns (basic and advanced)
- Transaction management
- Complex data migrations
- Cascade behavior
- Database maintenance

**Example Triggers**:
- "Add a column to..."
- "Create a migration for..."
- "How do I query..."
- "Set up a relationship between..."

## How Skills Work

Skills are automatically referenced by Claude Code when:
1. You're working on files in relevant directories
2. Your prompt contains relevant keywords
3. You explicitly mention the skill

### Manual Activation

You can explicitly activate a skill by referencing it:

```
@backend-dev-guidelines How should I structure this Flask route?
```

### Automatic Activation

Skills should activate automatically when:
- Working on backend files → `backend-dev-guidelines`
- Working on frontend files → `frontend-dev-guidelines`
- Discussing database changes → `database-guidelines`

## Skill Structure

Each skill follows this structure:

```
.claude/skills/
└── skill-name/
    └── SKILL.md          # Main skill content
```

### Future Enhancements

According to the Reddit post best practices, we could:

1. **Add Resource Files** (for skills > 500 lines):
   ```
   skill-name/
   ├── SKILL.md          # Main file (< 500 lines)
   └── resources/
       ├── examples.md
       ├── patterns.md
       └── advanced.md
   ```

2. **Attach Utility Scripts**:
   ```
   skill-name/
   ├── SKILL.md
   └── scripts/
       └── helper-script.py
   ```

3. **Create Auto-Activation Hooks**:
   - UserPromptSubmit hook to inject skill reminders
   - File-based triggers for automatic activation
   - Context-based skill suggestions

## Using Skills Effectively

### Best Practices

1. **Reference Early**: Mention the skill at the start of your request
2. **Be Specific**: "How do I X according to the guidelines?"
3. **Combine Skills**: Backend + database skills work together
4. **Update Regularly**: Keep skills current with project evolution

### Example Usage

**Creating a New Feature**:
```
I want to add a new feature for tracking pest control treatments.
This needs backend API endpoints and a frontend form.

Backend: Create model, routes, and migrations
Frontend: Create component with form and API integration

Use @backend-dev-guidelines and @frontend-dev-guidelines
```

**Database Migration**:
```
@database-guidelines I need to add a "treatment_date" column to
the pest_control table. Walk me through the migration process.
```

**Form Component**:
```
@frontend-dev-guidelines Create a form component for adding
pest control records with validation and error handling.
```

## Maintaining Skills

### When to Update

Update skills when:
- Project patterns change
- New best practices emerge
- Common mistakes are discovered
- New features require new patterns
- After code reviews reveal gaps

### Keeping Skills Lean

From the Reddit post:
- Main SKILL.md should be < 500 lines
- Use progressive disclosure (link to resources)
- Keep examples concise and relevant
- Remove outdated patterns

### Testing Skills

Test that skills are working by:
1. Asking questions that should trigger the skill
2. Verifying Claude references the skill's patterns
3. Checking that generated code follows guidelines
4. Reviewing consistency across the codebase

## Related Documentation

- `CLAUDE.md` - Main project guidelines
- `dev/PROJECT_ARCHITECTURE.md` - System architecture
- `backend/README.md` - Backend documentation
- `frontend/README.md` - Frontend documentation

## Future Skills to Consider

Based on your project needs, consider adding:

- **testing-guidelines** - Unit and integration testing patterns
- **api-design** - RESTful API best practices
- **performance** - Optimization patterns
- **deployment** - Deployment and DevOps guidelines
- **security** - Security best practices
- **livestock-management** - Domain-specific patterns for livestock features
- **garden-planning** - Domain-specific patterns for garden features

---

**Last Updated**: 2025-11-11

For more information on skills, see:
- [Claude Code Skills Documentation](https://docs.claude.com/docs/claude-code/skills)
- The Reddit post example repository
