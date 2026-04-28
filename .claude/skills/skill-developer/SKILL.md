# Skill Developer - Meta-Skill for Creating Skills

A meta-skill that helps you create new, well-structured skills for Claude Code.

## When to Use This Skill

- Creating domain-specific skills (livestock management, pest control, etc.)
- Adding specialized guideline skills
- Expanding your skill library
- Ensuring consistent skill structure

## Skill Creation Process

### 1. Identify the Need

Good candidates for skills:
- ✅ Repeated patterns in your code
- ✅ Domain-specific knowledge
- ✅ Best practices you want enforced
- ✅ Complex workflows to document
- ✅ Specialized technologies

Not good candidates:
- ❌ One-off tasks
- ❌ Project-specific details (belongs in CLAUDE.md)
- ❌ Constantly changing information

### 2. Plan the Skill

Ask yourself:
- What domain does this cover?
- Who will use it (you, Claude, both)?
- What problems does it solve?
- What patterns should it enforce?

### 3. Structure the Skill

Every skill should have:

```markdown
# Skill Name - Brief Description

## Overview
What this skill covers in 2-3 sentences

## When to Use This Skill
- Bullet points of when to apply
- Specific scenarios
- File patterns or keywords

## Core Principles
1. Fundamental principle 1
2. Fundamental principle 2
3. Fundamental principle 3

## Patterns

### Pattern 1: [Name]
Brief description

**Example**:
\```language
// Code example
\```

**When to Use**: Specific scenarios

**Why**: Explanation of benefits

### Pattern 2: [Name]
[Same structure]

## Common Pitfalls

### ❌ Don't Do This
\```language
// Bad example
\```
**Why**: Explanation

### ✅ Do This Instead
\```language
// Good example
\```
**Why**: Explanation

## Checklist
- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

## Quick Reference
- Quick command 1
- Quick command 2
- File locations

---
**Last Updated**: [Date]
```

### 4. Keep Skills Under 500 Lines

If skill exceeds 500 lines:
1. Create main SKILL.md with overview
2. Create resource files for details
3. Reference resources in main file

Example structure:
```
skill-name/
├── SKILL.md (< 500 lines)
└── resources/
    ├── patterns.md
    ├── examples.md
    └── advanced.md
```

### 5. Add to skill-rules.json

Configure auto-activation:

```json
{
  "your-skill-name": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "description": "Brief description",
    "promptTriggers": {
      "keywords": [
        "keyword1",
        "keyword2"
      ],
      "intentPatterns": [
        "(create|add).*(pattern)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "path/to/files/**/*"
      ],
      "contentPatterns": [
        "import.*Pattern",
        "class.*Name"
      ]
    }
  }
}
```

## Skill Creation Template

Use this template for new skills:

```markdown
# [Skill Name] - [One-line Description]

## Overview

[2-3 sentence description of what this skill covers and why it exists]

## When to Use This Skill

- [Scenario 1]
- [Scenario 2]
- [Scenario 3]

## Core Principles

1. **[Principle Name]**: [Explanation]
2. **[Principle Name]**: [Explanation]
3. **[Principle Name]**: [Explanation]

## Patterns

### [Pattern Category]

#### Pattern 1: [Name]

**Description**: [What this pattern does]

**When to Use**: [Specific scenarios]

**Example**:
\```language
// Good example with comments
const example = implementPattern();
\```

**Why This Works**: [Explanation]

**Common Mistakes**:
- Mistake 1
- Mistake 2

### [Pattern Category 2]

[Repeat structure]

## Common Pitfalls

### ❌ Anti-Pattern 1: [Name]

**Problem**:
\```language
// Bad example
const bad = doThisWrong();
\```

**Why It's Bad**: [Explanation]

**Fix**:
\```language
// Good example
const good = doThisRight();
\```

## Checklist

Before considering [task] complete:

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Quick Reference

### Common Operations
\```bash
# Operation 1
command here

# Operation 2
another command
\```

### File Locations
- Important file 1: `path/to/file`
- Important file 2: `path/to/file`

### Key Concepts
- **Term 1**: Definition
- **Term 2**: Definition

---

**Last Updated**: [Date]
**Related Skills**: [skill-name], [skill-name]
**Related Docs**: [doc-name.md]
```

## Domain-Specific Skill Examples

### Livestock Management Skill

```markdown
# Livestock Management Guidelines

## Overview
Best practices for tracking and managing livestock in Homestead Planner.

## When to Use
- Adding livestock tracking features
- Working with animal health records
- Managing feed and care schedules

## Core Principles
1. Track individual animals, not just groups
2. Maintain health records history
3. Support multiple species/breeds
4. Enable care scheduling

## Patterns

### Adding Livestock

**Model Structure**:
\```python
class Livestock(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    species = db.Column(db.String(50), nullable=False)
    breed = db.Column(db.String(100))
    acquisition_date = db.Column(db.DateTime)
    health_records = db.relationship('HealthRecord')
\```

### Health Records

Track health events:
\```python
class HealthRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    livestock_id = db.Column(db.Integer, db.ForeignKey('livestock.id'))
    date = db.Column(db.DateTime, nullable=False)
    type = db.Column(db.String(50))  # vaccination, treatment, checkup
    notes = db.Column(db.Text)
    veterinarian = db.Column(db.String(100))
\```

[Continue with more patterns...]
```

### Garden Planning Skill

Focus on garden planning methodologies:
- Square foot gardening
- Companion planting
- Succession planting
- Season extension

## Testing New Skills

After creating a skill:

1. **Test Auto-Activation**
   - Use keywords in prompt
   - Check if skill activates
   - Verify hook shows reminder

2. **Test Content**
   - Ask questions the skill should answer
   - Verify patterns are referenced
   - Check examples work

3. **Verify Size**
   - Keep under 500 lines
   - Split if needed

4. **Update Documentation**
   - Add to `.claude/skills/README.md`
   - Document in CLAUDE.md if important

## Skill Maintenance

Keep skills updated:
- ✅ Update when patterns change
- ✅ Add new examples as discovered
- ✅ Remove outdated information
- ✅ Keep "Last Updated" current

## Quick Reference

### Creating a Skill

```bash
# 1. Create directory
mkdir -p .claude/skills/skill-name

# 2. Create SKILL.md from template
# 3. Add to skill-rules.json
# 4. Test activation
```

### Skill Structure Checklist

- [ ] Overview (2-3 sentences)
- [ ] When to Use section
- [ ] Core Principles (3-5)
- [ ] Patterns with examples
- [ ] Common Pitfalls (❌/✅ format)
- [ ] Checklist
- [ ] Quick Reference
- [ ] Under 500 lines

### skill-rules.json Entry

- [ ] Keywords defined
- [ ] Intent patterns included
- [ ] File path triggers (if applicable)
- [ ] Content triggers (if applicable)
- [ ] Priority set appropriately

---

**Related Skills**: None (this is a meta-skill)
**Last Updated**: 2025-11-11
