---
description: Perform a comprehensive code review checking for best practices, patterns, and potential issues
---

# Code Review - Architectural Review

Perform a comprehensive code review checking for best practices, patterns, and potential issues.

## Instructions

Review recent code changes for adherence to project guidelines and best practices.

### 1. Identify Recent Changes

Check for recently modified files:

```bash
# Check git status
git status

# Check recent commits
git log --oneline -5

# Check edited files from hooks
cat .claude/edited-files.json
```

If user specifies files, review those. Otherwise, review recently changed files.

### 2. Load Relevant Skills

Based on files being reviewed, reference:
- @backend-dev-guidelines for Python/Flask files
- @frontend-dev-guidelines for React/TypeScript files
- @database-guidelines for model or migration files

### 3. Review Checklist

**Backend Files (Python/Flask)**:

✅ **Route Handlers**:
- [ ] Follow RESTful conventions (GET, POST, PUT, DELETE)
- [ ] Return appropriate HTTP status codes
- [ ] Use jsonify() for JSON responses
- [ ] Handle errors with try-except
- [ ] Rollback database on errors
- [ ] Validate input data
- [ ] Have docstrings

✅ **Models**:
- [ ] Use proper SQLAlchemy column types
- [ ] Have to_dict() method with camelCase keys
- [ ] Define relationships correctly
- [ ] Set cascade behavior appropriately
- [ ] Include created_at/updated_at timestamps where needed
- [ ] Foreign keys properly defined

✅ **Business Logic**:
- [ ] Extracted from route handlers when complex
- [ ] Reusable and testable
- [ ] Proper error handling
- [ ] Type hints where appropriate

✅ **Error Handling**:
- [ ] All database operations in try-except
- [ ] db.session.rollback() on errors
- [ ] Informative error messages
- [ ] Appropriate status codes

**Frontend Files (React/TypeScript)**:

✅ **Components**:
- [ ] Functional components with hooks
- [ ] Proper TypeScript types for props
- [ ] Handle loading state
- [ ] Handle error state
- [ ] Handle empty state
- [ ] Proper useEffect dependencies
- [ ] Cleanup functions where needed

✅ **API Integration**:
- [ ] Try-catch for fetch calls
- [ ] Check response.ok
- [ ] Parse errors properly
- [ ] Loading indicators during fetch
- [ ] Error messages displayed to user

✅ **Styling**:
- [ ] Use Tailwind utility classes
- [ ] Responsive design (sm:, md:, lg:)
- [ ] Consistent spacing
- [ ] Accessibility (labels, ARIA)

✅ **State Management**:
- [ ] State updates are immutable
- [ ] Types defined for state
- [ ] useCallback/useMemo where appropriate
- [ ] Context used appropriately

**Database Files (Models/Migrations)**:

✅ **Migrations**:
- [ ] Created via flask db migrate
- [ ] NOT direct database modifications
- [ ] Have both upgrade() and downgrade()
- [ ] Tested with up and down
- [ ] Documented if complex

✅ **Schema Changes**:
- [ ] Backward compatible where possible
- [ ] Foreign keys have indexes
- [ ] Constraints appropriate
- [ ] Column types appropriate

**General**:

✅ **Code Quality**:
- [ ] No console.log (frontend) or print statements (backend) left in
- [ ] Consistent naming conventions
- [ ] No commented-out code
- [ ] No hardcoded values that should be config
- [ ] Proper imports organization

✅ **Security**:
- [ ] No SQL injection vulnerabilities
- [ ] Input validation present
- [ ] No exposed secrets or keys
- [ ] CORS configured properly

✅ **Testing**:
- [ ] Edge cases considered
- [ ] Error scenarios handled
- [ ] Tests written (or at least manual test plan)

### 4. Review Each File

For each file:

**Read the File**:
```bash
Read the file completely
```

**Analyze Against Checklist**:
- Check relevant items from checklist above
- Reference the appropriate skill guidelines
- Note patterns used
- Identify issues or potential improvements

**Categorize Findings**:
- 🔴 **Critical**: Must fix (security, errors, bugs)
- 🟡 **Important**: Should fix (best practices, patterns)
- 🔵 **Suggestions**: Nice to have (optimization, style)
- ✅ **Good Practices**: Things done well

### 5. Present Review

Present findings in this format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CODE REVIEW RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files Reviewed: X files
- backend/file1.py
- frontend/src/file2.tsx

🔴 CRITICAL ISSUES (Must Fix): X

[File: path/to/file.py:45]
Issue: Description of critical issue
Why: Why this is a problem
Fix: How to fix it

🟡 IMPORTANT ISSUES (Should Fix): X

[File: path/to/file.tsx:120]
Issue: Description
Why: Why this matters
Fix: Suggested fix

🔵 SUGGESTIONS (Nice to Have): X

[File: path/to/file.py:78]
Suggestion: Description
Why: Potential benefit
How: Implementation suggestion

✅ GOOD PRACTICES OBSERVED:

- [File:line] Description of good practice
- [File:line] Another good practice

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SUMMARY

Critical: X  | Important: Y  | Suggestions: Z

Overall Assessment: [Excellent / Good / Needs Work]

Recommendation: [Ready to merge / Fix critical issues first /
                 Needs significant rework]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 6. Offer to Fix Issues

If there are critical or important issues:

```
Would you like me to fix these issues?
- All issues
- Just critical issues
- Specific issues
```

## Important Notes

- Be constructive, not just critical
- Explain WHY something is an issue
- Reference specific guideline skills
- Include file:line references
- Suggest concrete fixes
- Acknowledge good practices
- Be thorough but not pedantic
- Focus on meaningful improvements

## Example Usage

```
/code-review

Review the recent changes I made to the garden bed CRUD operations.
```

Or:

```
/code-review

Review these specific files:
- backend/app.py
- frontend/src/components/GardenPlanner.tsx
```

The command will:
1. Read and analyze the files
2. Check against all relevant guidelines
3. Categorize findings by severity
4. Present comprehensive review
5. Offer to fix issues

---

**Remember**: Good reviews make good code. Be thorough and constructive!
