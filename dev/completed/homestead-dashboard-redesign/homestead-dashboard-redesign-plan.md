# Homestead Dashboard Redesign - Implementation Plan

**Created**: 2026-04-14
**Completed**: 2026-04-14
**Status**: Completed (Phase 1 + Phase 2)

## Executive Summary

Shifted Homestead Planner from a module-first "software dashboard" (12 flat nav tabs, defaulting to Garden Planner) to a daily homestead command center that answers "what matters today?" on login. Delivered in two phases: Phase 1 restructured navigation into 6 grouped sections with landing pages and shipped a new Dashboard with placeholder data; Phase 2 wired the Dashboard's "Needs Attention" panel to a real aggregation endpoint and cleaned up Phase 1 nits.

## Background

### User Direction (summary of `letterofdirection.txt`, Apr 2026)

The app had grown into 12 flat top-level tabs with Garden Planner as the default landing page. The user's critique:

- Landing on Garden Planner forced users into "planning mode" even when they logged in to check today's tasks.
- Flat 12-tab nav felt like a tool/module switcher, not a guided homestead system.
- Cross-cutting "what needs my attention right now?" information was scattered across Calendar, Indoor Seed Starts, Compost, Seeds, and Weather — no single place surfaced it.
- Internal pages (Seeds, Harvest, Calendar) had filter overload, inconsistent stat blocks, and weak button hierarchy.

Direction: make the app feel like a daily command center. Dashboard first. Group related modules. Surface the day's actionable signals prominently. Preserve all existing functionality — this is a re-presentation, not a rewrite.

## Objectives

1. Make Dashboard the default landing page and always-accessible nav destination.
2. Collapse 12 flat nav tabs into 6 grouped top-level sections (plus conditional Admin).
3. Surface actionable daily signals in a single "Needs Attention" panel.
4. Preserve every existing module component and internal tab key without refactor.
5. Ship without database schema changes or migrations.

## Implementation Approach

### Phase 1: Nav Restructure + Dashboard Shell (shipped)

**Goal**: New nav structure, Dashboard landing page with placeholder Needs Attention data.

**Steps**:
1. Group 12 tabs into 6 sections: Dashboard, Plan, Design, Grow, Track, Manage (+ conditional Admin).
2. Build section landing pages with internal pill/tab sub-nav (explicit decision: NOT dropdowns — see context doc).
3. Change default route to Dashboard; keep every legacy tab key rendering the same component.
4. Build 8 Dashboard components orchestrated by `frontend/src/components/Dashboard/index.tsx`.
5. Nest Weather under Grow but surface a compact `WeatherSummaryTile` on the Dashboard.

**Files Affected**: see context.md file inventory.

### Phase 2: Wire Needs Attention + Nit Cleanup (shipped)

**Goal**: Replace Phase 1 placeholder Needs Attention data with a real aggregation endpoint; address review feedback from Phase 1.

**Steps**:
1. Add `GET /api/dashboard/today` composing 9 daily signal categories.
2. Add backend blueprint `backend/blueprints/dashboard_bp.py` + service `backend/services/dashboard_service.py`.
3. Add frontend types in `frontend/src/components/Dashboard/types.ts`.
4. Wire `NeedsAttentionPanel` to the endpoint with loading/empty/populated/error states and row-click deep-links.
5. Phase 1 nit cleanup (see context doc decisions #7-#11).

**Files Affected**: see context.md file inventory.

## Technical Details

### Backend Changes

- **New endpoint**: `GET /api/dashboard/today?date=YYYY-MM-DD` (date param optional, respects Time Machine).
- **New blueprint**: `backend/blueprints/dashboard_bp.py`.
- **New service**: `backend/services/dashboard_service.py` — composes from existing services (no new data access patterns).
- **No new models. No migrations. No schema changes.**
- Response shape: `{ date, signals: { harvestReady, indoorStartsDue, transplantsDue, frostRisk, rainAlert, compostOverdue, seedLowStock, seedExpiring, livestockActionsDue }, meta: { generatedAt, userTimezone } }`.
- User-scoped filtering on every query. Each category capped at 20 rows. ~10-12 queries per request.

### Frontend Changes

- **New components** (8 files under `frontend/src/components/Dashboard/`): see file inventory in context doc.
- **Modified**: `frontend/src/App.tsx` (nav restructure, default route, section landing pages).
- **Deleted**: `frontend/src/components/GrowingHub.tsx` (placeholder never used; removed in Phase 2 nit cleanup).
- **Time Machine integration**: Dashboard reads `todayKey` from existing `useToday()`/`useNow()` hooks and passes as `?date=` to the endpoint.

## Testing Strategy

- **Backend**: 22 tests in `backend/tests/test_dashboard_endpoint.py` (auth, shape, user scoping, caps, date param, each category).
- **Frontend**: ~53 tests across the Dashboard suite (`frontend/src/components/Dashboard/__tests__/`). Full frontend suite now ~105 tests.
- Manual verification: default landing, nav group navigation, section landing pages, Dashboard with empty/populated states, row-click deep-links, Time Machine override.

## Success Metrics

- Logged-in users land on Dashboard by default. ✅
- 6 grouped sections + Dashboard replace 12 flat tabs. ✅
- Needs Attention panel shows real signals from a single endpoint. ✅
- No schema changes, no synced-file changes, no new migrations. ✅
- All existing module components render unchanged under their new section. ✅

## Rollback Plan

Low-risk rollback (no schema changes):
1. Revert the commit range covering Phase 1 + Phase 2.
2. Default route restored to Garden Planner.
3. Dashboard components and `/api/dashboard/today` blueprint removed from their registration sites.

No data migration or backfill required.

## Notes

- Phase 3 candidates (deliberately deferred) are enumerated in context.md. Most notable: per-user timezone storage (endpoint returns `'UTC'` placeholder), Quick Actions opening modals over the Dashboard instead of navigating away, and the design-language audit of SeedsHub / HarvestTracker / PlantingCalendar from the original letter of direction.
- This was a re-presentation, not a rewrite. All 12 legacy nav keys still resolve to the same components they always did — they're just now organized under parent sections.
