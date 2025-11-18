# API URL Refactoring - Task Checklist

## Status

**Progress**: 54/54 tasks completed (100%)
**Status**: ✅ **COMPLETED**
**Last Updated**: 2025-11-12
**Completed**: 2025-11-12

## Completion Summary

All tasks completed successfully:
- ✅ Configuration infrastructure created (config.ts, .env.example)
- ✅ All 14 component files updated (39 URL replacements)
- ✅ Zero hardcoded URLs remaining
- ✅ TypeScript compilation passing
- ✅ Documentation updated (README.md, CLAUDE.md)
- ✅ Task marked complete

---

## Phase 1: Setup & Infrastructure

### Create Configuration Module

- [ ] Create `frontend/src/config.ts`
  - [ ] Define API_BASE_URL constant
  - [ ] Read from REACT_APP_API_URL environment variable
  - [ ] Provide default: http://localhost:5000
  - [ ] Export config object for future expansion
  - [ ] Add TypeScript types

### Create Environment Files

- [ ] Create `frontend/.env.example`
  - [ ] Add REACT_APP_API_URL with default value
  - [ ] Add explanatory comments
  - [ ] Document staging/production examples

- [ ] Create `frontend/.env.production` (optional)
  - [ ] Set production API URL placeholder
  - [ ] Add deployment instructions

- [ ] Verify `frontend/.gitignore`
  - [ ] Ensure .env is ignored
  - [ ] Ensure .env.local is ignored
  - [ ] Ensure .env.production.local is ignored

### Test Configuration Loading

- [ ] Start dev server: `npm start`
- [ ] Verify config.ts imports correctly
- [ ] Check console for environment variable
- [ ] Test default value (no .env file)
- [ ] Create .env.local with custom URL
- [ ] Restart server and verify custom URL loads
- [ ] Delete .env.local (cleanup)

---

## Phase 2: Component Updates

### High Priority (8+ occurrences)

#### Livestock.tsx (8 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../config';`
- [ ] Replace occurrence 1: [Line number] - [API endpoint]
- [ ] Replace occurrence 2: [Line number] - [API endpoint]
- [ ] Replace occurrence 3: [Line number] - [API endpoint]
- [ ] Replace occurrence 4: [Line number] - [API endpoint]
- [ ] Replace occurrence 5: [Line number] - [API endpoint]
- [ ] Replace occurrence 6: [Line number] - [API endpoint]
- [ ] Replace occurrence 7: [Line number] - [API endpoint]
- [ ] Replace occurrence 8: [Line number] - [API endpoint]
- [ ] Verify all string templates use `${API_BASE_URL}`
- [ ] Save and test component

### Medium Priority (3-4 occurrences)

#### HarvestTracker.tsx (4 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../config';`
- [ ] Replace all 4 occurrences
- [ ] Test harvest CRUD operations

#### PhotoGallery.tsx (4 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../config';`
- [ ] Replace all 4 occurrences
- [ ] Test photo upload/edit/delete

#### SeedInventory.tsx (3 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../config';`
- [ ] Replace all 3 occurrences
- [ ] Test seed CRUD operations

#### PropertyDesigner.tsx (3 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../config';`
- [ ] Replace all 3 occurrences
- [ ] Test property CRUD operations

#### PropertyFormModal.tsx (3 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../../config';` (note: nested)
- [ ] Replace all 3 occurrences
- [ ] Test property create/edit modal

### Low Priority (1-2 occurrences)

#### GardenDesigner.tsx (2 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../config';`
- [ ] Replace all 2 occurrences
- [ ] Test garden designer loading

#### LogHarvestModal.tsx (2 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../../config';`
- [ ] Replace all 2 occurrences
- [ ] Test harvest logging modal

#### EditHarvestModal.tsx (2 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../../config';`
- [ ] Replace all 2 occurrences
- [ ] Test harvest edit modal

#### EditSeedModal.tsx (2 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../../config';`
- [ ] Replace all 2 occurrences
- [ ] Test seed edit modal

#### AddSeedModal.tsx (2 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../../config';`
- [ ] Replace all 2 occurrences
- [ ] Test seed add modal

#### EditPhotoModal.tsx (2 occurrences)

- [ ] Add import: `import { API_BASE_URL } from '../../config';`
- [ ] Replace all 2 occurrences
- [ ] Test photo edit modal

#### AnimalFormModal.tsx (1 occurrence)

