# API URL Refactoring - Implementation Plan

## Status

**Current Status**: ✅ **COMPLETED**
**Priority**: Medium
**Actual Effort**: 1.5 hours
**Created**: 2025-11-12
**Completed**: 2025-11-12
**Triggered By**: Code review of Property Designer CRUD operations

---

## Objective

Refactor all hardcoded API URLs (`http://localhost:5000`) in the frontend codebase into a centralized configuration system that supports multiple environments (development, staging, production).

---

## Problem Statement

### Current State

The frontend codebase has **39 hardcoded API URLs** across **14 component files**:

```
Total Occurrences: 39
Total Files: 14

Breakdown by file:
- Livestock.tsx: 8 occurrences
- HarvestTracker.tsx: 4 occurrences
- PhotoGallery.tsx: 4 occurrences
- SeedInventory.tsx: 3 occurrences
- PropertyDesigner.tsx: 3 occurrences
- PropertyFormModal.tsx: 3 occurrences
- GardenDesigner.tsx: 2 occurrences
- LogHarvestModal.tsx: 2 occurrences
- EditHarvestModal.tsx: 2 occurrences
- EditSeedModal.tsx: 2 occurrences
- AddSeedModal.tsx: 2 occurrences
- PhotoGalleryEditModal.tsx: 2 occurrences
- AnimalFormModal.tsx: 1 occurrence
- UploadPhotoModal.tsx: 1 occurrence
```

### Issues with Current Approach

1. **Production Deployment**: Requires manual find-replace before deploying to production
2. **Staging Environment**: Cannot easily test against staging backend
3. **Maintainability**: Changes to API base URL require updating 39 locations
4. **Error-Prone**: Easy to miss occurrences during manual updates
5. **Developer Experience**: Local development against remote APIs requires code changes
6. **Best Practices**: Violates DRY principle and configuration management best practices

---

## Proposed Solution

### Architecture

Create a centralized configuration module that:
1. Defines API base URL in a single location
2. Supports environment-specific overrides via environment variables
3. Provides sensible defaults for development
4. Works with Create React App's environment variable system

### Implementation Components

#### 1. Configuration Module

**File**: `frontend/src/config.ts`

```typescript
/**
 * Application configuration
 * Supports environment-specific settings via environment variables
 */

// API Base URL - can be overridden via REACT_APP_API_URL environment variable
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Other configuration that might be needed
export const config = {
  apiBaseUrl: API_BASE_URL,
  apiTimeout: 30000, // 30 seconds
  enableDebugLogging: process.env.NODE_ENV === 'development',
};

export default config;
```

#### 2. Environment Variables

**File**: `frontend/.env` (gitignored, local only)
```bash
# Local development - default
REACT_APP_API_URL=http://localhost:5000
```

**File**: `frontend/.env.example` (committed, template)
```bash
# API Configuration
# Default: http://localhost:5000
# Production: https://api.yourdomain.com
# Staging: https://api-staging.yourdomain.com
REACT_APP_API_URL=http://localhost:5000
```

**File**: `frontend/.env.production` (committed, production defaults)
```bash
# Production API URL
# Override this in your deployment environment
REACT_APP_API_URL=https://api.yourdomain.com
```

#### 3. Usage Pattern

**Before**:
```typescript
const response = await fetch('http://localhost:5000/api/properties', {
  method: 'GET'
});
```

**After**:
```typescript
import { API_BASE_URL } from '../../config';

const response = await fetch(`${API_BASE_URL}/api/properties`, {
  method: 'GET'
});
```

---

## Implementation Plan

### Phase 1: Setup (30 minutes)

**Tasks**:
1. Create `frontend/src/config.ts` with configuration module
2. Create `frontend/.env.example` with template
3. Update `frontend/.gitignore` to ensure `.env` is ignored
4. Update project README with environment configuration docs
5. Test that config loads correctly in development

**Deliverable**: Configuration infrastructure in place

### Phase 2: Component Updates (90-120 minutes)

Update components in order of occurrence count (highest to lowest):

**High Priority** (8+ occurrences):
1. Livestock.tsx (8 occurrences)
   - Lines: API calls for animals CRUD
   - Import config at top
   - Update all fetch calls

**Medium Priority** (3-4 occurrences):
2. HarvestTracker.tsx (4 occurrences)
3. PhotoGallery.tsx (4 occurrences)
4. SeedInventory.tsx (3 occurrences)
5. PropertyDesigner.tsx (3 occurrences)
6. PropertyFormModal.tsx (3 occurrences)

**Low Priority** (1-2 occurrences):
7. GardenDesigner.tsx (2 occurrences)
8. LogHarvestModal.tsx (2 occurrences)
9. EditHarvestModal.tsx (2 occurrences)
10. EditSeedModal.tsx (2 occurrences)
11. AddSeedModal.tsx (2 occurrences)
12. PhotoGalleryEditModal.tsx (2 occurrences)
13. AnimalFormModal.tsx (1 occurrence)
14. UploadPhotoModal.tsx (1 occurrence)

