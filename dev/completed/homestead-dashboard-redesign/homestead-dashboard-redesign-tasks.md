# Homestead Dashboard Redesign - Task Checklist

**Created**: 2026-04-14
**Completed**: 2026-04-14
**Status**: Completed

## Phase 1: Nav Restructure + Dashboard Shell

### Nav Structure

- [x] Collapse flat 12-tab nav into 6 grouped sections: Dashboard, Plan, Design, Grow, Track, Manage (+ conditional Admin)
- [x] Change default logged-in route from Garden Planner to Dashboard
- [x] Keep Dashboard as a top-level always-accessible tab (in addition to being the default)
- [x] Build section landing pages for each of the 6 groups with internal pill/tab sub-nav (NOT dropdowns)
- [x] Preserve every legacy tab key so existing module components render unchanged
- [x] Nest Weather under Grow; surface a compact Weather tile on Dashboard

### Dashboard Components (`frontend/src/components/Dashboard/`)

- [x] `index.tsx` — orchestrator, layout, root data fetch
- [x] `ActivePlanCard.tsx` — active plan summary
- [x] `NeedsAttentionPanel.tsx` — placeholder data (wired in Phase 2)
- [x] `QuickActions.tsx` — navigation shortcuts
- [x] `UpcomingTimeline.tsx` — next N planting/harvest events
- [x] `DashboardGardenSnapshot.tsx` — compact garden snapshot
- [x] `WeatherSummaryTile.tsx` — compact weather tile
- [x] `PlansSection.tsx` — plans list

## Phase 2: Wire Needs Attention + Nit Cleanup

### Backend

- [x] Create `backend/blueprints/dashboard_bp.py` registering `GET /api/dashboard/today`
- [x] Create `backend/services/dashboard_service.py` composing 9 signal categories
- [x] Implement user-scoped filtering for every query
- [x] Cap each signal category at 20 rows
- [x] Support optional `?date=YYYY-MM-DD` param respecting Time Machine
- [x] Return `meta.userTimezone` as `'UTC'` placeholder (Phase 3: real per-user timezone)
- [x] Register the new blueprint in the blueprint registration site
- [x] Add `backend/tests/test_dashboard_endpoint.py` with 22 tests

### Frontend

- [x] Create `frontend/src/components/Dashboard/types.ts` with `DashboardToday` + per-category row types
- [x] Wire `NeedsAttentionPanel.tsx` to real endpoint with loading / empty / populated / error states
- [x] Row-click deep-linking to target modules
- [x] Dashboard suite tests expanded to ~45 tests (full frontend suite ~105)
- [x] Create `frontend/src/components/Dashboard/testUtils.tsx` for shared test helpers

### Phase 1 Nit Cleanup (bundled into Phase 2)

- [x] Remove dead `'growing'` tab key from nav config
- [x] Delete unused `frontend/src/components/GrowingHub.tsx`
- [x] Add `initialView?: 'soil-temp'` prop to `frontend/src/components/PlantingCalendar/index.tsx` for soil-temp deep-link
- [x] Replace `any` type in `WeatherSummaryTile.tsx` with narrow interface
- [x] Add `resolvePlantName` helper; apply in `ActivePlanCard.tsx` and `UpcomingTimeline.tsx`
- [x] Add error logging in `PlansSection.tsx`
- [x] Widen `StatTone` type to cover all used variants

## Verification

- [x] Backend tests pass (22 new tests in `test_dashboard_endpoint.py`)
- [x] Frontend tests pass (Dashboard suite ~45 tests, full suite ~105)
- [x] Manual: default landing is Dashboard for logged-in users
- [x] Manual: all 6 section landing pages load and internal sub-nav works
- [x] Manual: every legacy module component still renders under its new section
- [x] Manual: Dashboard shows Needs Attention with real data; row clicks deep-link correctly
- [x] Manual: Time Machine override flows through to `/api/dashboard/today?date=...`

## Documentation

- [x] `dev/completed/homestead-dashboard-redesign/` created with plan, context, and tasks docs
- [x] No CLAUDE.md update proposed (read-only endpoint, no schema coupling, no synced-file changes)
- [x] No `MIGRATIONS.md` update (no schema changes)

## Deferred to Phase 3

See context.md "Phase 3 Candidates" section. Summary:

- [ ] Per-user timezone storage (replaces `'UTC'` placeholder)
- [ ] Compost `turn_frequency_days` field (replaces hard-coded 7-day default)
- [ ] Quick Actions → modals over Dashboard (currently navigate away)
- [ ] Design-language audit of SeedsHub / HarvestTracker / PlantingCalendar from the original letter of direction
- [ ] Richer livestock action signals (only egg collection surfaces today)
- [ ] Dashboard-wide `useDashboardData` hook (dedupe repeated `/api/garden-beds` fetches)
- [ ] "+ N more" affordance on capped signal categories
- [ ] Dashboard customization / tile reordering
