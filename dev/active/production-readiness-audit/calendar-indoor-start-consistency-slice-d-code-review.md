# Calendar / Indoor Starts Consistency — Slice D Code Review (2026-04-24)

Slice of: `calendar-indoor-start-consistency-plan.md` §4 Slice D
Decision file: `calendar-indoor-start-consistency-a1-approval.md`
Reviewer: code-review

## Verdict: **LGTM** (with one recommended item)

Slice A + B + C ship cleanly against the A1 plan. Builds compile, all 16 new
tests pass, no CLAUDE.md sync-pair was touched, no backend code was modified
in service of these slices, and every mandated invariant from plan §4 Slice D
holds. The only finding worth flagging at all is **scope creep in
`IndoorSeedStarts.tsx`** — a `SearchBar` import + sort logic was added that
is *not* part of the A1 plan and not mentioned in the Slice B report. It does
not break anything and the existing tests still pass, but it should be split
into a separate commit (or reverted) so the A1 commit history reflects what
was approved.

## Build Status

- Frontend: **PASS** — `cd frontend && npm run build` compiled successfully
  (`main.ddf165c5.js` 308.72 kB gzipped, no TypeScript errors, no new lint
  warnings).
- Backend: not exercised — Slices A/B/C made zero backend changes (verified
  via `git diff --stat`).
- Targeted tests: **PASS** —
  `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="DayDetailModal|EventMarker|GroupedEventsModal|ListView|IndoorSeedStarts"`
  → 6 suites, **16/16 tests passed**.

## Plan §4 Slice D Verification (each item)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | No `IndoorSeedStart.status` mutation outside `_sync_indoor_start_on_completion` | **PASS** | Frontend POSTs only to the existing `/api/indoor-seed-starts/from-planting-event` endpoint (creates with `status='planned'`). No `PATCH /status` exists in any new code path. |
| 2 | No hardcoded URLs (`localhost:5000`, `http://`) | **PASS** | Grep over the five changed files turns up zero hits. Every fetch goes through `apiPost` / `apiGet`. |
| 3 | `indoorSeedStartStatus` predicate uses `== null` (not falsy) | **PASS** | All six occurrences across the five files use `== null` / `!= null`. No `!event.indoorSeedStartStatus` pattern. |
| 4 | `apiPost` / `apiGet` (not raw `fetch`) | **PASS** | Both new HTTP call sites (`DayDetailModal::handleStartTracking`, `IndoorSeedStarts::handleStartTrackingBannerRow`, `IndoorSeedStarts::loadData`) use the wrappers. |
| 5 | Toast / 4xx error paths | **PASS** | Both POST sites parse `response.json()` defensively, surface `body.error` when present, fall back to a default message, and on network exception toast `'Network error...'`. Banner row stays put on failure (4xx does not call `handleDismissBannerRow`). |
| 6 | No CLAUDE.md sync-pair touched | **PASS** | None of: `space_calculator.py`, `gardenPlannerSpaceCalculator.ts`, `sfg_spacing.py`, `sfgSpacing.ts`, `migardener_spacing.py`, `migardenerSpacing.ts`, `intensive_spacing.py`, `intensiveSpacing.ts`, `plant_database.py`, `plantDatabase.ts` — none modified. |
| 7 | No `event.completed = true` setters in new paths | **PASS** | Grep over the five changed files for `completed = true`/`completed: true` finds nothing in the diff. The POST flow only creates an `IndoorSeedStart`; it does not flip the `PlantingEvent`. |
| 8 | `NeedsAttentionTarget` invariance — still 12 kinds | **PASS** | `frontend/src/components/Dashboard/types.ts:181-192` — 12 kinds still: `harvest`, `indoorStart`, `transplant`, `directSeed`, `germinationCheck`, `indoorGerminationCheck`, `compost`, `seedLow`, `seedExpiring`, `livestock`, `weatherFrost`, `weatherRain`. |
| 9 | Dashboard-staleness collision | **PASS (no collision)** | Slice A/B/C did not touch `dashboard_service.py` or `NeedsAttentionPanel.tsx`. The diffs visible there in the working tree are the *separate* dashboard-staleness workstream (different finding, different decision file). The two changesets are independent — staleness adds aged-out filtering + `isStale` + `DashboardMissed`; A1 adds tracked/plan-only pills + banner. No file overlap. |
| 10 | Test quality | **PASS** | Assertions are tight (specific `data-testid`s, regex copy match, `expect.objectContaining` on POST body, exact toast text). The three Slice C non-blocking observations are correctly classified — none are blocking (see "Non-blocking observations" below). |
| 11 | Build green + targeted tests green | **PASS** | See Build Status above. |
| 12 | No backend changes | **PASS** | `git diff --stat` shows backend files modified, but those are the *staleness* workstream — none of them are part of Slice A/B/C per the slice reports. The A1 backend change-count is zero. |
| 13 | Over-engineering | **WARNING** | `IndoorSeedStarts.tsx` got a `SearchBar` import + `searchQuery` state + sorted-and-searched memo that is *not* in the plan and *not* in the Slice B report. Functional, harmless, and well-scoped, but unrelated to A1. See finding R1. |

