# API URL Refactoring Task

## Overview

This task documents the refactoring of 39 hardcoded API URLs across 14 frontend component files into a centralized configuration system.

## Status

✅ **COMPLETED** - 2025-11-12

## Quick Links

- **[Implementation Plan](./api-url-refactoring-plan.md)** - Detailed phases, timeline, risk assessment
- **[Context & Decisions](./api-url-refactoring-context.md)** - Why this matters, architectural decisions
- **[Task Checklist](./api-url-refactoring-tasks.md)** - Step-by-step implementation tasks

## Quick Facts

| Metric | Value |
|--------|-------|
| **Hardcoded URLs** | 39 occurrences |
| **Files Affected** | 14 files |
| **Estimated Time** | 2-3 hours |
| **Priority** | Medium |
| **Breaking Changes** | None |
| **Dependencies** | None |

## Origin

**Date**: 2025-11-12
**Source**: Code review of Property Designer CRUD operations (Phase 2)
**Severity**: Important (Should Fix)

**Finding**: Hardcoded `http://localhost:5000` URLs prevent easy deployment to production, staging, or alternative environments.

## The Problem

```typescript
// Current pattern (repeated 39 times)
const response = await fetch('http://localhost:5000/api/properties', {
  method: 'GET'
});
```

**Issues**:
- Manual find-replace required for production deployment
- Cannot test against staging backend easily
- Violates DRY principle
- Error-prone and hard to maintain

## The Solution

```typescript
// Step 1: Create config module
// frontend/src/config.ts
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Step 2: Use in components
import { API_BASE_URL } from '../config';

const response = await fetch(`${API_BASE_URL}/api/properties`, {
  method: 'GET'
});

// Step 3: Configure via environment
// .env
REACT_APP_API_URL=https://api.production.com
```

## Benefits

✅ Single source of truth for API configuration
✅ Environment-specific builds without code changes
✅ Easier onboarding for new developers
✅ Simplified deployment process
✅ Follows industry best practices

## Implementation Phases

1. **Setup** (30 min) - Create config module and environment files
2. **Component Updates** (90-120 min) - Update 14 files, 39 occurrences
3. **Testing** (30 min) - Verify all features work correctly
4. **Documentation** (15 min) - Update README, CLAUDE.md, .env.example

## Files Affected

### New Files
- `frontend/src/config.ts` - Configuration module
- `frontend/.env.example` - Environment variable template

### Modified Files (14)
- `frontend/src/components/Livestock.tsx` (8 occurrences)
- `frontend/src/components/HarvestTracker.tsx` (4 occurrences)
- `frontend/src/components/PhotoGallery.tsx` (4 occurrences)
- `frontend/src/components/SeedInventory.tsx` (3 occurrences)
- `frontend/src/components/PropertyDesigner.tsx` (3 occurrences)
- `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx` (3 occurrences)
- `frontend/src/components/GardenDesigner.tsx` (2 occurrences)
- `frontend/src/components/HarvestTracker/LogHarvestModal.tsx` (2 occurrences)
- `frontend/src/components/HarvestTracker/EditHarvestModal.tsx` (2 occurrences)
- `frontend/src/components/SeedInventory/EditSeedModal.tsx` (2 occurrences)
- `frontend/src/components/SeedInventory/AddSeedModal.tsx` (2 occurrences)
- `frontend/src/components/PhotoGallery/EditPhotoModal.tsx` (2 occurrences)
- `frontend/src/components/Livestock/AnimalFormModal.tsx` (1 occurrence)
- `frontend/src/components/PhotoGallery/UploadPhotoModal.tsx` (1 occurrence)

### Documentation Updates
- `README.md` - Add environment configuration section
- `CLAUDE.md` - Add API URL guidelines
- `.env.example` - Add configuration template

## Getting Started

When ready to implement:

1. Read the [Implementation Plan](./api-url-refactoring-plan.md)
2. Review the [Context & Decisions](./api-url-refactoring-context.md)
3. Follow the [Task Checklist](./api-url-refactoring-tasks.md)

## Testing Strategy

1. **Development Mode**: Verify all features work with default localhost:5000
2. **Custom Port**: Set REACT_APP_API_URL=http://localhost:8080 and verify
3. **Build Verification**: Ensure `npm run build` succeeds
4. **TypeScript Check**: Verify `npx tsc --noEmit` passes

## Rollback Plan

- **File-level**: `git checkout HEAD -- path/to/file.tsx`
- **Full rollback**: `git revert <commit-hash>`
- **Emergency fix**: Update REACT_APP_API_URL in deployment, rebuild, redeploy

No code changes needed for emergency fixes - that's the point!

## Success Criteria

✅ Zero hardcoded URLs in frontend codebase
✅ All 14 files updated with config import
✅ Environment variable support working
✅ All CRUD operations functional
✅ TypeScript compilation clean
✅ Documentation updated

## Future Enhancements

After this refactoring:
- Create centralized API client service with retry logic
- Add backend health check on app startup
- Implement request/response interceptors
- Add timeout handling

## Related Work

- **Property Designer CRUD Operations** (Phase 1 & 2) - The code review that identified this issue
- **Code Review 2025-11-12** - Source of this task

## Contact

**Task Created By**: Claude Code (via /code-review)
**Date**: 2025-11-12
**Status**: Documented and ready for implementation

---

**Next Steps**: When ready to start, open `api-url-refactoring-tasks.md` and begin with Phase 1.
