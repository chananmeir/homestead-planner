# Calendar / Indoor Starts Consistency — A1 Implementation Plan (2026-04-24)

Authoritative inputs: the decision file, the triage, and the finding (linked from the same folder). User chose **A1** explicitly; **A2 is out of scope** for this pass — `export_to_calendar` semantics do not change here.

A1 in one sentence: surface the asymmetry between PlantingEvent (schedule) and IndoorSeedStart (tracking) directly in the UI; give every plan-only seeding a one-click `Start tracking` action that calls the existing `/api/indoor-seed-starts/from-planting-event` endpoint.

---

## 1. Calendar Distinction — UI Shape

### 1.1 Where the indicator must appear

The calendar surfaces every PlantingEvent with a populated `seedStartDate`. To stay consistent everywhere a user can see "indoor start work due", the same `Tracked` vs `Plan only` distinction must be added to **all four** indoor-start surfaces:

| Surface | File | What it renders | Change |
|---|---|---|---|
| Day detail modal (primary) | `frontend/src/components/PlantingCalendar/CalendarGrid/DayDetailModal.tsx` | Per-event row inside the `Start Seeds (Indoor)` group. | Add a status pill on each row + inline `Start tracking` button when plan-only. |
| Month grid event marker | `frontend/src/components/PlantingCalendar/CalendarGrid/EventMarker.tsx` | Single dot/badge per event in the day cell. | Apply a subtle visual differentiator (dashed outline) when plan-only. No button — clicking opens DayDetailModal where the action lives. |
| Grouped events modal (when day cell overflows) | `frontend/src/components/PlantingCalendar/CalendarGrid/GroupedEventsModal.tsx` | Compact rows similar to DayDetailModal. | Same pill as DayDetailModal. No inline button (user proceeds to DayDetailModal). |
| List view | `frontend/src/components/PlantingCalendar/ListView/index.tsx` | Per-event rows grouped by month. | Same pill on rows where `seedStartDate` is set. |

`CalendarDayCell.tsx` already consumes `indoorSeedStartStatus` for completion tone but does not render any visible label — it does not need a separate Plan-only badge at the cell level (the marker dot inside the cell carries it).

### 1.2 Visual treatment + copy

Two pills, both small, no emoji, neutral tone:

- **`Tracked`** — solid green pill (`bg-green-100 text-green-700`) for events where `indoorSeedStartStatus != null`. Indicates a linked `IndoorSeedStart` exists.
- **`Plan only`** — outline pill (`border border-amber-400 text-amber-700 bg-amber-50`) for events where `indoorSeedStartStatus == null` and `seedStartDate` is set. Title attribute / tooltip: "Scheduled in your plan but not yet on the Indoor Starts page. Click Start tracking to add it."

The completion checkmark already shown for "started" rows (status beyond `planned`) stays — pills and the existing checkmark coexist. For an EventMarker, plan-only events use a dashed border instead of a solid one (no extra glyph).

### 1.3 How the calendar knows which is which

The calendar already has the answer — no new derived field on `PlantingEvent.to_dict()` is required. `gardens_bp.py::planting_events()` GET handler already overlays each event's `to_dict()` with `event_dict['indoorSeedStartStatus'] = seed_start_map.get(event.id)`, returning `null` when no linked `IndoorSeedStart` exists. All four calendar surfaces (and the existing `types.ts::PlantingCalendar.indoorSeedStartStatus?: string`) already consume this.

**Decision:** no backend change. The frontend uses `indoorSeedStartStatus == null && seedStartDate != null` as the "Plan only" predicate. This keeps the change frontend-first.

(The triage suggested a `hasIndoorStart: boolean` derived field; that is unnecessary here because the existing overlay already encodes both presence and status in one field — `null` means "no link", any string means "linked".)

### 1.4 Plan-only row deep-link behavior

When a user clicks **`Start tracking`** on a plan-only row inside DayDetailModal:

- POST to `/api/indoor-seed-starts/from-planting-event` (existing endpoint in `utilities_bp.py`) with `{plantingEventId, plantId, variety, transplantDate, desiredQuantity, overdueMode: 'reschedule_today'}` derived from the event row. `overdueMode: 'reschedule_today'` is the safest default for past-due seedings (clamps start date to today, slides forward). If the event's `seedStartDate` is in the future, the endpoint accepts the computed dates without clamping.
- On 200, optimistic update: re-fetch the events list (the overlay handler already exists — `onEventUpdated` callback wired through DayDetailModal). The pill flips from `Plan only` to `Tracked` once `indoorSeedStartStatus` is repopulated by the next GET.
- On 400 (overdue refused) or 4xx, show toast with the error message, no row mutation.
- Stay in DayDetailModal — do **not** navigate to the Indoor Starts tab. The user is on the calendar to see today's work; jerking them away breaks flow. (The user can always navigate manually if they want to inspect the new IndoorSeedStart record.)

