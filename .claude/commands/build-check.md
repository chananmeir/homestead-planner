---
description: Run build checks on backend and frontend to catch all errors
---

# Build Check - Comprehensive Error Checking

Run build checks on backend and frontend to catch all errors.

## Instructions

Check both backend and frontend for TypeScript, Python, and linting errors.

### 1. Check Backend (Python)

**Python Syntax Check**:
```bash
cd backend
python -m py_compile app.py
python -m py_compile models.py
python -m py_compile garden_methods.py
python -m py_compile plant_database.py
python -m py_compile structures_database.py
```

**Run Flask in Check Mode** (if possible):
```bash
cd backend
python -c "from app import app; print('✓ App imports successfully')"
```

**Check for Common Issues**:
- Import errors
- Syntax errors
- Undefined variables
- Type issues

### 2. Check Frontend (TypeScript)

**TypeScript Compiler Check**:
```bash
cd frontend
npx tsc --noEmit
```

This checks all TypeScript without emitting files.

**Count Errors**:
- Parse output to count errors
- Group by file if many errors
- Identify most common error types

### 3. Categorize Errors

**Critical Errors** (Block functionality):
- Syntax errors
- Import errors
- Type errors that would cause runtime issues
- Missing required properties

**Non-Critical Errors** (Should fix but not blocking):
- Unused variables
- Any type usage
- Style violations
- Missing types on parameters

### 4. Present Results

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 BUILD CHECK RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BACKEND (Python)
Status: [✅ Clean / ⚠️ Warnings / ❌ Errors]

[If errors, show them]

FRONTEND (TypeScript)
Status: [✅ Clean / ⚠️ Warnings / ❌ Errors]
Error Count: X

[Show errors, grouped by file if many]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 5. Handle Error Counts

**If 0 errors**:
```
✅ All checks passed! No errors found.
```

**If 1-5 errors**:
```
Show all errors with context
Offer to fix them
```

**If 6-15 errors**:
```
Show first 10 errors
Offer to fix all or launch systematic fixing
```

**If > 15 errors**:
```
Show summary by file
Group by error type
Recommend systematic approach:
- Create a task to fix them
- Or fix file by file
- Or use build-error-resolver agent (if created)
```

### 6. Detailed Error Display

For each error shown:

```
[File: path/to/file.tsx:45:12]
error TS2339: Property 'width' does not exist on type 'GardenBed'.

Context (line 45):
  const area = bed.width * bed.length;
                   ^^^^^

Issue: Accessing non-existent property
Fix: Check if 'width' is defined in GardenBed type
```

### 7. Offer Solutions

Based on results:

**All Clean**:
```
✅ Build checks passed!

Would you like to:
- Run tests
- Commit changes
- Continue development
```

**Few Errors**:
```
❌ Found X errors

Would you like me to:
- Fix all errors now
- Fix errors one by one
- Explain the errors first
```

**Many Errors**:
```
❌ Found X errors across Y files

I recommend:
1. Fixing errors file by file
2. Starting with most critical files
3. Creating a task checklist

Which approach would you prefer?
```

## Additional Checks (Optional)

**Linting** (if configured):
```bash
# Backend
cd backend
pylint app.py

# Frontend
cd frontend
npm run lint
```

**Tests** (if they exist):
```bash
# Backend
cd backend
python -m pytest

# Frontend
cd frontend
npm test
```

**Import Order** (Backend):
- Check imports are organized (stdlib, third-party, local)

**Unused Imports** (Both):
- Identify unused imports
- Suggest removal

## Important Notes

- Always check both backend and frontend
- Show context around errors when possible
- Group errors logically (by file or type)
- Offer to fix, don't just report
- Be specific about error locations
- Explain why errors matter
- Suggest concrete fixes

## Error Patterns to Watch For

**Backend**:
- Missing db.session.rollback()
- No error handling on DB operations
- Missing jsonify() on responses
- Incorrect HTTP status codes
- Missing input validation

**Frontend**:
- Missing loading/error states
- No try-catch on fetch
- Missing response.ok check
- Incorrect types
- Missing useEffect dependencies
- Non-immutable state updates

## Example Usage

```
/build-check

Run a full build check on both backend and frontend
```

Or:

```
/build-check

I've made a lot of changes. Check if everything still compiles.
```

The command will:
1. Run Python syntax checks
2. Run TypeScript compiler
3. Count and categorize errors
4. Present results clearly
5. Offer to fix issues

---

**Remember**: Clean builds = happy deploys. Check early, check often!
