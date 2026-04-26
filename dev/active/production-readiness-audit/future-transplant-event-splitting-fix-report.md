# Future-Transplant Event-Splitting — Fix Report (2026-04-25)

Options A and C from `future-transplant-event-splitting-decision-v2.md`
shipped. Option B (`row_group_id` auto-population) remains deferred.

---

## Exact ListView grouping rule (Option A)

**Group key (composite)**:
```typescript
const groupKey = `${dateKey}_${primary.type}_${event.plantId}_${event.variety || 'none'}_${event.gardenBedId || 'none'}`;
```
Identical in shape to `CalendarGrid/utils.ts:139`. Inline comment in
`ListView/index.tsx` cites the source-of-truth file so future
contributors know the two are intentionally synchronized.

**Behavior**:

| Field | `count === 1` (singleton) | `count > 1` (grouped) |
|---|---|---|
| Card title | `Tomato (Brandywine)` | `Tomato (Brandywine) (4)` |
| `(N)` badge | hidden | shown (`text-sm font-semibold ml-1`) |
| Inline checkbox | shown (per-event toggle) | hidden (delegated to modal) |
| Remove button | shown | replaced by `Click to manage →` hint |
| Cursor | default | `cursor-pointer hover:bg-gray-50` |
| Group summary | hidden | `{completedQty}/{totalQty} planted across {count} plantings` |
| Click | no card-level handler (preserves legacy UX) | opens existing `GroupedEventsModal` |

The `GroupedEventsModal` already exists and powers CalendarGrid's
grouped pills — ListView now reuses it. Bulk-complete, partial
completion, and per-event edit all wire through the parent's
`onEditEvent` and `onEventUpdated` callbacks.

**Files changed (Option A)**:
- `frontend/src/components/PlantingCalendar/ListView/index.tsx` — grouping logic + render rewrite
- `frontend/src/components/PlantingCalendar/index.tsx` — wired `onEditEvent` and `onEventUpdated` props (2 lines)
- `frontend/src/components/PlantingCalendar/ListView/__tests__/ListView.test.tsx` — 1 updated test (distinct bedIds), 2 new tests (grouped + singleton)

---

## Exact Transplant guardrail behavior (Option C)

**Condition**:
```typescript
const transplantDisabled = !representativePlant?.weeksIndoors;
```
True when `weeksIndoors` is `undefined`, `null`, `0`, or `NaN`. Mirrors
the existing default-method computation in the same modal
(`weeksIndoors > 0 ? 'transplant' : 'direct'`), so a plant whose
default is `'direct'` is exactly the plant that gets the radio
disabled.

**Visual**:
- Disabled radio with `disabled:opacity-50 disabled:cursor-not-allowed`.
- Wrapping `<label>` also gets `cursor-not-allowed opacity-50` so the
  whole click-region shows the disabled state.

**Helper text replacement**:
- **Disabled**: *"This crop is typically direct-seeded. Transplant requires indoor seed starting (weeks indoors)."*
- **Enabled** (unchanged from before): *"Seeds will be sown directly in the garden"* / *"Seedlings will be transplanted from indoor starts"* depending on selection.

**Plants with `weeksIndoors > 0`** (tomato, pepper, eggplant, etc.):
no change. Both radios remain enabled and interactive.

**Edge case**: If the modal somehow opens with `plantingMethod === 'transplant'`
and a `weeksIndoors=0` plant, the existing reset effect at
`PlantConfigModal.tsx:1042-1048` already routes the default method to
`'direct'` on `isOpen` / `representativePlant` change. So the user
never sees a stuck-on-transplant disabled radio.

**Files changed (Option C)**:
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` — disabled state + helper text branching (lines 1897-1943); also removed unused `ValidationResult` from imports.

---

## Commits

- **`47a0e4a`** — `fix: ListView groups same-key events to mirror CalendarGrid` (Option A)
- **`290ecae`** — `fix: Disable Transplant in PlantConfigModal for direct-seed-only crops` (Option C)
- _(this report)_ — `docs:` follow-up commit

---

## Build / test results

**TypeScript**: `cd frontend && npx tsc --noEmit` → exit 0, zero errors.

**ListView tests** (`CI=true npx react-scripts test --testPathPattern="ListView" --watchAll=false`):
```
PASS src/components/PlantingCalendar/ListView/__tests__/ListView.test.tsx
  ListView — Plan only / Tracked pills
    ✓ renders Tracked pill for tracked seed-start row and Plan only pill for plan-only row
  ListView — Option A grouping (same date+type+plant+variety+bed collapses to one card)
    ✓ collapses N events sharing the group key into a single card with "(N)" badge
    ✓ singleton group (count === 1) renders the legacy per-event card unchanged

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

**Code review**: `code-review` agent verdict — **APPROVE — Ready to commit**. Zero critical, zero warnings, zero suggestions.

---

## Out of scope

- **Option B** (auto-populate `row_group_id` on multi-cell drops): deferred per decision-v2. Worth revisiting only if the calendar still feels fragmented after A + C land.
- **Layer 2** (nursery / store-bought escape hatch): tracked separately under the parent future-transplant finding.
