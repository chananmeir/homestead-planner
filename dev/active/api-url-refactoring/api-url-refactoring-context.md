# API URL Refactoring - Context & Decisions

## Origin & Rationale

### Discovery

**Date**: 2025-11-12
**Source**: Code review of Property Designer CRUD operations (Phase 2)
**Reviewer**: Claude Code
**Severity**: Important (Should Fix)

**Finding**:
```typescript
// PropertyDesigner.tsx:106-109
const response = await fetch(
  `http://localhost:5000/api/properties/${deleteConfirm.propertyId}`,
  { method: 'DELETE' }
);
```

**Issue**: Hardcoded API URL makes the application less maintainable and prevents easy deployment to different environments.

### Why This Matters

1. **Production Deployment**:
   - Current process requires manual find-replace of all URLs
   - Risk of missing occurrences (39 total!)
   - Error-prone and time-consuming

2. **Development Workflow**:
   - Cannot easily test against staging backend
   - Cannot run local frontend against remote backend
   - Team members may have different backend ports

3. **Code Quality**:
   - Violates DRY (Don't Repeat Yourself) principle
   - Makes codebase harder to maintain
   - Inconsistent with industry best practices

4. **DevOps**:
   - Environment-specific configurations should be external
   - Build artifacts should be environment-agnostic
   - Configuration should be injected at deployment time

---

## Current State Analysis

### Scope of Issue

**Discovered via grep search**: `http://localhost:5000`

```
Total Occurrences: 39
Total Files Affected: 14
Components Impacted: All major features
```

**Distribution**:
- Livestock management: 9 occurrences (Livestock.tsx + AnimalFormModal.tsx)
- Harvest tracking: 8 occurrences (HarvestTracker.tsx + modals)
- Photo gallery: 7 occurrences (PhotoGallery.tsx + modals)
- Seed inventory: 7 occurrences (SeedInventory.tsx + modals)
- Property designer: 6 occurrences (PropertyDesigner.tsx + PropertyFormModal.tsx)
- Garden designer: 2 occurrences (GardenDesigner.tsx)

### Pattern Analysis

**Current pattern** (repeated 39 times):
```typescript
fetch('http://localhost:5000/api/endpoint', options)
```

**Variations observed**:
1. Direct string: `'http://localhost:5000/api/...'`
2. Template literal: `` `http://localhost:5000/api/${id}` ``
3. String concatenation: `'http://localhost:5000' + '/api/...'` (rare)

**No existing configuration**:
- No config.ts file
- No environment variable usage
- No API client abstraction
- Each component independently hardcodes URL

---

## Solution Architecture

### Decision 1: Use React Environment Variables

**What**: Leverage Create React App's built-in environment variable support

**Why**:
- Already part of CRA infrastructure (no new dependencies)
- Well-documented and widely used
- Supports multiple environment files (.env, .env.local, .env.production)
- Variables prefixed with REACT_APP_ are automatically embedded in build
- No build configuration changes needed

**Alternatives Considered**:
- **Custom config module only**: Would still need different builds for different environments
- **dotenv package**: Redundant, CRA already includes dotenv
- **Config server**: Overkill for this use case
- **Build-time replacement**: Less flexible than runtime configuration

**Decision**: Use CRA environment variables with config.ts wrapper

### Decision 2: Create Config Module

**What**: Create `frontend/src/config.ts` as single source of truth

**Why**:
- Provides typed, IDE-friendly imports
- Can include validation and defaults
- Allows future expansion (timeouts, feature flags, etc.)
- Keeps environment variable access in one place
- Makes testing easier (can mock config module)

**Implementation**:
```typescript
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const config = {
  apiBaseUrl: API_BASE_URL,
  // Future additions:
  // apiTimeout: 30000,
  // enableDebugLogging: process.env.NODE_ENV === 'development',
};
```

**Alternatives Considered**:
- **Direct env var access**: `process.env.REACT_APP_API_URL` in every component
  - Rejected: Repetitive, harder to change, no type safety
- **API client class**: `new ApiClient(baseUrl)`
  - Deferred: Good future enhancement, but too large for this refactoring
- **Context/Provider**: `<ApiConfigProvider>`
  - Rejected: Overkill for simple URL configuration

### Decision 3: Gradual, File-by-File Migration

**What**: Update components one file at a time, highest usage first