For the Indoor Starts page surface (§2 below), a `View on calendar` deep-link is also unnecessary in this pass: the row already shows the `seedStartDate` and `Start tracking` is one click — adding a link to the calendar invites a navigation loop.

---

## 2. Indoor Starts Page — `Start tracking` Surface

### 2.1 Existing layout (verified by reading `IndoorSeedStarts.tsx`)

- Tab is implicit — there is no inner tab bar; the page is a header + stats grid + filter pill row + `seedStarts` card grid.
- Filter pills: `all | planned | seeded | germinating | growing | hardening | transplanted | failed`. `filterStatus='all'` by default.
- Cards render `IndoorSeedStart` rows from `GET /api/indoor-seed-starts`. Empty state shows "No seed starts yet."
- Stats cards count from `seedStarts` only (active/germinating/growing/transplanted).

There is no current notion of "PlantingEvents that should be tracked here but aren't."

### 2.2 Recommendation: a banner-driven collapsible section above the card grid

**Placement: (a) banner above the card grid that expands into an inline list.** Not a new pill (would distort the existing pill semantics — those are statuses of `IndoorSeedStart` rows, not a different entity), not inline-mixed (would corrupt the existing card layout's mental model where every card is a tracked record).

**Why banner:**
- Discoverable when the count > 0; invisible when zero so it doesn't add chrome on a clean account.
- Doesn't pretend the rows are `IndoorSeedStart` records — they're `PlantingEvent` rows that *could* become tracked.
- Self-contained: dismissing a row simply hides it locally (the underlying PlantingEvent is unaffected).

**Tradeoff vs sub-tab:** a sub-tab would more strongly compartmentalize the two layers but adds a navigation surface for a transient list. Banner is lighter-weight and matches the "until you reconcile, here are the gaps" mental model.

### 2.3 Banner shape

Above the card grid, below the filter pills:

```
[!] N planned seedings from your garden plan are not yet tracked.   [Show all ▾]
```

Expanded, each row shows:

| Column | Source |
|---|---|
| Plant icon + name | `PLANT_DATABASE.find(p => p.id === event.plantId)` (already loaded as `plants` state) |
| Variety | `event.variety` |
| Computed start date | `event.transplantDate − plant.weeksIndoors` (the endpoint computes this; show what the endpoint will write) |
| Source bed | `event.gardenBedId` resolved against `gardenBeds` (page does not currently load these — see §4 sync risks) |
| Action: `Start tracking` | POST `/api/indoor-seed-starts/from-planting-event` |
| Secondary: `Dismiss` | local-only — removes from this session's banner, no backend write |

Empty state: when `needsIndoorStarts.length === 0`, the banner does not render.

### 2.4 What `Start tracking` does on click

1. Issue `POST ${API_BASE_URL}/api/indoor-seed-starts/from-planting-event` (via `apiPost`) with body `{ plantingEventId, plantId, variety, transplantDate, desiredQuantity, location: <inherited or empty>, overdueMode: 'reschedule_today' }`.
2. On `response.ok`, the response body is the freshly-created `IndoorSeedStart`. Append it to `seedStarts` state and remove the matching event from the banner list. **No page reload.** The new card appears in the regular grid (because `filterStatus='all'` by default). If the user has narrowed to a different filter pill, the new card may not be visible — surface a toast: "Now tracking — visible under Planned."
3. On `response.status === 400` with `{skipped: true, ...}` (overdueMode skip path) — show toast and leave the row in the banner. Should not happen with `reschedule_today` but defensive.
4. On other errors — toast the error message, leave row in banner.

### 2.5 Data source for the banner

`GET /api/planting-events/needs-indoor-starts` (existing in `gardens_bp.py`). It already filters to events with `transplant_date` set, plant has `weeksIndoors > 0`, and no linked IndoorSeedStart. No backend changes needed. Loaded once on page mount alongside `seedStarts`/`plants`/`seedInventory`, refreshed after every successful `Start tracking` call (it gets shorter by one).

### 2.6 Empty state

When the banner has zero rows it simply doesn't render. The page's existing empty state ("No seed starts yet. Click 'Start Seeds' to begin!") covers the case where everything is empty — but if a user has plan-only seedings and no tracked rows, the banner is the obvious affordance, exactly the reconciliation path the finding asks for.

---

## 3. Deep-Link Target Analysis

### 3.1 Existing kinds (read from `frontend/src/components/Dashboard/types.ts`)

The `NeedsAttentionTarget` discriminated union currently has **12 kinds**: `harvest`, `indoorStart`, `transplant`, `directSeed`, `germinationCheck`, `indoorGerminationCheck`, `compost`, `seedLow`, `seedExpiring`, `livestock`, `weatherFrost`, `weatherRain`. (The PM memory note listed 12 — verified.)

### 3.2 Decision: **no new kind required.**

A1's deep-linking surface area is small:

- The Dashboard's existing `indoorStart` kind already targets the Indoor Starts tab and resolves a focus row by `indoorSeedStartId` (preferred) or `plantingEventId` (fallback via `IndoorSeedStarts.tsx` resolvedFocusId memo, which checks both).
- `IndoorStartDueRow.indoorSeedStartId` is already nullable in the dashboard payload — meaning the dashboard already handles "PlantingEvent that needs an IndoorSeedStart" via `Path A` in `dashboard_service.py::_build_indoor_starts_due` (PlantingEvent-driven rows). When the user clicks one, App.tsx sets `indoorStartFocusId` to the `plantingEventId`. `IndoorSeedStarts.tsx::resolvedFocusId` matches by `s.plantingEventId === focusIndoorStartId`. If no `IndoorSeedStart` exists yet (plan-only), the match returns the raw id and `useFocusHighlight` no-ops gracefully.
- After A1 ships, the user clicks the dashboard row → lands on the page → sees the row in the new banner (because the page now surfaces plan-only events) → clicks `Start tracking` → row moves into the regular grid. The dashboard row remains valid.

**No 13th kind, no new payload, no `useFocusHighlight` change.** The banner does not need its own focus-highlight target — it scrolls into view if the user is sent there with a stale plan-only row, but the existing focus path is for tracked rows.

### 3.3 Caveat to record

`IndoorSeedStarts.tsx::useFocusHighlight` registers refs by `IndoorSeedStart.id` only. A dashboard row whose `indoorSeedStartId` is `null` (plan-only) and only carries `plantingEventId` will cause `resolvedFocusId` to fall through to the raw `plantingEventId` and miss every registered ref — focus highlight silently no-ops. This is acceptable for A1 (the row will be visible in the banner anyway), but an extension worth noting: if the plan-only banner items become important enough to focus-scroll-to, we'd register refs by event id under a different focus axis. Out of scope here.

---

## 4. Implementation Scope

### Slice A — Calendar pill + plan-only treatment (frontend only)
- **Owner:** `frontend-debugger`
- **Files:**
  - `frontend/src/components/PlantingCalendar/CalendarGrid/DayDetailModal.tsx` — add `Tracked` / `Plan only` pills on each `Start Seeds (Indoor)` row; add inline `Start tracking` button on plan-only rows; wire `apiPost` + `onEventUpdated` callback after success; add toast hook (`useToast`).
  - `frontend/src/components/PlantingCalendar/CalendarGrid/EventMarker.tsx` — when marker `type === 'seed-start'` and `event.indoorSeedStartStatus == null`, switch outline to dashed.
  - `frontend/src/components/PlantingCalendar/CalendarGrid/GroupedEventsModal.tsx` — same pill on grouped rows.
  - `frontend/src/components/PlantingCalendar/ListView/index.tsx` — same pill on rows where `seedStartDate` is set.
- **Sync risk:** none. No paired-file table in CLAUDE.md is touched (no space calc, no plant DB, no SFG/MIGardener tables). The `indoorSeedStartStatus` field is already in `frontend/src/types.ts` and overlay-injected by `gardens_bp.py::planting_events()`.
- **Complexity:** **S–M.** Four file edits, all UI-pure except for the one `apiPost` in DayDetailModal.

### Slice B — Indoor Starts banner + `Start tracking` action (frontend only)
- **Owner:** `frontend-debugger`
- **Files:**
  - `frontend/src/components/IndoorSeedStarts.tsx` — add `needsIndoorStarts` state + initial GET on mount; render banner above card grid when count > 0; expand/collapse state; `Start tracking` handler hitting `/api/indoor-seed-starts/from-planting-event`; toasts; refresh-on-success.
  - Optional new file `frontend/src/components/IndoorSeedStarts/PlanOnlySeedingsBanner.tsx` if the section grows past ~80 lines — recommended for testability and to keep `IndoorSeedStarts.tsx` from growing further.
- **Open data question:** the page does not currently load `gardenBeds` (only `plants`, `seedInventory`, `seedStarts`). To show the source bed name in banner rows we need either (a) load `GET /api/garden-beds` on mount (small extra fetch) or (b) skip the bed name and only show plant/variety/date. Recommend (a) — same pattern as `IndoorSeedStarts/EditSeedStartModal`.
- **Sync risk:** none. No paired-file table touched.
- **Complexity:** **M.** One large file edit, optional component extraction, extra GET call.

### Slice C — Tests
- **Owner:** `test-engineer`
- **Backend:** no new tests required because no backend change. **Verify** existing tests for `/api/planting-events/needs-indoor-starts` and `/api/indoor-seed-starts/from-planting-event` still pass — `cd backend && python -m pytest tests/ -k "needs_indoor_starts or from_planting_event"`. Add one regression assertion if a gap is found.
- **Frontend:**
  - DayDetailModal: render two events (one with `indoorSeedStartStatus='planned'`, one with `null`) — assert `Tracked` pill on the first, `Plan only` pill + `Start tracking` button on the second.
  - DayDetailModal: click `Start tracking` → assert `apiPost` called with the right body shape and `onEventUpdated` invoked on success; assert error toast on 4xx.
  - IndoorSeedStarts: with mocked `/api/planting-events/needs-indoor-starts` returning 3 rows, assert banner shows "3 planned seedings…" and 3 expand rows.
  - IndoorSeedStarts: click `Start tracking` on a banner row → assert POST body, banner row removed from list, new card appears in grid (mock 200 response). Assert toast on filter mismatch case.
  - Empty banner: with `needs-indoor-starts` returning `[]`, assert banner not in the DOM.
- **No E2E required this pass** — the affordance is small and well-covered by unit/integration. If we promote to E2E later, the test would: export a transplant-method plan → open today's day modal → assert pill + button → click → confirm IndoorSeedStarts page banner emptied.
- **Complexity:** **S** (≈ 8 new test cases, no fixtures changes).

### Slice D — Code review
- **Owner:** `code-review`
- **Scope:** verify (1) no `IndoorSeedStart.status` mutation outside `_sync_indoor_start_on_completion` (the `from-planting-event` endpoint creates with `status='planned'` — compliant); (2) no hardcoded URLs (`API_BASE_URL` used); (3) `PlantingCalendar.indoorSeedStartStatus` consumed via `== null` not falsy; (4) `apiPost` not raw `fetch`; (5) toast/error paths covered; (6) no CLAUDE.md sync-pair touched.
- **Complexity:** **S.**

### Slice E — Documentation recorder (post-merge)
- **Owner:** `documentation-recorder`
- **Scope:** record the A1 ship + reference the deferred A2 decision back to `calendar-indoor-start-consistency-decision.md`. Update `APPLICATION_FEATURES.md` if Indoor Starts page section names the affordance.
- **Complexity:** **S.**

---

## Total Complexity: M (frontend-first holds)

No backend code changes. No schema changes. No paired-file sync rule triggered. The triage's recommended endpoints (`/api/planting-events/needs-indoor-starts` + `/api/indoor-seed-starts/from-planting-event`) cover everything A1 needs.

If the user pushes for the source-bed name in the banner, that's still frontend (one extra GET). Anything beyond that — auto-creating IndoorSeedStarts on export, modifying `from-planting-event` semantics, batch `Start tracking all` actions — is A2 territory and explicitly out of scope.

---

## Open Questions Before Coding

1. **Banner copy:** "planned seedings from your garden plan are not yet tracked" — acceptable? Alternative: "scheduled indoor starts not yet on this page". The decision file says no emoji, neutral tone — confirming the proposed copy meets that bar.
2. **Source bed in banner:** show it or omit it? Showing requires `GET /api/garden-beds` on Indoor Starts page mount; omitting keeps the banner cheaper.
3. **`overdueMode` default for the calendar inline button:** propose `'reschedule_today'` (slides past-due seedings forward to today). Alternative `'skip'` would refuse plan-only rows whose `seedStartDate` is in the past, which is the more common case for an existing exported plan. `'skip'` defeats the purpose of A1 here. Confirming `'reschedule_today'`.
4. **Banner persistence:** dismissed rows reset on page reload (purely client-state). Acceptable, or do we need a server-side dismiss table? Recommend client-only — the underlying PlantingEvent stays untouched, dismissing is just cosmetic.

None of these block coding; flagging for the user's preference. If no answer, proceed with copy as drafted, omit source bed (simpler), `overdueMode='reschedule_today'`, client-only dismiss.
