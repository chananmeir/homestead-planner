# Calendar / Indoor Starts Consistency — Slice C Test Report (2026-04-24)

Slice of: `calendar-indoor-start-consistency-plan.md` §4 Slice C
Owner: test-engineer
References: `calendar-indoor-start-consistency-slice-a-report.md`, `calendar-indoor-start-consistency-slice-b-report.md`

## Summary

Added 16 frontend tests across 4 new test files — all pass. Verified backend tests for the unchanged `/api/planting-events/needs-indoor-starts` and `/api/indoor-seed-starts/from-planting-event` endpoints still pass (22/22). One non-blocking observation about wording flexibility in the Slice B copy is noted but not classified as a bug. No component code was modified.

## Tests added (file → count → coverage)

### 1. `frontend/src/components/PlantingCalendar/CalendarGrid/__tests__/EventMarker.test.tsx` — 3 tests
- Plan-only seed-start (`indoorSeedStartStatus == null`) renders the dashed amber outline (`border-dashed border-amber-300`) and includes `[Plan only]` in the tooltip.
- Tracked seed-start (`indoorSeedStartStatus = 'planned'`) does NOT render the dashed outline and tooltip is free of `Plan only`.
- A downstream lifecycle status (`'growing'`) is treated identically to `'planned'` (no dashed outline) — guards against any future logic that only special-cases `'planned'`.

### 2. `frontend/src/components/PlantingCalendar/CalendarGrid/__tests__/DayDetailModal.test.tsx` — 3 tests
- Two seed-start rows on the same day, one tracked + one plan-only: both pills render; exactly one `Start tracking` button (on the plan-only row).
- Click `Start tracking` → asserts `apiPost` payload via `expect.objectContaining({ plantingEventId, plantId, variety, transplantDate, desiredQuantity, overdueMode: 'reschedule_today' })`; `onEventUpdated` invoked exactly once.
- 4xx response with `{ error: '…' }` → red toast surfaces with the backend error message, row remains in modal, `onEventUpdated` NOT called.

### 3. `frontend/src/components/PlantingCalendar/CalendarGrid/__tests__/GroupedEventsModal.test.tsx` — 1 test
- Mixed group with one tracked + one plan-only event: both pills render, NO inline `Start tracking` button (per plan §1.1, action lives in DayDetailModal only).

### 4. `frontend/src/components/PlantingCalendar/ListView/__tests__/ListView.test.tsx` — 1 test
- Mixed list with tracked + plan-only seed-start rows: both pills render next to plant name, NO inline `Start tracking` button.