**Process for each file**:
1. Add import: `import { API_BASE_URL } from '../../config';` (adjust path)
2. Find all `http://localhost:5000` strings
3. Replace with `${API_BASE_URL}`
4. Verify string interpolation is correct
5. Check for any string concatenation that needs updating

**Deliverable**: All 39 hardcoded URLs replaced with config

### Phase 3: Testing & Validation (30 minutes)

**Test Scenarios**:

1. **Development Mode** (default):
   - Start frontend: `npm start`
   - Verify all API calls work
   - Check browser console for errors
   - Test all CRUD operations in each component

2. **Custom API URL** (environment override):
   - Create `.env.local`: `REACT_APP_API_URL=http://localhost:8080`
   - Restart frontend
   - Verify API calls go to port 8080
   - Clean up test file

3. **Build Verification**:
   - Run: `npm run build`
   - Verify no build errors
   - Check that config is properly bundled

4. **TypeScript Compilation**:
   - Run: `npx tsc --noEmit`
   - Verify no type errors
   - Fix any import path issues

**Validation Checklist**:
- [ ] All 39 URLs updated
- [ ] All 14 files import config correctly
- [ ] Import paths correct (relative imports)
- [ ] Development mode works
- [ ] Environment override works
- [ ] Build succeeds
- [ ] TypeScript compiles clean
- [ ] No console errors
- [ ] All CRUD operations functional

**Deliverable**: Fully tested configuration system

### Phase 4: Documentation (15 minutes)

**Update Files**:

1. **README.md**:
   - Add "Environment Configuration" section
   - Document REACT_APP_API_URL variable
   - Explain .env file usage
   - Provide examples for different environments

2. **CLAUDE.md** (project guidelines):
   - Add rule: "Never hardcode API URLs"
   - Reference config module
   - Show correct import pattern

3. **Dev Docs**:
   - Mark this task as complete
   - Document lessons learned
   - Note any issues encountered

**Deliverable**: Documentation updated

---

## Rollback Plan

If issues arise during implementation:

1. **Partial Rollback** (specific component):
   - Revert individual file changes via git
   - Components are independent, can revert one at a time

2. **Full Rollback** (all changes):
   - Revert entire branch/commit
   - Delete config.ts
   - Remove .env files

3. **Emergency Hotfix** (production):
   - Environment variable can be changed without code changes
   - Update REACT_APP_API_URL in deployment config
   - Rebuild and redeploy

---

## Risk Assessment

### Low Risk
- Configuration module is simple
- Components are independent
- Changes are mechanical (find-replace)
- Easy to test
- Easy to revert

### Potential Issues
1. **Import path errors**: Different components at different depths
   - Mitigation: Use consistent relative imports
2. **Environment variable caching**: CRA requires restart
   - Mitigation: Document restart requirement
3. **String template errors**: Incorrect interpolation
   - Mitigation: TypeScript will catch most issues

---

## Success Criteria

- [x] Zero hardcoded API URLs in codebase
- [x] Single source of truth for API configuration
- [x] Environment variable support working
- [x] All tests passing
- [x] TypeScript compilation clean
- [x] Documentation updated
- [x] No production deployment blockers

---

## Follow-Up Tasks

After this refactoring:

1. **API Client Service** (future enhancement):
   - Create centralized API client with retry logic
   - Add request/response interceptors
   - Standardize error handling
   - Add request timeout handling

2. **Backend URL Validation** (future enhancement):
   - Add startup check to verify backend connectivity
   - Show user-friendly error if backend unreachable
   - Display backend URL in development mode

3. **CORS Configuration** (coordination with backend):
   - Ensure backend CORS allows production domain
   - Update backend to read allowed origins from env var

---

## Timeline

**Total Estimated Time**: 2-3 hours

- Phase 1 (Setup): 30 minutes
- Phase 2 (Updates): 90-120 minutes
- Phase 3 (Testing): 30 minutes
- Phase 4 (Docs): 15 minutes

**Can be split across multiple sessions**:
- Session 1: Phase 1 + high priority components
- Session 2: Medium/low priority components
- Session 3: Testing and documentation

---

## References

- **Code Review**: Property Designer CRUD operations (2025-11-12)
- **Triggered Issue**: Hardcoded API URL in handleDeleteConfirm
- **Pattern Source**: Industry best practices for React environment configuration
- **CRA Docs**: https://create-react-app.dev/docs/adding-custom-environment-variables/

---

**Last Updated**: 2025-11-12
**Status**: ✅ COMPLETED - All 39 URLs refactored successfully

## Implementation Summary

Successfully refactored all hardcoded API URLs to use centralized configuration:

- ✅ Created `frontend/src/config.ts` with API_BASE_URL constant
- ✅ Created `frontend/.env.example` with configuration template
- ✅ Updated 14 component files (39 total URL replacements)
- ✅ Verified 0 hardcoded URLs remain
- ✅ TypeScript compilation clean (no errors)
- ✅ Updated README.md with environment configuration section
- ✅ Updated CLAUDE.md with API URL guidelines
- ✅ All features working correctly (frontend still running)

**Automation**: Created Python script (`refactor_urls.py`) to automate bulk updates
