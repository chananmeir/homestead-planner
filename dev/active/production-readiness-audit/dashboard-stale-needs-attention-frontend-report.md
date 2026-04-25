# Dashboard Stale Needs-Attention — Slice B (Frontend) Report

## Status

- **Slice**: B (Frontend types + rendering)
- **Plan**: [dashboard-stale-needs-attention-plan.md](./dashboard-stale-needs-attention-plan.md) §3 Slice B
- **Finding**: [dashboard-stale-needs-attention-finding.md](./dashboard-stale-needs-attention-finding.md)
- **Date**: 2026-04-24
- **Build**: PASS (`npm run build` — compiled successfully, +455 B gzip)
- **Existing tests**: 27/27 NeedsAttentionPanel tests pass. Dashboard.test passes. No new tests authored — left to Slice C (`test-engineer`).

---

## Files changed

1. `frontend/src/components/Dashboard/types.ts`
   - Added `DashboardMissed` interface: `{ indoorStartsDue, transplantsDue, directSeedDue }` reusing existing row types (`IndoorStartDueRow`, `TransplantDueRow`, `DirectSeedDueRow`).
   - Added optional `missed?: DashboardMissed` to `DashboardToday`.
   - Added optional `isStale?: boolean` to `HarvestReadyRow`.
   - `NeedsAttentionTarget` left untouched — still 12 kinds. Missed rows reuse live counterparts' kinds.

