# Production Readiness Audit - Context & Decisions

**Created**: 2026-04-22
**Last Updated**: 2026-04-22

## Key Files

### Backend
- `backend/services/geocoding_service.py` - Hardiness zone lookup, ZIP fallback, coordinate-based regional fallback.
- `backend/tests/test_geocoding_service.py` - Coverage for ZIP lookup, fallback routing, and geographic edge cases.
- `backend/tests/test_frost_date_lookup.py` - Confirms frost-date resolution still works when zone lookup falls back.

### Frontend
- `frontend/src/components/GardenPlanner.tsx` - Planner filtering, nutrition fetch, simulation-date-sensitive logic.
- `frontend/src/components/MySeedInventory.tsx` - Inventory filtering and expiration logic tied to simulated dates.
- `frontend/src/components/GardenDesigner/PlannedPlantsSection.tsx` - Date-aware season progress display.
- `frontend/src/components/PlantingCalendar/SoilTemperatureCard/index.tsx` - Soil temperature loading callback path.
- `frontend/src/components/HarvestTracker/LogHarvestModal.tsx` - Date-reset logic for harvest logging.
- `frontend/src/components/IndoorSeedStarts.tsx` - Date-reset logic and seed start modal behavior.

## Important Decisions

### Decision 1: Make hardiness-zone lookup deterministic without network
**Date**: 2026-04-22
**Context**: The backend test suite failed in environments where `phzmapi.org` was unreachable. That broke a core product capability used by property setup, weather, and frost-date logic.
**Decision**: Add a known-ZIP fallback table and improve geographic fallback rules for Alaska and South Florida.
**Rationale**: The app should continue to produce reasonable hardiness zones when the upstream ZIP API is unavailable.
**Alternatives Considered**: Leaving lookup fully network-dependent. Rejected because it makes core planning behavior fragile in restricted or offline environments.

### Decision 2: Treat hook dependency warnings as production risk, not cleanup
**Date**: 2026-04-22
**Context**: The frontend build succeeded only with warnings, several of which involved `now`/`today`-driven effects and memoized filters.
**Decision**: Fix the stale-hook dependencies and remove unused imports before calling the build healthy.
**Rationale**: Simulation mode and date-aware planning are central user flows; stale closures in these paths are regression-prone.

## Discoveries & Learnings

### What We Learned
- The repo already has broad functional coverage: 16+ blueprints, large frontend surface area, and 538 backend tests.
- The most immediate production gap was not missing screens; it was resilience and correctness in location-aware logic.
- Frontend build health was better than expected, but warning-free output required tightening date-driven hooks.

### Gotchas & Pitfalls
- `phzmapi.org` availability cannot be assumed in local or sandboxed environments.
- Simulation-date hooks need careful dependency handling or filters and reset logic drift from the viewed date.
- `git status` is currently blocked by Git safe-directory ownership settings in this environment.

## Current State

### What's Completed
- [x] Read `APPLICATION_FEATURES.md` and `USER_JOURNEY.md`.
- [x] Mapped current backend/frontend implementation surface.
- [x] Fixed hardiness-zone fallback reliability.
- [x] Restored backend health to `538 passed`.
- [x] Cleaned frontend hook/import issues enough for a successful production build.

### What's In Progress
- [ ] Feature-by-feature verification against the documented user journey.
- [ ] E2E verification of the highest-value seasonal flows.
- [ ] Technical debt follow-up on backend warnings and browser baseline data.

### What's Blocked
- Git diff/status review is blocked until the repository is added as a safe directory for the current Windows user.

## Next Steps

1. Build a feature verification matrix from `APPLICATION_FEATURES.md` grouped by product area.
2. Run focused end-to-end checks for the core user journey: property setup, planning, designer, calendar, indoor starts, harvests, seeds, dashboard.
3. Triage backend warning debt: `Query.get()` migration, cyclic FK drop warning, and other SQLAlchemy modernization issues.
4. Refresh frontend package metadata causing the `baseline-browser-mapping` staleness notice.

## Questions & Uncertainties

- [ ] Which documented capabilities are implemented but not yet covered by tests or manual verification?
- [ ] Are the existing Playwright suites current enough to use as the primary production smoke test?
- [ ] Do we want the next pass to optimize for user-journey validation or for architectural cleanup of high-risk areas?