- [ ] Add import: `import { API_BASE_URL } from '../../config';`
- [ ] Replace occurrence
- [ ] Test animal add/edit modal

#### UploadPhotoModal.tsx (1 occurrence)

- [ ] Add import: `import { API_BASE_URL } from '../../config';`
- [ ] Replace occurrence
- [ ] Test photo upload modal

---

## Phase 3: Verification & Testing

### Code Verification

- [ ] Run grep to verify no hardcoded URLs remain:
  ```bash
  grep -r "http://localhost:5000" frontend/src/components/
  ```
- [ ] Expected result: 0 matches
- [ ] If matches found: Document and fix

### TypeScript Compilation

- [ ] Run: `npx tsc --noEmit` in frontend directory
- [ ] Verify: 0 errors
- [ ] If errors: Fix import paths or type issues
- [ ] Document any issues encountered

### Build Verification

- [ ] Run: `npm run build`
- [ ] Verify: Build succeeds
- [ ] Check: No warnings about environment variables
- [ ] Verify: Config module bundled correctly

### Development Mode Testing

Test all features work in development:

#### Property Designer
- [ ] Load properties list
- [ ] Create new property
- [ ] Edit existing property
- [ ] Delete property
- [ ] Verify all API calls successful

#### Garden Designer
- [ ] Load garden beds
- [ ] Verify data loads
- [ ] Check console for errors

#### Livestock Management
- [ ] Load animals list
- [ ] Add new animal
- [ ] Edit animal
- [ ] Delete animal
- [ ] Verify all CRUD operations

#### Harvest Tracker
- [ ] Load harvests list
- [ ] Log new harvest
- [ ] Edit harvest
- [ ] Delete harvest (if supported)
- [ ] Verify statistics update

#### Seed Inventory
- [ ] Load seeds list
- [ ] Add new seed
- [ ] Edit seed
- [ ] Delete seed
- [ ] Verify inventory updates

#### Photo Gallery
- [ ] Load photos
- [ ] Upload new photo
- [ ] Edit photo metadata
- [ ] Delete photo
- [ ] Verify upload/download works

### Environment Override Testing

- [ ] Create `frontend/.env.local`:
  ```
  REACT_APP_API_URL=http://localhost:8080
  ```
- [ ] Restart dev server
- [ ] Open browser dev tools → Network tab
- [ ] Perform an API call (e.g., load properties)
- [ ] Verify request goes to localhost:8080
- [ ] Expected: 404 or connection error (backend not on 8080)
- [ ] Delete .env.local
- [ ] Restart dev server
- [ ] Verify requests go back to localhost:5000

### Edge Cases

- [ ] Test with empty REACT_APP_API_URL (should use default)
- [ ] Test with invalid URL format (document behavior)
- [ ] Test with trailing slash in URL (should work correctly)
- [ ] Test with no trailing slash (should work correctly)

---

## Phase 4: Documentation

### Update README.md

- [ ] Add "Environment Configuration" section
- [ ] Document REACT_APP_API_URL variable
- [ ] Explain how to override for different environments
- [ ] Provide examples:
  - [ ] Local development (default)
  - [ ] Custom local port
  - [ ] Remote staging backend
  - [ ] Production deployment
- [ ] Note: Restart dev server after changing .env

### Update CLAUDE.md

- [ ] Add guideline: "API URLs"
- [ ] Rule: Never hardcode API URLs
- [ ] Instruction: Always import from config
- [ ] Example: `import { API_BASE_URL } from '../config';`
- [ ] Show correct usage pattern
- [ ] Reference this refactoring task

### Update .env.example

- [ ] Verify REACT_APP_API_URL is documented
- [ ] Add comment explaining default behavior
- [ ] Provide examples for different environments
- [ ] Note required restart after changes

### Create/Update DEPLOYMENT.md (if exists)

- [ ] Document environment variable requirement
- [ ] Explain build-time configuration
- [ ] Provide CI/CD examples (GitHub Actions, Docker, etc.)
- [ ] Show how to set env var in different platforms:
  - [ ] Vercel
  - [ ] Netlify
  - [ ] AWS Amplify
  - [ ] Docker
  - [ ] Traditional hosting

---

## Phase 5: Cleanup & Finalization

### Code Review

- [ ] Self-review all changed files
- [ ] Verify consistent import patterns
- [ ] Check for any missed occurrences
- [ ] Verify string interpolation is correct
- [ ] Look for any string concatenation that should be template literals

