# Programmer Handoff

**Project**: Homestead Planner  
**Date**: 2026-04-22  
**Status**: Active / In Progress  
**Important**: This is a working handoff, not final product signoff. More testing and feature verification is still planned.

## Purpose

The goal of this workstream is to make sure the application actually delivers the product described in:

- `APPLICATION_FEATURES.md`
- `USER_JOURNEY.md`

This includes two parallel concerns:

1. The app should behave the way a real user expects.
2. The codebase should be organized and stabilized so future changes in one area do not break other areas.

## Primary Source Documents

Use these as the source of truth for product intent:

- `C:\homesteader\homestead-planner\APPLICATION_FEATURES.md`
- `C:\homesteader\homestead-planner\USER_JOURNEY.md`

Supporting working docs for this audit:

- `C:\homesteader\homestead-planner\dev\active\production-readiness-audit\original-user-prompt.md`
- `C:\homesteader\homestead-planner\dev\active\production-readiness-audit\context.md`
- `C:\homesteader\homestead-planner\dev\active\production-readiness-audit\plan.md`
- `C:\homesteader\homestead-planner\dev\active\production-readiness-audit\tasks.md`

## What Has Already Been Done

### 1. Product Scope Review

The documented feature scope and the user-journey narrative were reviewed to frame this as a production-readiness and product-completeness audit, not just a bugfix task.

### 2. Implementation Surface Review

The current backend and frontend surfaces were checked at a high level to confirm the repo already contains broad implementation across:

- Dashboard
- Garden planner
- Garden designer
- Property designer
- Planting calendar
- Indoor seed starts
- Harvest tracker
- Seed inventory/catalog
- Livestock
- Compost
- Weather
- Nutrition
- Admin/user management

### 3. Backend Reliability Fix Completed

The first concrete production issue fixed was hardiness-zone lookup reliability in:

- `backend/services/geocoding_service.py`

Problem:

- The app relied too heavily on live ZIP-based API lookup for hardiness zones.
- In restricted/offline environments this caused failures in location-aware behavior.

Fix applied:

- Added deterministic known-ZIP hardiness fallback.
- Improved coordinate-based fallback handling for edge regions, including Alaska and South Florida.

User-facing areas protected by this:

- Property setup
- Zone detection
- Frost-date derivation
- Weather/location-aware planning

### 4. Frontend Build/Date-Logic Cleanup Completed

Several frontend warnings were cleaned up in date-sensitive areas, especially where simulation date or today-based behavior could drift because of stale hook dependencies.

Files updated included:

- `frontend/src/components/GardenPlanner.tsx`
- `frontend/src/components/MySeedInventory.tsx`
- `frontend/src/components/GardenDesigner/PlannedPlantsSection.tsx`
- `frontend/src/components/PlantingCalendar/SoilTemperatureCard/index.tsx`
- `frontend/src/components/IndoorSeedStarts.tsx`
- `frontend/src/components/HarvestTracker/LogHarvestModal.tsx`
- minor unused import cleanup in related files

## Current Verification Status

### Verified Now

- Backend test suite passes:
  - `538 passed`
- Frontend production build succeeds

### Not Yet Fully Verified

The app has **not** yet been fully walked end-to-end against every feature in `APPLICATION_FEATURES.md` and `USER_JOURNEY.md`.

That means the following are still open as product verification work:

- dashboard attention/deep-link flows
- season planner full workflow
- garden designer advanced interactions
- planting calendar views and event workflows
- indoor starts lifecycle
- harvest + nutrition rollups
- seed inventory/catalog/import flows
- property designer flows
- livestock flows
- compost flows
- photo gallery flows
- admin flows

## What Still Needs To Be Done

### 1. Build a Feature Verification Matrix

Take the documented features and classify each one as:

- implemented and verified
- implemented but not yet verified
- partial
- missing

### 2. Test By User Journey, Not Just By Screen

The app should be checked the way a serious user would actually use it across the season:

- property setup
- seed inventory setup
- annual planning
- export to calendar
- placement in designer
- indoor starts and transplant flow
- harvest logging
- nutrition rollup
- year-round date-aware behavior

### 3. Reduce Structural Risk

Still recommended:

- audit backend/frontend synchronized calculator pairs
- review SQLAlchemy deprecation warnings
- review cyclic FK warning in tests
- refresh stale frontend package metadata warning

## Expectations For The Programmer

The programmer should treat this as a guided production-hardening and verification task, not as a request to randomly refactor.

Priority order:

1. Preserve existing working behavior.
2. Verify high-value user flows against the documented product scope.
3. Fix missing or fragile behavior in small, testable increments.
4. Avoid changes that increase coupling between backend and frontend.
5. Keep synced logic synchronized across both stacks.

## Important Engineering Constraints

The repo already documents some critical constraints in:

- `AGENTS.md`
- `CLAUDE.md`

Particularly important:

- do not change shared calculation logic in only one stack
- do not break backend/frontend API contracts
- use migrations for schema work
- treat date-aware logic and simulation behavior as high risk

## How To Use This Handoff Right Now

This handoff is safe to use **now** as a working brief.

But it should be treated as:

- a current snapshot
- a starting point for the programmer
- not a final acceptance document

The user is continuing testing and review, so the programmer should expect additional findings and follow-up tasks after this handoff.

## Recommended Immediate Next Step

The programmer should start by reading:

1. `APPLICATION_FEATURES.md`
2. `USER_JOURNEY.md`
3. `dev/active/production-readiness-audit/context.md`
4. `dev/active/production-readiness-audit/tasks.md`

Then they should create or continue a structured feature-verification pass, starting with the highest-value user paths:

- dashboard
- planner
- designer
- calendar
- seeds
- property/location setup

## Bottom Line

Yes, this handoff can be given to the programmer now.

But it should be framed correctly:

- the codebase has had an initial stabilization pass
- core backend tests and frontend build are green
- the broader product-completeness audit is still ongoing
- more testing with the user is expected before calling the app fully production-ready