## Banner Copy + UX Verification

- Banner copy matches user-approved string. JSX:
  `"<strong>{N}</strong> planned seeding{s} from your garden plan {is/are} not yet tracked"`
  - N=1: `1 planned seeding from your garden plan is not yet tracked`
  - N≥2: `N planned seedings from your garden plan are not yet tracked`
  Asserted by `IndoorSeedStarts.banner.test.tsx` test 1 (plural) + test 3 (singular).
- Source bed **omitted** from banner rows per approved choice — confirmed by reading
  `IndoorSeedStarts.tsx` rows: only plant icon, plant+variety name, and computed
  start date are shown.
- `overdueMode='reschedule_today'` used in **both** POST sites:
  - `DayDetailModal.tsx::handleStartTracking` line 124 (visible in diff).
  - `IndoorSeedStarts.tsx::handleStartTrackingBannerRow` payload object.
  Asserted in tests for both call sites.
- Dismiss is client-only — uses `dismissedIds: Set<number>`. Asserted by
  banner test 6: zero POST calls fire, only the 4 initial GETs.

## Findings

### Blocking
None.

### Recommended

**R1 — Scope creep in `IndoorSeedStarts.tsx`.** The diff includes a
`SearchBar` import, `searchQuery` state, and a sort+search `useMemo` rewrite
of `filteredStarts`. None of this is in the A1 plan, the A1 decision file,
or the Slice B report. It does not break anything and the new tests still
pass against it, but conflating it with A1 makes the commit history
misleading and complicates revert. **Action:** before merging A1, either
(a) split the search/sort additions into their own commit with a clear
message ("feat: add search to Indoor Starts page"), or (b) revert the
search/sort hunks and ship them separately. Pure A1 should only modify the
plan-only banner section + the existing filter logic should be unchanged.

Lines affected (sample, not exhaustive):
- `IndoorSeedStarts.tsx` import row added: `import { SearchBar } from './common/SearchBar';`
- `IndoorSeedStarts.tsx` state added: `const [searchQuery, setSearchQuery] = useState<string>('');`
- `IndoorSeedStarts.tsx` `filteredStarts` rewritten as `React.useMemo(...)` with sort + search.
- `IndoorSeedStarts.tsx` JSX added: `<SearchBar value={searchQuery} onChange={setSearchQuery} ... />` block.
- Empty-state copy now branches on `searchQuery.trim()`.

### Nit (style only)

**N1 — `eslint-disable-next-line react-hooks/exhaustive-deps` on `filteredStarts` memo.**
The memo lists `[seedStarts, filterStatus, searchQuery, plants]` but disables the
exhaustive-deps lint. `plants` is in the deps array and that's the only function-scope
dependency outside the listed ones (`getPlantName` reads from `plants`). The disable
appears unnecessary — the dep array looks complete. Worth removing the disable
comment if the lint is now satisfied, or documenting *why* it's disabled. (This is
inside the scope-creep block from R1, so it goes away if R1 is reverted/split.)

