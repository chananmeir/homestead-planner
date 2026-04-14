# Homestead Dashboard Redesign - Context & Decisions

**Created**: 2026-04-14
**Last Updated**: 2026-04-14
**Status**: Completed

## Key Files

### Backend (Phase 2)

- `backend/blueprints/dashboard_bp.py` — Blueprint registering `GET /api/dashboard/today`. Thin layer; defers to the service.
- `backend/services/dashboard_service.py` — Composes 9 daily signal categories from existing services/models. User-scoped, per-category 20-row cap, ~10-12 queries per request. No new DB access patterns.
- `backend/tests/test_dashboard_endpoint.py` — 22 tests (auth, user scoping, shape, caps, date param, per-category behaviour).

### Frontend (Phase 1 + Phase 2)

All under `frontend/src/components/Dashboard/`:

- `index.tsx` — Orchestrator. Fetches `/api/dashboard/today`, manages layout, passes row data to children.
- `ActivePlanCard.tsx` — Summary of the user's active garden plan (progress, bed count, next milestone). Uses `resolvePlantName` helper (decision #5).
- `NeedsAttentionPanel.tsx` — Phase 2: wired to real data. Renders each signal category as a collapsible section with loading/empty/populated/error states. Rows deep-link into target modules.
- `QuickActions.tsx` — Navigation shortcuts to common workflows. Currently navigate to full tabs; opening modals directly is a Phase 3 candidate.
- `UpcomingTimeline.tsx` — Next N planting/harvest events. Uses `resolvePlantName`.
- `DashboardGardenSnapshot.tsx` — Compact version of the Garden Snapshot (what's in the ground today). Shares data source semantics with `GardenPlanner/GardenSnapshot.tsx`.
- `WeatherSummaryTile.tsx` — Compact weather tile surfaced on Dashboard even though the full Weather page now lives under Grow. Phase 2: `any` type replaced with a narrow interface.
- `PlansSection.tsx` — Lists the user's garden plans. Phase 2: error logging added.
- `types.ts` — `DashboardToday` response type and per-category row types (`HarvestReadyRow`, `IndoorStartDueRow`, `TransplantDueRow`, `FrostRiskSignal`, `RainAlertSignal`, `CompostOverdueRow`, `SeedLowStockRow`, `SeedExpiringRow`, `LivestockActionDueRow`).
- `testUtils.tsx` — Shared test helpers for the Dashboard suite.
- `__tests__/*.test.tsx` — 8 test files (Dashboard, ActivePlanCard, NeedsAttentionPanel, QuickActions, UpcomingTimeline, DashboardGardenSnapshot, WeatherSummaryTile, PlansSection).

### Frontend — Modified Outside `Dashboard/`

- `frontend/src/App.tsx` — Nav restructure: flat 12 tabs → 6 grouped sections + Dashboard (+ conditional Admin). Section landing pages with internal pill/tab sub-nav. Default route changed to Dashboard. All legacy tab keys preserved internally.
- `frontend/src/components/PlantingCalendar/index.tsx` — Added optional `initialView?: 'soil-temp'` prop to support Dashboard deep-link into the Soil Temperature card (decision #6).

### Frontend — Deleted

- `frontend/src/components/GrowingHub.tsx` — Dead placeholder from Phase 1. Removed in Phase 2 nit cleanup along with the unreferenced `'growing'` tab key.

## Important Decisions

### Decision 1: Section Landing Pages, Not Dropdowns

**Context**: 6 grouped sections needed sub-navigation. Two obvious options: hover/click dropdown menus in the top nav, or click-to-enter landing pages with internal pill/tab sub-nav.
**Decision**: Landing pages with internal sub-nav.
**Rationale**: The user explicitly called this out. Dropdowns would have reinforced the "tool/module switcher" feel that the redesign was trying to get away from. Landing pages frame each section as a destination with a purpose, which matches the "guided homestead system" positioning.
**Alternatives Considered**: Dropdown menus (rejected for the reason above); mega-menu (rejected as overkill for 6 sections).

### Decision 2: Single Aggregation Endpoint, Composed From Existing Services

**Context**: Needs Attention panel surfaces 9 different signal categories. Two options: (a) have the panel fan out to 9 existing endpoints; (b) add one new aggregation endpoint.
**Decision**: Single `GET /api/dashboard/today` endpoint that composes from existing services.
**Rationale**: One round-trip, consistent shape, user-scoped in one place, cappable in one place, easier to extend. Keeps the frontend dumb — it just renders whatever the endpoint returns. No new models needed; composition-only.
**Pattern for future**: Any future "cross-domain summary" feature should follow this same pattern — new read-only endpoint in a thin blueprint, service composes from existing data access layers, user-scoped + capped.

### Decision 3: `frostRisk` and `rainAlert` are Objects, Not Arrays

**Context**: Most signal categories are lists of rows (e.g., `harvestReady: HarvestReadyRow[]`). Weather signals are different — there's one frost risk and one rain alert per day, not a list.
**Decision**: `frostRisk` and `rainAlert` are single objects (`FrostRiskSignal | null`, `RainAlertSignal | null`). All other categories are arrays.
**Rationale**: Matches the real-world data shape. Forcing these into single-element arrays would mislead consumers.
**Gotcha**: Future additions to NeedsAttentionPanel must respect this shape distinction. If a new category is "at most one per day" (e.g., heat advisory), use an object; otherwise use an array.

### Decision 4: Time Machine Integration via `?date=` Query Param

**Context**: The app has a Time Machine feature that lets users simulate a different "today" for testing seasonal features. The Dashboard must respect it.
**Decision**: `GET /api/dashboard/today?date=YYYY-MM-DD` accepts an optional date. Frontend passes `todayKey` from the existing `useToday()`/`useNow()` hook pattern. When omitted, backend uses the real current date.
**Gotcha**: All downstream services called by `dashboard_service` must also respect this simulated date. The current composition uses services that already accept a date parameter or derive from it; future signal additions must too.

### Decision 5: `resolvePlantName` Helper for Friendly Plant Names

**Context**: Raw plant IDs like `tomato-1` leaked into Dashboard UI in Phase 1.
**Decision**: Shared helper looks up `PLANT_DATABASE` for a friendly name, falls back to humanized plant ID (e.g., `tomato-1` → "Tomato"), never raw.
**Where**: Used in `ActivePlanCard.tsx` and `UpcomingTimeline.tsx`.
**Gotcha**: Any new Dashboard component rendering a plant ID must use this helper. Don't reinvent name resolution.

### Decision 6: Soil Temperature Deep-Link via `initialView` Prop

**Context**: Needs Attention panel surfaces frost risk and soil-not-warm-enough signals. Row click should deep-link into the Soil Temperature card inside PlantingCalendar, not just drop the user at the top of Calendar.
**Decision**: Added optional `initialView?: 'soil-temp'` prop to `PlantingCalendar/index.tsx`. When set, component scrolls `SoilTemperatureCard` into view on mount.
**Rationale**: Minimal plumbing — no routing refactor, no state machine. One prop, one `useEffect`, one `scrollIntoView` call.
**Pattern for future**: Similar single-purpose deep-link props are cheap. Don't build a full intra-page routing system unless a third case appears.

### Decision 7: No Schema Changes, No Migrations, No Synced-File Changes

**Context**: Dashboard redesign is inherently read-only aggregation over existing data.
**Decision**: Deliberately kept this constraint. No new models. No migrations. No synced-file pair updates (space calculators, plant DB, SFG tables all untouched).
**Why it matters for CLAUDE.md risk awareness**: The Dashboard endpoint is low-risk by design — read-only, no data contract with synced files, no schema coupling. This is why no CLAUDE.md update was proposed for this work. If future Dashboard extensions start requiring new data fields, that property is lost and CLAUDE.md should be revisited.

### Decision 8: Per-Category 20-Row Cap

**Context**: Some categories can in principle return many rows (e.g., a user with 50 beds might have 100+ seedlings due). Unbounded arrays are a perf/UX risk.
**Decision**: Each signal category is capped at 20 rows in `dashboard_service.py`.
**Gotcha**: The cap is silent — there's currently no "+ N more" affordance in NeedsAttentionPanel. If a user hits the cap frequently, the panel will look stable day-over-day when in reality signals are being dropped. Consider surfacing this if it becomes a real issue.

### Decision 9: `userTimezone` Placeholder in `meta`

**Context**: Response includes `meta: { generatedAt, userTimezone }`. We don't yet store per-user timezone.
**Decision**: Return `'UTC'` as the placeholder value. Shape is forward-compatible; swap in real per-user timezone in Phase 3.
**Why not omit the field**: Keeping the field in the contract now means frontend can start reading it without a future API version bump.

### Decision 10: Phase 1 Nit Cleanup Bundled Into Phase 2

**Context**: Several low-impact issues surfaced in Phase 1 review (dead `'growing'` tab, unused `GrowingHub.tsx`, `any` type in `WeatherSummaryTile`, missing error logging in `PlansSection`, raw plant IDs in UI, missing soil-temp deep-link, `StatTone` type too narrow).
**Decision**: Bundle them into Phase 2 rather than a separate cleanup commit. They were small enough that splitting would have been churn.
**Items cleaned up**: Dead `'growing'` tab removed, `GrowingHub.tsx` deleted, soil-temp deep-link added, weather `any` type removed, plant-name resolution helper added, `PlansSection` error logging added, `StatTone` widened.

### Decision 11: Quick Actions Navigate, Not Modal

**Context**: Quick Actions buttons could either (a) navigate to full tabs or (b) open modals on top of the Dashboard.
**Decision**: Phase 1/2 ships with navigation. Modals-over-Dashboard is a Phase 3 candidate.
**Why defer**: Each action has an existing modal in its home module. Reusing those modals from the Dashboard requires auditing each for Dashboard-safe state isolation (no assumptions about being mounted inside the parent module). Not hard, but not free — deferred to keep Phase 1/2 tight.

## Technical Context

### API Endpoint

```
GET /api/dashboard/today?date=YYYY-MM-DD   (auth required)

Response 200:
{
  "date": "2026-04-14",
  "signals": {
    "harvestReady":       HarvestReadyRow[],
    "indoorStartsDue":    IndoorStartDueRow[],
    "transplantsDue":     TransplantDueRow[],
    "frostRisk":          FrostRiskSignal | null,
    "rainAlert":          RainAlertSignal | null,
    "compostOverdue":     CompostOverdueRow[],
    "seedLowStock":       SeedLowStockRow[],
    "seedExpiring":       SeedExpiringRow[],
    "livestockActionsDue": LivestockActionDueRow[]
  },
  "meta": {
    "generatedAt": "2026-04-14T12:00:00Z",
    "userTimezone": "UTC"
  }
}
```

Frontend types: `frontend/src/components/Dashboard/types.ts` — `DashboardToday` is the root response type.

### Dashboard Component Tree

```
App.tsx (routing)
  └── Dashboard/index.tsx  (fetches /api/dashboard/today)
      ├── ActivePlanCard
      ├── NeedsAttentionPanel        (Phase 2: real data)
      │    └── [9 collapsible sections, one per signal category]
      ├── QuickActions
      ├── UpcomingTimeline
      ├── DashboardGardenSnapshot
      ├── WeatherSummaryTile
      └── PlansSection
```

### Data Flow

```
User logs in
    ↓
App.tsx routes to Dashboard (default)
    ↓
Dashboard/index.tsx mounts
    ↓
Reads todayKey from useToday()/useNow()   (respects Time Machine)
    ↓
GET /api/dashboard/today?date=<todayKey>
    ↓
dashboard_service.get_today(user_id, date):
    - composes 9 signal categories from existing services
    - filters by user_id everywhere
    - caps each category at 20 rows
    ↓
Response rendered across:
    - NeedsAttentionPanel (signals.*)
    - UpcomingTimeline (derived from harvestReady + indoorStartsDue + transplantsDue)
    - WeatherSummaryTile (signals.frostRisk, signals.rainAlert)
    - Other tiles fetch their own existing endpoints (e.g., /api/garden-beds)
```

### File Inventory

**Created (Phase 1)**:
- `frontend/src/components/Dashboard/index.tsx`
- `frontend/src/components/Dashboard/ActivePlanCard.tsx`
- `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx` (placeholder data)
- `frontend/src/components/Dashboard/QuickActions.tsx`
- `frontend/src/components/Dashboard/UpcomingTimeline.tsx`
- `frontend/src/components/Dashboard/DashboardGardenSnapshot.tsx`
- `frontend/src/components/Dashboard/WeatherSummaryTile.tsx`
- `frontend/src/components/Dashboard/PlansSection.tsx`

**Created (Phase 2)**:
- `backend/blueprints/dashboard_bp.py`
- `backend/services/dashboard_service.py`
- `backend/tests/test_dashboard_endpoint.py`
- `frontend/src/components/Dashboard/types.ts`
- `frontend/src/components/Dashboard/testUtils.tsx`
- `frontend/src/components/Dashboard/__tests__/*.test.tsx` (8 files)

**Modified**:
- `frontend/src/App.tsx` — nav restructure, default route, section landing pages, legacy tab key preservation.
- `frontend/src/components/PlantingCalendar/index.tsx` — added `initialView?: 'soil-temp'` prop (Phase 2).
- Whatever blueprint registration file registers new blueprints — added `dashboard_bp`. (Check `backend/app.py` or `backend/blueprints/__init__.py` depending on current registration pattern.)

**Deleted (Phase 2)**:
- `frontend/src/components/GrowingHub.tsx` — dead placeholder.

## Discoveries & Learnings

### What We Learned

- Dashboard aggregation can be done purely by composition over existing services — no new data access layer needed.
- Section landing pages with internal pill nav are a nicer UX than dropdown menus for modest group counts (~3-5 items per group).
- Deep-linking into a specific sub-view inside an existing component (e.g., Soil Temperature card inside Calendar) is cheap with a single-purpose prop. Resist the urge to build a routing DSL.

### Gotchas & Pitfalls

- **`frostRisk` and `rainAlert` are objects, not arrays** — see decision #3. A future contributor who adds "heat advisory" needs to pick the right shape.
- **20-row cap is silent** — there is no "+ N more" indicator. If this becomes user-visible (e.g., busy season, many beds), surface it.
- **`userTimezone` returns `'UTC'`** — do not treat as authoritative. When per-user timezone lands, update `dashboard_service` to return the real value.
- **Legacy tab keys are preserved inside the new section landing pages** — don't rename them. Deep links, bookmarks, and internal component assumptions rely on those keys.
- **`GET /api/dashboard/today` is user-scoped everywhere** — every query inside the service filters by `user_id`. When adding a new signal category, do NOT skip the user scope filter.

## How to Extend

### Add a New Signal Category to the Dashboard Endpoint

1. Add the data-fetching logic to `backend/services/dashboard_service.py` — a new method that takes `user_id` and `date`, returns a list (or a single object if "at most one per day").
2. Apply user scoping. Apply the 20-row cap if it's an array.
3. Add the key to the response dict in the main `get_today` composer.
4. Add the row type to `frontend/src/components/Dashboard/types.ts` and extend `DashboardToday['signals']`.
5. Render in `NeedsAttentionPanel.tsx` as a new collapsible section. Pick a deep-link target for row clicks.
6. Add tests to `backend/tests/test_dashboard_endpoint.py` covering: auth, user scoping, cap (if array), empty case, populated case.
7. Add/extend `frontend/src/components/Dashboard/__tests__/NeedsAttentionPanel.test.tsx`.

### Add a New Dashboard Tile

1. Create a new component under `frontend/src/components/Dashboard/`.
2. If the tile needs data already in `GET /api/dashboard/today`, read from the root fetch in `index.tsx` and pass props in. Do NOT re-fetch the same endpoint from the child.
3. If the tile needs a different data source, either extend `/api/dashboard/today` (preferred for small additions) or call an existing endpoint directly.
4. Add to the component tree in `index.tsx`.
5. Add a test file under `__tests__/`.

### Add a New Nav Group

1. Open `frontend/src/App.tsx`.
2. Add the new group to the top-level nav config.
3. Build a section landing page that matches the existing 6 sections' structure (internal pill/tab sub-nav, NOT a dropdown — see decision #1).
4. Preserve existing tab keys when moving modules in.
5. Update the Dashboard's `QuickActions` if any new workflows should be surfaced from the landing page.

## Phase 3 Candidates (Deferred)

These were in the original letter of direction or surfaced during Phase 2 review and were deliberately deferred:

1. **Per-user timezone storage** — replaces the `'UTC'` placeholder in `meta.userTimezone`. Schema change required (user timezone field).
2. **Compost `turn_frequency_days` field** — Dashboard currently uses a hard-coded 7-day default for compost-overdue signals. Schema change required.
3. **Quick Actions → modals over Dashboard** — today they navigate away. Needs an audit of each target modal for Dashboard-safe state isolation.
4. **Design-language audit of SeedsHub, HarvestTracker, PlantingCalendar** — from the original letter of direction: filter overload, button hierarchy review, stat-block consistency. Not purely Dashboard work; broader page refactor.
5. **Richer livestock action signals** — only egg collection surfaces today. Add feed checks, egg cleanings, health checks, etc.
6. **Dashboard-wide `useDashboardData` hook** — a few tiles each fetch `/api/garden-beds` independently. A shared hook could dedupe.
7. **"+ N more" affordance on capped signal categories** — surface when the 20-row cap has hidden rows.
8. **Dashboard customization / tile reordering** — not in scope but a natural next ask.

## Test Coverage Summary

- **Backend**: 22 tests in `backend/tests/test_dashboard_endpoint.py`.
  - Auth required / 401 unauthenticated.
  - Response shape (all 9 signal keys present, `meta` present).
  - User scoping (user A cannot see user B's signals).
  - 20-row cap per category.
  - `?date=` param respected.
  - Per-category populated / empty behaviour.
- **Frontend**: ~53 tests across 8 files in `frontend/src/components/Dashboard/__tests__/`. Full frontend suite now ~105 tests.
  - Each Dashboard component has its own test file.
  - NeedsAttentionPanel has loading / empty / populated / error state coverage and row-click deep-link assertions.

## Notes

- This was a re-presentation, not a rewrite. All 12 legacy module components render unchanged under their new section homes.
- No CLAUDE.md update was proposed for this work — the Dashboard endpoint is read-only, has no schema coupling, and touches no synced file pairs. If Phase 3 introduces schema changes (per-user timezone, compost turn frequency), re-evaluate.