### 5. `frontend/src/components/__tests__/IndoorSeedStarts.banner.test.tsx` — 6 tests
- Banner renders with plural copy `/3\s+planned seedings from your garden plan\s+are\s+not yet tracked/` when `/needs-indoor-starts` returns 3 rows; clicking `Show all ▾` reveals all three rows by `data-testid` (collapsed by default, per Slice B).
- Empty payload: banner is NOT in the DOM.
- Singular: `/1\s+planned seeding from your garden plan\s+is\s+not yet tracked/` and the plural form does not appear in the banner text.
- `Start tracking` POSTs the right body shape (incl. `desiredQuantity` falling back to `spaceRequired`), removes the banner row, and appends the new card to the regular grid (`iss-card-{newId}`).
- Filter-mismatch toast: when `filterStatus` is `'germinating'`, success toast asserts the exact Slice B copy `/Now tracking — visible under Planned/`.
- `Dismiss` removes the row locally with zero POST calls (only the four GETs from initial load); a re-render with the same props keeps the row hidden (dismissedIds Set survives normal re-renders, per Slice B's "client-only / resets on hard reload" semantics).

## Test infrastructure choices

- Mock `fetch` directly via the existing `installFetchMock` / `clearFetchMock` helpers in `frontend/src/components/Dashboard/testUtils.tsx`. This is the codebase pattern (see `IndoorSeedStarts.focus.test.tsx`, `NeedsAttentionPanel.test.tsx`) — `apiGet`/`apiPost` route through `fetch`, so mocking `fetch` covers them.
- Mock `useNow` and `useToday` from `SimulationContext` and stub `useActivePlan` from `ActivePlanContext` — same shape used in the existing `IndoorSeedStarts.focus.test.tsx`.
- Wrap the page-level component in `<ToastProvider>` so the real toast surface renders. Toasts asserted via `data-testid="toast-success"` / `"toast-error"` (provided by `Toast.tsx`).
- Route ordering matters with `installFetchMock`: it returns the FIRST matching route, so `/api/planting-events/needs-indoor-starts` must precede the broader `/api/indoor-seed-starts` route (codified in a local `makeOrderedRoutes` helper).
- For DayDetailModal's `apiPost` body inspection, `JSON.parse(init.body)` decodes the request payload after `JSON.stringify` serializes the `Date` object's ISO 8601 string — assertions use `expect.objectContaining(...)` and a regex for the date so the test is resilient to timezone shifts in the ISO output.

## Backend verification

`cd backend && python -m pytest tests/ -k "needs_indoor_starts or from_planting_event" -v` → **22 passed, 0 failed** (8.41s).

Files exercised:
- `tests/test_indoor_seed_start_from_planting_event.py` — 6 tests (destination bed handling).
- `tests/test_needs_indoor_starts_plan_attribution.py` — 16 tests (plan attribution + cross-user isolation + `planId` filter).

No backend test failures, expected since Slice A and Slice B made zero backend changes. Pre-existing SQLAlchemy 1.x `Query.get()` deprecation warnings are unrelated and out of scope for this slice.

## Run command (full new-test suite)

```
cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="DayDetailModal|EventMarker|GroupedEventsModal|ListView|IndoorSeedStarts"
```

Result: **6 suites passed, 16 tests passed, 0 failed.** This pattern also re-runs the existing `IndoorSeedStarts.focus.test.tsx` (2 tests already passing — no regressions).

## Bugs uncovered (do NOT fix here — Slice D code review)

None. The implementation matches the Slice A/B reports verbatim:
- Pill text exactly `Tracked` / `Plan only`.
- Toast on 4xx uses `body.error` when present (asserted in DayDetailModal test 3).
- Banner pluralization is correct on both N=1 and N≥2 paths.
- `Start tracking` body uses `desiredQuantity = event.spaceRequired || 1` and `overdueMode: 'reschedule_today'` exactly as documented.
- Dismiss does not POST.

## Non-blocking observations (for Slice D awareness, not bugs)

1. **Banner text spacing/punctuation not asserted strictly.** The current copy reads (from `IndoorSeedStarts.tsx`):

   > `<strong>{N}</strong> planned seeding{s} from your garden plan {is/are} not yet tracked`

   I asserted with a flexible regex that allows arbitrary whitespace between the words because the underlying JSX has line-broken template literals (e.g. `' is'` vs `' are'` after `'not yet tracked'`). If the design changes the wording (e.g., adds a period or alters word order), these tests would still pass as long as the same words appear in the same order. This is intentional — strict-string matching against JSX-with-conditional-fragments tends to over-fit. Slice D may want to canonicalize the copy in the source (single template, single conditional) to make stricter assertions cheap; if so, tighten the regex when that lands.

2. **`PlantIcon` console.log spam during tests** (`[PlantIcon] Mounting/Resetting: ...`). Pre-existing — emitted by `frontend/src/components/common/PlantIcon.tsx` line 32. Out of scope for Slice C; flagging in case Slice D wants to silence it (it makes test output noisy without affecting correctness).

3. **`window.confirm` not invoked in any of these tests.** The tested flows do not hit confirmation dialogs (`Start tracking` and `Dismiss` are direct actions). The existing bulk-switch path in DayDetailModal does call `window.confirm` — left untouched and unmocked here because Slice C scope is plan-only/tracked rows.

## Files added

```
frontend/src/components/PlantingCalendar/CalendarGrid/__tests__/EventMarker.test.tsx
frontend/src/components/PlantingCalendar/CalendarGrid/__tests__/DayDetailModal.test.tsx
frontend/src/components/PlantingCalendar/CalendarGrid/__tests__/GroupedEventsModal.test.tsx
frontend/src/components/PlantingCalendar/ListView/__tests__/ListView.test.tsx
frontend/src/components/__tests__/IndoorSeedStarts.banner.test.tsx
```

No source files modified. No new fixtures committed (all fixtures are inline factory functions). No backend tests added (none required — backend untouched in Slices A/B).
