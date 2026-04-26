# Calendar Day-Detail Row-Splitting — Fix Report (2026-04-25)

Third-surface application of the row-grouping pattern. Commits
`47a0e4a` (ListView) and the existing CalendarGrid pills already
collapsed same-key events; DayDetailModal was the remaining gap.

---

## Exact grouping rule

Composite key (byte-identical to existing surfaces):

```ts
const groupKey = `${dateKey}_${info.markerType}_${event.plantId}_${event.variety || 'none'}_${event.gardenBedId || 'none'}`;
```

Source-of-truth references:
- `frontend/src/components/PlantingCalendar/CalendarGrid/utils.ts:139`
- `frontend/src/components/PlantingCalendar/ListView/index.tsx:156`
- `frontend/src/components/PlantingCalendar/CalendarGrid/DayDetailModal.tsx:96` (this fix)

Applied inside the per-phase rendering: outer "Direct Seed" /
"Transplant" / "Start Seeds (Indoor)" buckets preserved; inside each
bucket, events are now grouped before render.

---

## Behavior

| Field | Singleton (`count === 1`) | Grouped (`count > 1`) |
|---|---|---|
| Plant name + variety | unchanged | + ` (N)` badge (`text-sm font-semibold text-gray-700 ml-1`) |
| Quantity summary | `event.quantity` plants | sum across group |
| Tracked / Plan-only pills | shown on seed-start phase | hidden |
| Start-tracking button | shown on plan-only seed-start | hidden |
| Trash button | shown | hidden |
| Checkmark | when complete | when ALL events complete |
| Trailing chevron | clickable → `onEventClick` | static visual only |
| Click target | inner row → `onEventClick(event)` | outer row → `setSelectedGroup` → `GroupedEventsModal` |
| `data-grouped-count` | absent | set to `count` |

`GroupedEventsModal` is the same modal ListView already uses — bulk
complete + per-event edit. Per-event "Click to edit" inside the
modal triggers `onEventClick(event)`, preserving the existing
`EventDetailModal` flow.

Singleton-only controls (Trash, Start-tracking, Plan-only/Tracked
pills) hidden on grouped rows because the underlying server
endpoints take a single `eventId`. Future bulk operations would
need separate API support; explicitly out of scope per decision.

---

## Files changed

- `frontend/src/components/PlantingCalendar/CalendarGrid/DayDetailModal.tsx`
  - +184 / -36 lines.
  - New imports for `GroupedEventsModal`, `GroupedDateMarker`, `EventMarkerType` (lines 9–10).
  - `PhaseInfo` interface and `DayGroupedItem` type (lines 23–49).
  - `getEventTypeInfo` extended to return `markerType: EventMarkerType` (lines 33–39).
  - `selectedGroup` state (line 66).
  - Two-pass: composite-key grouping → phase bucketing of groups (lines 88–119).
  - `toGroupedDateMarker`, `handleGroupedRowClick`, `handleModalEdit` helpers (lines 121–139).
  - Render branch on `isGrouped` (lines 268–409).
  - GroupedEventsModal mounted (lines 454–464).

- `frontend/src/components/PlantingCalendar/CalendarGrid/__tests__/DayDetailModal.test.tsx`
  - +108 lines.
  - First existing test updated: distinct `gardenBedId: 1 / 2` so the two events stay as separate singletons (mirrors the bedId fix in `47a0e4a`).
  - 3 new tests:
    1. 4 same-key direct-seed events render as 1 grouped row with `(4)` badge, no per-event Trash.
    2. Singleton (count === 1) row preserves Trash + Plan-only pill + Start-tracking button (regression guard).
    3. Grouped row click mounts `GroupedEventsModal` with count + plant name visible in header.

---

## Commits

- **`2dd7c57`** — `fix: DayDetailModal groups same-key events to mirror ListView/CalendarGrid`
- _(this report)_ — `docs:` follow-up commit

---

## Build / test results

- `npx tsc --noEmit` → exit 0 (clean).
- DayDetailModal: **6/6 passing** (3 pre-existing + 3 new).
- ListView regression: **3/3 still passing** (no bleed).
- CalendarGrid broader: **10/10 passing**.
- `code-review` agent verdict: **APPROVE — Ready to commit**. 0 critical, 0 warnings, 2 minor non-blocking notes (pre-existing patterns, not regressions).

---

## Out of scope

- Bulk-delete / bulk-start-tracking on grouped rows: hidden in v1; future work if requested.
- ListView, CalendarGrid pills, GroupedEventsModal: untouched.
- `PlantingCalendar/index.tsx`: untouched (no new prop wiring needed).
- Layer 2 (nursery escape hatch) and Option B (`row_group_id` auto-population) remain separately deferred per prior decisions.