**Why**:
- Safer than mass find-replace
- Can test after each file
- Can revert individual files if issues arise
- Reduces merge conflict risk
- Allows learning from early files

**Order of Implementation**:
1. Create config infrastructure
2. Update high-usage files first (Livestock.tsx: 8 occurrences)
3. Update medium-usage files
4. Update low-usage files
5. Validate and test

**Alternatives Considered**:
- **Mass find-replace**: Fast but risky, harder to revert, error-prone
- **Random order**: No clear benefit
- **Alphabetical order**: Doesn't prioritize high-impact files

### Decision 4: Sensible Development Default

**What**: Default to `http://localhost:5000` if no env var set

**Why**:
- Matches current development setup
- Zero configuration needed for new developers
- Backend runs on 5000 by convention
- Fails safely (localhost is safe, won't make external requests)

**Implementation**:
```typescript
process.env.REACT_APP_API_URL || 'http://localhost:5000'
```

**Alternatives Considered**:
- **No default**: Force explicit configuration
  - Rejected: Creates friction for new developers
- **Empty string default**: Relative URLs
  - Rejected: Backend and frontend on different ports
- **Different default port**: e.g., 8080
  - Rejected: Backend already uses 5000

---

## Impact Assessment

### Components Affected

**All major feature areas**:
- ✓ Property Designer
- ✓ Garden Designer
- ✓ Livestock Management
- ✓ Harvest Tracker
- ✓ Seed Inventory
- ✓ Photo Gallery

**No components are immune** - this is a system-wide change.

### Breaking Changes

**None expected**:
- Development behavior unchanged (still uses localhost:5000)
- Existing environment files respected
- Backward compatible with current setup

### User Impact

**End users**: Zero impact
- No UI changes
- No functionality changes
- No performance changes

**Developers**: Positive impact
- Can override API URL via .env
- Can test against remote backends
- Easier onboarding (configuration documented)

**DevOps/Deployment**: Positive impact
- Environment-specific builds easier
- Configuration external to code
- Follows infrastructure-as-code principles

---

## Environment Strategy

### Development (.env)

**Default** (no file needed):
```bash
# Uses default: http://localhost:5000
```

**Custom backend** (.env.local):
```bash
REACT_APP_API_URL=http://localhost:8080
```

**Remote backend** (.env.local):
```bash
REACT_APP_API_URL=https://api-dev.example.com
```

### Staging (.env.staging)

```bash
REACT_APP_API_URL=https://api-staging.example.com
```

### Production (.env.production)

```bash
REACT_APP_API_URL=https://api.example.com
```

### CI/CD Integration

**Build command**:
```bash
# Development
npm run build

# Staging
REACT_APP_API_URL=https://api-staging.example.com npm run build

# Production
REACT_APP_API_URL=https://api.example.com npm run build
```

**Docker example**:
```dockerfile
# Build stage
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build
```

---

## Technical Considerations

### Import Paths

**Challenge**: Components at different directory depths

**Solution**: Use correct relative imports

```typescript
// Root level: src/components/Component.tsx
import { API_BASE_URL } from '../config';

// One level deep: src/components/SubDir/Component.tsx
import { API_BASE_URL } from '../../config';

// Two levels deep: src/components/SubDir/SubSubDir/Component.tsx
import { API_BASE_URL } from '../../../config';
```

**Verification**: TypeScript will error if path is wrong

### String Interpolation

**Challenge**: Mixing string templates and URL construction

**Before**:
```typescript
// Template literal
`http://localhost:5000/api/properties/${id}`

// String concatenation
'http://localhost:5000' + '/api/properties'
```

**After**:
```typescript
// Template literal (preferred)
`${API_BASE_URL}/api/properties/${id}`

// String concatenation (avoid)
API_BASE_URL + '/api/properties'
```

**Best Practice**: Always use template literals for consistency

### Environment Variable Caching

**Issue**: CRA caches environment variables at build/start time

**Impact**: Changes to .env require restart of dev server

**Solution**: Document clearly in README

```markdown
## Changing API URL

If you modify REACT_APP_API_URL in .env:
1. Stop the development server (Ctrl+C)
2. Restart: npm start
3. Hard refresh browser (Ctrl+Shift+R)
```

### TypeScript Considerations

**Type safety**: `process.env.REACT_APP_API_URL` is `string | undefined`

**Our solution**: Default value ensures always defined
```typescript
const API_BASE_URL: string = process.env.REACT_APP_API_URL || 'http://localhost:5000';
```

**Alternative**: Type assertion (not recommended)
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL!; // Don't do this
```

---

## Future Enhancements

### Phase 2: API Client Service

After config refactoring is complete, consider creating a centralized API client:

```typescript
// services/api.ts
import { API_BASE_URL } from '../config';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  private async request(endpoint: string, options: RequestInit) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }
}

export const api = new ApiClient();
```

**Benefits**:
- Centralized error handling
- Request/response interceptors
- Retry logic
- Timeout handling
- Authentication header management

**Decision**: Defer to separate task (out of scope for URL refactoring)

### Phase 3: Backend Health Check

Add startup check to verify backend connectivity:

```typescript
// config.ts
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      timeout: 5000,
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

**Usage**: Show user-friendly error if backend unreachable

**Decision**: Defer to separate task

---

## Lessons from Similar Projects

### Pattern: Configuration Module + Env Vars

**Industry standard approach**:
1. Define config in module
2. Read from environment
3. Provide sensible defaults
4. Export typed constants

**Used by**:
- Next.js (next.config.js)
- Vue CLI (vue.config.js)
- Create React App (env vars)

### Common Pitfalls (Avoided)

1. **No defaults**: Breaks local development
2. **Hard restart required**: Document clearly
3. **Wrong import paths**: TypeScript catches
4. **Forgetting template literals**: Code review catches
5. **Inconsistent patterns**: Standardize in this refactoring

---

## Blockers & Dependencies

### Prerequisites

**None** - can start immediately

### Potential Blockers

1. **Active feature development**: May conflict with in-progress branches
   - Mitigation: Coordinate with team, or do file-by-file as features land

2. **Production deployment**: If urgent deploy needed mid-refactoring
   - Mitigation: Can pause refactoring, existing code still works

3. **Backend changes**: If backend port or URL structure changes
   - Mitigation: This refactoring makes it EASIER to handle such changes

### Dependencies

**None** - fully independent task

---

## Testing Strategy

### Unit Testing (Not Required)

Config module is simple and doesn't need unit tests.

### Integration Testing (Manual)

1. **Local development**: Start app, verify all features work
2. **Custom port**: Set REACT_APP_API_URL to 8080, verify
3. **Remote backend**: Set to staging URL, verify
4. **Build verification**: `npm run build` succeeds

### Regression Testing Checklist

Test all CRUD operations in each feature:

- [ ] Property Designer: Create, Edit, Delete properties
- [ ] Garden Designer: Load garden beds
- [ ] Livestock: Add, Edit, Delete animals
- [ ] Harvest Tracker: Log, Edit harvests
- [ ] Seed Inventory: Add, Edit, Delete seeds
- [ ] Photo Gallery: Upload, Edit, Delete photos

---

## Documentation Updates

### Files to Update

1. **README.md**:
   - Add "Configuration" section
   - Document REACT_APP_API_URL
   - Provide .env examples

2. **CLAUDE.md**:
   - Add guideline: "Never hardcode API URLs"
   - Reference config module
   - Show import pattern

3. **STARTUP.md** (if exists):
   - Note environment variable support
   - Link to configuration docs

4. **.env.example**:
   - Create with REACT_APP_API_URL example
   - Add comments explaining usage

---

## Rollback & Contingency

### If Issues Discovered

**File-level revert**:
```bash
git checkout HEAD -- frontend/src/components/Component.tsx
```

**Full revert**:
```bash
git revert <commit-hash>
```

### Emergency Production Fix

If production breaks due to misconfiguration:

1. **Quick fix**: Update REACT_APP_API_URL in deployment config
2. **Rebuild**: Trigger new build with correct URL
3. **Deploy**: Replace broken build with fixed build
4. **Verify**: Test production endpoints

**No code changes needed** - that's the point of environment variables!

---

## Success Metrics

### Quantitative

- [ ] 0 hardcoded URLs remaining (down from 39)
- [ ] 1 config module created
- [ ] 14 files updated
- [ ] 100% of CRUD operations working
- [ ] 0 TypeScript errors
- [ ] 0 build errors

### Qualitative

- [ ] Code is more maintainable
- [ ] Deployment process is simpler
- [ ] Team can easily configure local environment
- [ ] Follows industry best practices
- [ ] Documentation is clear and complete

---

**Last Updated**: 2025-11-12
**Status**: Context documented, ready for implementation
