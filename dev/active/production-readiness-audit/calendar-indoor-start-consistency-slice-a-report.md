# Slice A — Calendar pill + plan-only treatment — Implementation Report

Date: 2026-04-24
Owner: frontend-debugger
Plan: `calendar-indoor-start-consistency-plan.md` (§1, §4 Slice A)
Decision: `calendar-indoor-start-consistency-a1-approval.md`

## Files changed

1. `frontend/src/components/PlantingCalendar/CalendarGrid/DayDetailModal.tsx`
   - Added `apiPost` + `useToast` imports.
   - Added `trackingId` state and `useToast` destructure.
   - Added `handleStartTracking(event)` handler: POSTs to `/api/indoor-seed-starts/from-planting-event` via `apiPost` with body `{plantingEventId, plantId, variety, transplantDate, desiredQuantity, overdueMode: 'reschedule_today'}`, calls `onEventUpdated()` on 200, toasts the server `error` field on 4xx (or a default message).
   - In each `Start Seeds (Indoor)` row, computed `isPlanOnly = isSeedStartPhase && event.indoorSeedStartStatus == null && event.seedStartDate != null` and `isTracked = isSeedStartPhase && event.indoorSeedStartStatus != null`.
   - Rendered `Tracked` pill (`bg-green-100 text-green-700`) and `Plan only` pill (`border border-amber-400 text-amber-700 bg-amber-50`) inline with the existing meta line (quantity / bed name).
   - Rendered inline `Start tracking` button on plan-only rows; disables during the in-flight POST and reads `Starting...` while pending.
   - Stops propagation on the button to keep the row click (which opens the event editor) from firing.

2. `frontend/src/components/PlantingCalendar/CalendarGrid/EventMarker.tsx`
   - Added `isPlanOnlySeedStart` derived flag for `seed-start` markers (single or grouped) — true when every underlying event has `indoorSeedStartStatus == null && seedStartDate != null`.
   - Appended a dashed amber border (`border border-dashed border-amber-300`) to the marker chip when plan-only, and only when not already showing a weather-warning ring or the completed grey state (those visuals would override / conflict).
   - Added `[Plan only]` to the tooltip text when applicable.

3. `frontend/src/components/PlantingCalendar/CalendarGrid/GroupedEventsModal.tsx`
   - Inside the per-event `Status badges` row, when `marker.type === 'seed-start'` and `event.seedStartDate` is set, rendered the same `Tracked` / `Plan only` pills as DayDetailModal. No button (per plan §1.1: grouped modal is pill-only; user proceeds to DayDetailModal for the action).

4. `frontend/src/components/PlantingCalendar/ListView/index.tsx`
   - Added the pill next to the plant name `<h5>` for any row where `event.seedStartDate` is set, using the same predicate (`indoorSeedStartStatus != null` → Tracked, else Plan only). No button.

No backend file touched. `frontend/src/types.ts` already exposed `indoorSeedStartStatus?: string` on `PlantingCalendar` — no addition needed.

## Final UI copy used (verbatim)

- Pill text: `Tracked` and `Plan only`.
- Pill tooltip on `Plan only` (DayDetailModal, GroupedEventsModal, ListView): `Scheduled in your plan but not yet on the Indoor Starts page. Click Start tracking to add it.`
- Inline button label: `Start tracking` (in-flight: `Starting...`).
- Inline button tooltip: `Start tracking this seeding on the Indoor Starts page`.
- Toast on success: `Now tracking this seeding on the Indoor Starts page.`
- Toast on 4xx (default fallback): `Could not start tracking this seeding.` — overridden with `body.error` from the response when present.
- Toast on network error: `Network error while starting tracking.`
- EventMarker tooltip prefix on plan-only chips: `[Plan only]` (concatenated alongside existing `[Done]` / weather flags).

## Build result

`cd frontend && npm run build` → `Compiled successfully.` No TypeScript errors, no warnings introduced by these changes.

## Deviations from plan

None. The four files listed in plan §4 Slice A are the four files changed. The predicate (`event.indoorSeedStartStatus == null && event.seedStartDate != null`) is the explicit `== null` form mandated by the implementation prompt — no truthy-check shortcut.

Minor implementation notes (not deviations):

- The dashed outline on `EventMarker` is suppressed when the marker is already grey-completed or has a weather-warning ring. This keeps the small chip from collecting too many simultaneous visual treatments. Plan §1.2 says "use a dashed border instead of a solid one (no extra glyph)" — the dashed border is the only added decoration; the carve-outs prevent it from competing with already-louder states.
- The `Start tracking` button uses `bg-amber-500` (warm orange-yellow) to match the `Plan only` pill's amber palette. Plan §1.4 doesn't specify the button color; this maintains visual coherence with the pill.
- `apiPost` accepts a relative URL and prepends `API_BASE_URL` from `frontend/src/config.ts` (verified by reading `frontend/src/utils/api.ts`). No hardcoded URL.

## Blockers found for Slice B

None blocking. Slice B (`IndoorSeedStarts.tsx` banner) is independent of this slice. Two soft notes:

1. The `from-planting-event` endpoint signature this slice POSTs to is the same one Slice B will call from the banner — so the request shape used here (`overdueMode: 'reschedule_today'`) is the locked-in default for both surfaces.
2. The pill flips from `Plan only` to `Tracked` only after `onEventUpdated()` triggers a refetch of `/api/planting-events`. The DayDetailModal's existing `onEventUpdated` plumbing is already wired (used by bulk-switch + delete). Slice B will not need a new prop.

## Manual-test status

Build verified: yes (`Compiled successfully`).

Browser/dev-server verification: **not performed**. I did not start the dev server or click through the modal in this session — the build success is the only post-change verification I ran. Per the prompt's instruction ("if you can't reach a dev server, say so explicitly"): I did not reach a dev server; visual confirmation that the pills render in the expected positions has not been done. Slice C tests will cover this with rendering assertions; out of scope for this slice.

Recommended manual smoke test (for whoever runs the dev server next):

1. Open Planting Calendar on a date that has at least two `Start Seeds (Indoor)` events — one with a linked IndoorSeedStart, one without.
2. Confirm the row with a linked start shows a green `Tracked` pill, the other shows an amber `Plan only` pill plus the inline `Start tracking` button.
3. Click `Start tracking` → success toast, modal stays open, pill flips to `Tracked` after the events refresh.
4. Open the month grid; the chip on the plan-only day should show a dashed amber border.
5. Open the grouped events modal (multiple plantings same day same plant) → each row's status-badge area shows the right pill, no `Start tracking` button.
6. Open the List View → each indoor-start event shows the right pill next to the plant name, no button.