**N2 — `IndoorSeedStarts.tsx` removed `apiPut` import.** The diff drops
`apiPut` from the `import { apiGet, apiPost, apiPut, apiDelete }` line. This is
fine since it appears unused after the diff, but ensure no later code in the
file relies on it (a quick grep confirms it isn't used). Non-issue, just a
sanity-check note.

**N3 — `PlantIcon` console.log spam.** Slice C report observation 2 — pre-existing
log noise from `frontend/src/components/common/PlantIcon.tsx:32`. Not introduced
by A1. Out of scope for this review and not blocking; flagging for whoever owns
the PlantIcon component when they next touch it.

**N4 — Banner copy regex flexibility (Slice C observation 1).** The banner test
asserts copy with a `\s+` regex rather than a strict string. This is intentional —
the JSX uses inline conditionals (`seeding{N === 1 ? '' : 's'}`) which produces a
trailing-whitespace-friendly output. Accepting Slice C's reasoning here. If a
future change canonicalizes the copy into a single template, the test should be
tightened. Not blocking.

**N5 — `window.confirm` not exercised (Slice C observation 3).** The new code
paths (`Start tracking`, `Dismiss`) don't call `window.confirm`, so no test
coverage is needed. The `confirm` calls in the existing bulk-switch flow remain
untested by these new files, which is acceptable since the bulk-switch flow
wasn't modified. Not blocking.

## Confirming things the slice reports already claimed

Spot-checked against the diff:

- `EventMarker.tsx`: dashed amber outline only added when `marker.type === 'seed-start'`
  AND every event in the marker has `indoorSeedStartStatus == null && seedStartDate != null`
  AND not completed AND no weather warning (the weather ring takes precedence). Tooltip
  prepended with `[Plan only]`. Asserted by `EventMarker.test.tsx`.
- `GroupedEventsModal.tsx`: pill rendered ONLY when `marker.type === 'seed-start'`
  AND `event.seedStartDate` is truthy. No inline `Start tracking` button (per plan
  §1.1). Asserted.
- `ListView.tsx`: pill on rows where `event.seedStartDate` is set. No inline
  `Start tracking` button. Asserted.
- `DayDetailModal.tsx`: inline `Start tracking` button only on plan-only rows.
  POST body is `{plantingEventId, plantId, variety, transplantDate, desiredQuantity, overdueMode: 'reschedule_today'}`.
  On success calls `onEventUpdated?.()` (refetch) and toasts; on 4xx surfaces
  `body.error` if present and leaves the row alone. Disabled while in flight.
  Asserted across three tests.
- `IndoorSeedStarts.tsx::handleStartTrackingBannerRow`: payload is
  `{plantingEventId, plantId, variety, transplantDate, desiredQuantity: spaceRequired || 1, overdueMode: 'reschedule_today'}`.
  On 201 appends `data.indoorSeedStart` to `seedStarts` state, removes row via
  `handleDismissBannerRow`, toasts (filter-mismatch variant when `filterStatus`
  is non-`'all'`/`'planned'`). Asserted.
- `IndoorSeedStarts.tsx::handleDismissBannerRow`: pure client state mutation,
  no fetch. Asserted (zero POST calls in dismiss test).

## Sync Check

- Space calc files (4): IN SYNC (none modified).
- Plant database (2): IN SYNC (none modified).
- SFG tables (2): IN SYNC (none modified).
- MIGardener (2): IN SYNC (none modified).
- Intensive (2): IN SYNC (none modified).

## Summary

**0 blocking, 1 recommended, 5 nits.**
**Recommendation: APPROVE with R1 addressed (split or revert the SearchBar/sort scope creep).**

A1 is a clean, frontend-only ship. Pills + banner + `Start tracking` work
exactly as planned, predicates use `== null`, both POST sites use
`reschedule_today`, dismiss is client-only, no backend changes, no sync-pair
touched, 16/16 new tests pass, build clean. The one cleanup before merge is
to separate the unrelated SearchBar/sort changes in `IndoorSeedStarts.tsx`
from the A1 commit — they're benign but they shouldn't ride on the A1 PR.