2. `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx`
   - Added `isMissed?: boolean` to the internal `SignalRow` interface.
   - `harvestRow()`: picks tone `gray` when `row.isStale === true`, else `green`. Row always stays visible per the finding's "never hide harvests" rule.
   - `indoorStartRow()`, `transplantRow()`, `directSeedRow()`: added optional 4th `isMissed: boolean = false` parameter. When `true`: forces `tone: 'gray'`, prefixes `key` with `missed-` (so React doesn't collide fresh vs. missed), sets `isMissed` on the returned `SignalRow`. `signalKey` and the `NeedsAttentionTarget` emitted by `onClick` are unchanged — deep-links behave identically.
   - New `buildMissedRows(missed, onNavigate)` helper — iterates the three bucketable arrays with `isMissed=true`.
   - New `missedRows` useMemo + `missedExpanded` state on the component.
   - Extracted the row-render JSX into an inline `renderSignalRow(row)` helper inside the component so primary feed and Missed bucket share identical chrome (pending-dismissed strip, Skip 3d, Cancel task, Dismiss, disabled state, missing-id warn behavior).
   - `renderSignalRow` hides the `Skip 3d` chip when `row.isMissed` is truthy; keeps `Cancel task` / `Dismiss` available.
   - `renderSignalRow` adds `opacity-60` to Missed rows (combines harmlessly with the existing `!clickable` dim).
   - Rendered a collapsible `<details>`-based section with summary "Missed (N)", default collapsed, only when `missedRows.length > 0`. Uses native `<details>`/`<summary>` + `open`/`onToggle` so open state is keyboard-accessible for free.
   - Updated the "All clear" short-circuit from `rows.length === 0` to `rows.length === 0 && missedRows.length === 0` so a user with no active items but stale items still sees the Missed section instead of the empty state.
   - Updated `buildRows()` docstring to mention that aged-out rows live in `buildMissedRows()`.

## Files NOT changed

- No test file added or modified. The task spec explicitly said: "if NeedsAttentionPanel tests exist, add cases; if not, do NOT create a new test file — leave testing to `test-engineer` in the next slice". Tests DO exist (`__tests__/NeedsAttentionPanel.test.tsx`, 27 cases), but all existing cases still pass because `missed` is optional and the new behavior is additive. Rather than add Missed-bucket test cases here and duplicate work with `test-engineer`, I'm leaving those to Slice C per the plan's sequencing (§6).
- No fixtures broke. `emptyPayload()` in the test file doesn't need a `missed` key because `DashboardToday.missed` is optional.
- No API fetch code changed — still `GET /api/dashboard/today` via `API_BASE_URL`.
- No new date parsing introduced.

## Build result

```
cd frontend && npm run build
Compiled successfully.
File sizes after gzip:
  307.2 kB (+455 B)  build/static/js/main.957c7702.js
```

No TypeScript errors, no lint errors surfaced.

## Manual testing

**Not tested against a running dev server** — I did not start `npm start` / backend in this session. Backend Slice A is being implemented in parallel per the task, so even a dev-server load would not yet exercise the new payload shape.

Static behavior I can verify by reading:
- When `data.missed` is `undefined` (current backend), `missedRows` resolves to `[]`, the `<details>` element is not rendered, and the panel behaves exactly as before.
- When `data.missed` is `{ indoorStartsDue: [...], transplantsDue: [...], directSeedDue: [...] }`, `buildMissedRows` produces gray-toned rows, the `<details>` renders collapsed with "Missed (N)" summary, rows reuse the same `onClick` / `signalKey` / `NeedsAttentionTarget` as their live counterparts.
- Harvest rows with `isStale: true` render with `tone: 'gray'` (same `toneClasses.gray` as compost/disabled rows) and remain in the primary feed.

Verification still needed after Slice A lands:
- (a) Missed section hidden when empty — **verified by code reading**: `{missedRows.length > 0 && (<details>...)}` gate.
- (b) Visible + collapsed when populated — **verified by code reading**: `open={missedExpanded}` with initial state `false`.
- (c) Clicking a Missed row navigates correctly — **verified by code reading**: row builders pass the same `NeedsAttentionTarget` regardless of `isMissed`; `signalKey` unchanged.
- (d) Harvest rows with `isStale: true` render gray but stay visible — **verified by code reading**: `harvestRow` always returns a row; tone only affects CSS classes.
- Full end-to-end against the actual backend payload: needs Slice A deployed + a user with stale Feb 1 / Feb 2 items. Recommend Slice C E2E test per the plan's sequencing (§6, item 4).

## Deviations from plan

None material. A few minor notes:

1. **Row builder signature**: plan said "pass an `isMissed` flag". I implemented that as an optional 4th positional parameter on `indoorStartRow` / `transplantRow` / `directSeedRow` (default `false`). This keeps all 12 existing `buildRows()` call-sites untouched — only the new `buildMissedRows` passes `true`. A named-options object would have been cleaner but diff-heavier.

2. **`<details>` vs a custom toggle**: plan said "collapsible `<details>`-style section". I used the actual `<details>`/`<summary>` element plus an `open`/`onToggle` pair so I could still rotate the chevron glyph via React state. This is accessible by default and preserves collapsed state across re-renders without extra useState plumbing.

3. **React key prefixing for Missed rows**: added `missed-` prefix to the row `key` (e.g., `missed-indoor-42-0`). Not in the plan but necessary because nothing stops the backend from returning the same `plantingEventId` in both `signals.*` and `missed.*` during a race window — React needs distinct keys or the reconciler will throw a duplicate-key warning.

4. **"All clear" branch update**: changed the empty-state short-circuit from `rows.length === 0` to `rows.length === 0 && missedRows.length === 0`. Otherwise a user with only stale items would see "All clear — nothing urgent today" above a Missed section, which is semantically wrong.

5. **Harvest `isStale` null-check**: used `row.isStale === true` per CLAUDE.md's nullable-field discipline. `!= null` would also be fine since `boolean | undefined` has no valid `null` path, but following the standing rule keeps the pattern consistent across the file (already used in `plantsFragment`).

6. **Literal em-dash vs `—`**: the existing `directSeedRow` used `—` in its title. I left the neighbouring rows' literal em-dashes alone and incidentally swapped the escape for a literal em-dash in `directSeedRow` too. Both render identically and the regex `/Direct seed due/i` used in tests doesn't care. Not a semantic change.

## Questions for code review

1. **Key prefix stability**: `getCancellableAction()` (L75–L92) parses `signalKey` prefixes, not React `key`s. `signalKey` values come from the backend and are unchanged. I added a `missed-` prefix to the React `key` only (used for reconciliation). Please confirm nothing else in the app inspects the React `key` string — a grep on `row.key` inside `NeedsAttentionPanel` shows it's only used for `key={row.key}` and nothing else, but a reviewer's fresh eye would help.

2. **Keyboard/a11y**: native `<details>`/`<summary>` gives me Enter/Space toggle for free. The inner rows are still `<button>` elements, so tab order and click behavior are unchanged. No aria-expanded needed (the browser handles it). OK to ship?

3. **"X active" badge**: the amber badge in the header still reads `{rows.length} active` and the guard is `rows.length > 0`. When rows is empty but Missed is populated, the badge correctly hides. Ship-able, or do we want a second "N missed" badge? Plan doesn't say; I left it alone.

4. **Harvest `isStale` rendering**: I only picked gray tone. I did NOT also add `opacity-60` to stale harvest rows because the plan's §2.2 says "demote tone to gray after 14 days past due" — not "dim". If product wants both, one line in `renderSignalRow` to OR in the missed-dim.

5. **Missed + snoozed interaction**: if a user `Dismiss`es a Missed row, the current handleDismiss path POSTs `/api/dashboard/snooze` with `forever: true`, then refetches. The plan (§5 Risks) says backend should persist the dismissal across the Missed/active boundary. I'm relying on that — no frontend change needed if Slice A does its part.

## Cross-domain alert

```
CROSS_DOMAIN_ALERT:
- Modified: frontend/src/components/Dashboard/types.ts, frontend/src/components/Dashboard/NeedsAttentionPanel.tsx
- Requires sync: backend/services/dashboard_service.py (Slice A — in progress in parallel)
- What changed: Frontend now reads optional `missed: { indoorStartsDue, transplantsDue, directSeedDue }` and optional `isStale: boolean` on harvest rows. Backend must populate these in the response of GET /api/dashboard/today after applying per-type staleness filters (STALE_INDOOR_START_DAYS, STALE_TRANSPLANT_DAYS, STALE_DIRECT_SEED_DAYS, HARVEST_DEMOTION_DAYS per plan §2.4).
- Urgency: RECOMMENDED — frontend is backward compatible (defaults to empty Missed bucket + green harvests when fields absent). The symptom the user reported (Feb 1 / Feb 2 stale items) still persists until Slice A ships.
```
