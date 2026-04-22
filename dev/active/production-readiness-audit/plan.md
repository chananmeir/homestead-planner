# Production Readiness Audit - Implementation Plan

**Created**: 2026-04-22
**Status**: Active
**Last Updated**: 2026-04-22

## Executive Summary

This workstream turns the broad product promise in `APPLICATION_FEATURES.md` and `USER_JOURNEY.md` into a concrete verification and stabilization process. The first pass restored operational confidence by fixing location-aware fallback behavior and cleaning frontend build warnings tied to simulation-date logic.

## Background

- The product scope is large and cross-domain.
- The repo already contains substantial implementation, so the correct approach is verification plus targeted stabilization, not speculative rewrites.
- Production readiness depends on two things:
  1. Core flows working for users.
  2. Changes being localized enough that new work does not destabilize other areas.

## Objectives

1. Keep backend tests and frontend production build green.
2. Verify the highest-value user journeys against the documented feature set.
3. Reduce structural risk in shared calculation, date, and API-contract paths.

## Implementation Approach

### Phase 1: Stabilize Runtime and Build Health
**Goal**: Eliminate the most immediate operational failures.

**Steps**:
1. Fix network-fragile hardiness-zone lookup.
2. Re-run backend tests to confirm no regressions.
3. Fix frontend hook/import warnings that affect simulation-date behavior.
4. Rebuild the frontend production bundle.

**Files Affected**:
- `backend/services/geocoding_service.py`
- `frontend/src/components/GardenPlanner.tsx`
- `frontend/src/components/MySeedInventory.tsx`
- `frontend/src/components/GardenDesigner/PlannedPlantsSection.tsx`
- `frontend/src/components/PlantingCalendar/SoilTemperatureCard/index.tsx`
- `frontend/src/components/IndoorSeedStarts.tsx`
- `frontend/src/components/HarvestTracker/LogHarvestModal.tsx`

### Phase 2: Feature Verification Matrix
**Goal**: Convert the documented scope into explicit verification targets.

**Steps**:
1. Group features by domain: dashboard, planning, designer, calendar, seeds, weather, nutrition, livestock, compost, photos, admin.
2. Mark each feature as one of:
   - Implemented and verified
   - Implemented but unverified
   - Partial
   - Missing
3. Tie each domain to tests or manual smoke steps.

### Phase 3: User-Journey Validation
**Goal**: Validate the app the way a real homesteader uses it.

**Steps**:
1. Verify onboarding and property/location setup.
2. Verify year planning flow through export to calendar.
3. Verify designer placement, future overlays, and date-aware views.
4. Verify daily operations: dashboard tasks, indoor starts, harvests, inventory.

### Phase 4: Structural Risk Reduction
**Goal**: Reduce hidden coupling and future breakage.

**Steps**:
1. Audit synced backend/frontend calculator pairs.
2. Triage ORM deprecation warnings and cyclic metadata warning.
3. Update stale frontend dependency metadata where safe.

## Testing Strategy

- Backend: `cd backend && python -m pytest`
- Frontend: `cd frontend && npm run build`
- Next recommended verification:
  - Focused frontend tests for planner/designer/calendar modules
  - Playwright smoke pass for top user journeys
  - Manual verification around simulation mode and location-aware features

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Feature surface is too large for ad hoc verification | High | Use a domain-by-domain matrix and only claim verified status where tested |
| Shared calculator logic drifts across backend and frontend | High | Keep sync checks in the next audit pass and avoid one-sided edits |
| Date-aware UI regressions hide until seasonal or simulation use | High | Keep `now`/`today` dependencies explicit and include simulation scenarios in smoke tests |
| External API outages break local behavior | Medium | Prefer deterministic fallbacks for user-critical paths |

## Success Metrics

- Backend test suite passes fully.
- Frontend production build succeeds cleanly.
- Each major product domain has an explicit verification status.
- Next engineering work can target known, prioritized gaps instead of inferred ones.

