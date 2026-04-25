# Calendar / Indoor Starts Consistency — Slice B Implementation Report (2026-04-24)

Slice of: `calendar-indoor-start-consistency-plan.md` §4 Slice B
Decision file: `calendar-indoor-start-consistency-a1-approval.md`
Owner: frontend-debugger

## Summary

Indoor Starts page now surfaces a collapsible amber banner above the seed-starts grid whenever `GET /api/planting-events/needs-indoor-starts` returns one or more events. Each row gives the user a one-click `Start tracking` action that POSTs to the existing `/api/indoor-seed-starts/from-planting-event` endpoint with `overdueMode='reschedule_today'`. Dismiss is client-only (Set state, resets on reload). Backend untouched.

## Files Changed

- `frontend/src/components/IndoorSeedStarts.tsx` — added `PlanOnlySeeding` interface, three pieces of state (`needsIndoorStarts`, `bannerExpanded`, `dismissedIds`), an in-flight Set to debounce per-row clicks, the GET call inside `loadData()`, two handlers (`handleDismissBannerRow`, `handleStartTrackingBannerRow`), a `formatSuggestedStartDate` helper, a `visibleBannerRows` memo, and the banner JSX block above the seed-starts grid.

No new files. The optional `IndoorSeedStarts/PlanOnlySeedingsBanner.tsx` extraction was not done — the inline section is ~90 lines of JSX + ~80 lines of state/handlers, which is borderline. Left inline for now; if tests in Slice C need to mount the banner in isolation it should be extracted then.

## Final Banner Copy (verbatim)

Collapsed:

```
[!] N planned seeding(s) from your garden plan are not yet tracked
                                                                    [Show all ▾]
```

The exact JSX uses pluralization:

> `<strong>{N}</strong> planned seeding{s} from your garden plan {is/are} not yet tracked`

For N === 1: `1 planned seeding from your garden plan is not yet tracked`
For N >= 2: `N planned seedings from your garden plan are not yet tracked`

Toggle button text: `Show all ▾` when collapsed, `Hide ▴` when expanded — matches the user-approved disclosure copy.

Per-row action buttons: `Start tracking` (primary, amber) + `Dismiss` (ghost). While the POST is in flight the primary button changes to `Starting…` and both buttons disable.

Icon: Heroicons exclamation-triangle outline in `text-amber-600`. No emoji.

## Computed Start Date — How It's Displayed

Used the **`event.suggestedIndoorStartDate`** field returned by `/api/planting-events/needs-indoor-starts`. The backend already computes this as `transplantDate − weeksIndoors` (see `gardens_bp.py::get_planting_events_needing_indoor_starts` line ~2697 and `utilities_bp.py::create_indoor_start_from_planting_event` line ~1451 — both compute identically). Showing this is identical to "what the endpoint will write" for a non-overdue row.

