# Calendar Day-Detail Row-Splitting — Report Back (2026-04-25)

Option 1 shipped. Two commits:

| Commit | Type | Content |
|---|---|---|
| **`2dd7c57`** | `fix:` | DayDetailModal grouping (2 files) |
| `fb3e306` | `docs:` | decision + fix-report + report-back |

## Report-back

**Exact grouping rule** (byte-identical to ListView + CalendarGrid pills):
```ts
`${dateKey}_${info.markerType}_${event.plantId}_${event.variety || 'none'}_${event.gardenBedId || 'none'}`
```
Applied inside the per-phase render — outer "Direct Seed" / "Transplant" / "Start Seeds (Indoor)" buckets preserved; events grouped before render.

- `count === 1` → legacy per-event row unchanged (PlantIcon, variety, Tracked/Plan-only pills, Start-tracking, Trash, click → `onEventClick`). No regression.
- `count > 1` → aggregate row with `(N)` badge + summed quantity; Trash + Start-tracking + pills hidden (singleton-only operations). Click → existing `GroupedEventsModal` (same modal ListView already uses; per-event "Click to edit" inside still triggers `EventDetailModal`).

**Files changed:**
- `frontend/src/components/PlantingCalendar/CalendarGrid/DayDetailModal.tsx` (+184 / −36)
- `frontend/src/components/PlantingCalendar/CalendarGrid/__tests__/DayDetailModal.test.tsx` (+108)

**Build / test results:**
- `npx tsc --noEmit` → exit 0
- DayDetailModal tests: **6/6 passing** (3 pre-existing + 3 new — grouping, singleton regression, grouped-click → modal)
- ListView regression: **3/3 still passing**
- CalendarGrid broader: **10/10 passing**
- `code-review` verdict: **APPROVE**. 0 critical / 0 warnings / 2 minor non-blocking notes (pre-existing patterns)

Bulk-delete / bulk-start-tracking on grouped rows hidden in v1; future work if requested.