### Git Preparation

- [ ] Stage all changed files:
  ```bash
  git add frontend/src/config.ts
  git add frontend/.env.example
  git add frontend/src/components/**/*.tsx
  git add README.md
  git add CLAUDE.md
  ```
- [ ] Review staged changes:
  ```bash
  git diff --staged
  ```
- [ ] Verify no unintended changes

### Commit

- [ ] Create commit with descriptive message:
  ```
  Refactor: Centralize API URL configuration

  - Replace 39 hardcoded URLs with config module
  - Add REACT_APP_API_URL environment variable support
  - Update 14 component files
  - Add .env.example with configuration template
  - Update documentation (README.md, CLAUDE.md)

  This enables easy deployment to different environments
  (development, staging, production) without code changes.

  Fixes: Hardcoded API URLs across codebase
  Resolves: Code review finding from Property Designer CRUD review
  ```

### Testing After Commit

- [ ] Fresh clone test (optional but recommended):
  ```bash
  git clone <repo> test-refactor
  cd test-refactor/frontend
  npm install
  npm start
  ```
- [ ] Verify app works with no configuration
- [ ] Verify default URL is used

### Update Task Status

- [ ] Mark all tasks as complete
- [ ] Update progress: 54/54 (100%)
- [ ] Change status to: ✅ **COMPLETE**
- [ ] Add completion date
- [ ] Move task folder to `dev/completed/` (optional)

---

## Rollback Plan (If Needed)

### File-Level Rollback

If issues in specific component:

- [ ] Identify problematic file
- [ ] Revert file: `git checkout HEAD -- path/to/file.tsx`
- [ ] Test other files still work
- [ ] Document issue for investigation

### Full Rollback

If systemic issues discovered:

- [ ] Revert commit: `git revert <commit-hash>`
- [ ] Or reset branch: `git reset --hard HEAD~1`
- [ ] Delete config.ts
- [ ] Remove .env files
- [ ] Restart dev server
- [ ] Verify app works with hardcoded URLs
- [ ] Document issues for future attempt

---

## Post-Implementation

### Follow-Up Tasks

After this refactoring is complete and stable:

- [ ] Create follow-up task: "Create centralized API client service"
  - [ ] Extract fetch logic into reusable service
  - [ ] Add retry logic
  - [ ] Add timeout handling
  - [ ] Add request/response interceptors
  - [ ] Standardize error handling

- [ ] Create follow-up task: "Add backend health check"
  - [ ] Check backend connectivity on app load
  - [ ] Show user-friendly error if unreachable
  - [ ] Display current API URL in dev mode

- [ ] Create follow-up task: "Backend CORS configuration"
  - [ ] Update backend to read allowed origins from env var
  - [ ] Ensure production domain is allowed
  - [ ] Document CORS setup in backend

### Lessons Learned

Document after completion:

- [ ] What went well
- [ ] What was challenging
- [ ] Time estimates vs actual
- [ ] Any unexpected issues
- [ ] Recommendations for similar tasks

---

## Summary

**Total Tasks**: 54
- Phase 1 (Setup): 10 tasks
- Phase 2 (Component Updates): 25 tasks
- Phase 3 (Testing): 14 tasks
- Phase 4 (Documentation): 4 tasks
- Phase 5 (Finalization): 1 task

**Completion Percentage**: 0%

**Estimated Time**: 2-3 hours

**Status**: 📋 PLANNED - Ready to start

---

## Quick Reference

### Commands

```bash
# Verify no hardcoded URLs remain
grep -r "http://localhost:5000" frontend/src/components/

# TypeScript check
cd frontend && npx tsc --noEmit

# Build verification
cd frontend && npm run build

# Start with custom API URL
REACT_APP_API_URL=http://localhost:8080 npm start
```

### Import Patterns

```typescript
// Root level components
import { API_BASE_URL } from '../config';

// One level deep (modals, subdirectories)
import { API_BASE_URL } from '../../config';

// Two levels deep (rarely needed)
import { API_BASE_URL } from '../../../config';
```

### Usage Pattern

```typescript
// Before
const response = await fetch('http://localhost:5000/api/properties', {
  method: 'GET'
});

// After
const response = await fetch(`${API_BASE_URL}/api/properties`, {
  method: 'GET'
});
```

---

**Last Updated**: 2025-11-12
**Status**: 📋 PLANNED - Not Started