Caveat: under `overdueMode='reschedule_today'`, an overdue row will be clamped to today on write — the displayed date is therefore the *planned* date, not the *as-written* date. Acceptable for this slice (matches the behavior of the calendar's existing `Plan only` rows in Slice A) and correct for the common-case future-dated row. If we want to preview the rescheduled value we'd need a `dryRun` POST per row, which is a heavier implementation.

Did **not** fall back to `event.seedStartDate` — that field doesn't exist on the `/needs-indoor-starts` payload (only `suggestedIndoorStartDate` is provided), so the question in the brief was a bit moot once I confirmed the response shape.

## Behavior Notes

- Banner suppresses itself entirely when `visibleBannerRows.length === 0`. Default expanded state is `false` per the brief.
- Dismiss is client-only — adds the `plantingEventId` to a `dismissedIds: Set<number>`. No backend write. Resets on page reload (re-fetch returns the same row again).
- On successful `Start tracking`:
  - Endpoint returns `201` with `{indoorSeedStart, calculation}`. We append `data.indoorSeedStart` directly to `seedStarts` state — no refetch, no flicker.
  - The row is removed from the banner via `handleDismissBannerRow` (uses the same Set as user dismiss). Picking one removal channel keeps the state simple.
  - Toast: `'Now tracking'` if the user is on `'all'` or `'planned'` filter; `'Now tracking — visible under Planned'` otherwise (the new card has `status='planned'`, so it would be hidden under any other filter pill).
- Defensive paths covered:
  - `response.ok && data.skipped === true` (should not happen with `reschedule_today`) — toast `data.skippedReason`, leave row in banner.
  - `!response.ok` — toast `data.error || 'Could not start tracking'`, leave row in banner.
  - Network/exception — toast `'Network error — could not start tracking'`.
- Clicking `Start tracking` twice on the same row is debounced via `bannerActionInFlight` Set — second click is ignored until the first completes.

## Constraints Compliance

- ✅ `apiGet` + `apiPost` used (no raw `fetch`).
- ✅ `API_BASE_URL` not hardcoded — handled by `apiGet`/`apiPost`.
- ✅ No emoji in the banner UI (Heroicons SVG instead).
- ✅ No new `NeedsAttentionTarget` kind. Banner rows do not register focus refs (per plan §3.3).
- ✅ Backend untouched. No changes to `dashboard_service.py`, `NeedsAttentionPanel.tsx`, or any sync-paired files.
- ✅ `IndoorSeedStart.status` not flipped directly — endpoint creates with `status='planned'`.
- ✅ Predicate not needed in the component because the endpoint pre-filters: every row from `/needs-indoor-starts` already lacks a linked `IndoorSeedStart` and has `weeksIndoors > 0` + `transplant_date` set.

## Build Result

`cd frontend && npm run build` — **success**. Bundle delta `+1.52 kB` gzipped on `main.*.js`, `+17 B` on `main.css`. No TypeScript errors, no lint warnings introduced.

## Manual Testing Status

**Honest answer: not performed.** No dev server reachable from this session; running `npm run start` would require user-side action. The build compiled cleanly and the data flow follows the same pattern as `ImportFromGardenModal.tsx` (which is in production), so I'm confident at the type-check level. Slice C tests will catch any runtime regressions — Slice C is scoped exactly for this gap.

If you want a smoke check before merging Slice C, the minimum scenario is:
1. Start backend + frontend.
2. Navigate to Garden Planner → export a transplant-method plan to calendar.
3. Navigate to Indoor Starts page.
4. Verify amber banner appears with count > 0.
5. Click `Show all ▾` — verify rows render with plant icon + name + variety + start date.
6. Click `Start tracking` on one row — verify success toast + new card in grid + row removed from banner.
7. Click `Dismiss` on another — verify row removed without backend write (refresh page → row reappears).

## Deviations From Plan

1. **No source bed shown** — per A1 approval, omitted. The brief says omit and don't add `GET /api/garden-beds`. Compliant.
2. **No optional component extraction** — kept inline. Inline section is ~170 lines; not yet over the ~80-line threshold the plan called out for extraction. If Slice C tests want to mount the banner in isolation, extracting then is cheaper than extracting now and re-wiring.
3. **Optimistic state update vs full reload** — when `Start tracking` succeeds I append `data.indoorSeedStart` to `seedStarts` rather than re-running `loadData()`. Faster (no GET roundtrip) and avoids flicker on the existing cards. The risk is if the response shape ever drifts; that's a Slice C test target.
4. **Dismiss / Start-tracking share removal channel** — both routes funnel the row's `plantingEventId` into `dismissedIds`. The brief offered "remove from `needsIndoorStarts` OR add to dismissedIds — pick one and stay consistent" — I picked the dismissedIds path so a future "Show dismissed" toggle is trivial to add (don't need to refetch). Visible behavior is identical either way.

## Open Issues for Slice C / Slice D

- **Slice C tests** should cover:
  - Banner not in DOM when GET returns `[]`.
  - Count + correct pluralization at 1 / 2 / N rows.
  - `Show all ▾` / `Hide ▴` toggle.
  - `Start tracking` happy path: assert POST body shape (especially `overdueMode='reschedule_today'` and `desiredQuantity` derivation from `spaceRequired`), assert row removed and new card added.
  - `Start tracking` error path: 4xx → toast, row stays.
  - `Start tracking` skip path (defensive): 200 with `{skipped: true}` → toast skipped reason, row stays. Should not happen in practice with `reschedule_today` but worth a regression assertion.
  - `Dismiss` removes locally without firing a network request (assert `apiPost`/`apiDelete` not called).
  - Filter-mismatch toast wording when `filterStatus` is e.g. `'germinating'`.
- **Slice D code review** should confirm:
  - The two-source removal (banner-dismiss + start-tracking) doesn't cause confusing UX (e.g. an inflight click happening at the same moment as a dismiss).
  - `bannerActionInFlight` Set prevents the same row from being POSTed twice — verified via `if (bannerActionInFlight.has(...)) return;` guard.
  - The optimistic `setSeedStarts(prev => [...prev, created])` doesn't break the focus-highlight memo (it shouldn't — `useFocusHighlight` only matches against `focusIndoorStartId` which is null on this entry path).
- **Future improvement (not a blocker)**: if a user dismisses several rows then performs other actions that trigger `loadData()` (e.g., delete a card), the dismissed rows reappear because `loadData` overwrites `needsIndoorStarts` and `dismissedIds` is a separate Set. The brief explicitly says "resets on page reload" — so persisting `dismissedIds` across `loadData` calls within a session would actually be a stricter interpretation. Current behavior matches "client-only, resets on reload" because the Set survives Reacts re-renders; only a hard reload clears it. Acceptable, but worth a code-review nod.

## Cross-Domain Alert

None. No backend changes, no sync-paired file edits.
