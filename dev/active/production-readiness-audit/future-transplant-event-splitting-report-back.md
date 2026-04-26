# Future-Transplant Event-Splitting — Report Back (2026-04-25)

Options A + C shipped. Three commits on `main`:

| Commit | Type | Content |
|---|---|---|
| **`47a0e4a`** | `fix:` | Option A — ListView grouping (3 files) |
| **`290ecae`** | `fix:` | Option C — PlantConfigModal Transplant guardrail (1 file) |
| `9fec3da` | `docs:` | decision-v2 + fix-report + report-back |

## Report-back

**Exact ListView grouping rule (Option A):** Composite key identical in shape to CalendarGrid's:

```ts
`${dateKey}_${primary.type}_${event.plantId}_${event.variety || 'none'}_${event.gardenBedId || 'none'}`
```

- `count === 1` → legacy card unchanged (checkbox + Remove preserved). No regression.
- `count > 1` → single card with `(N)` badge + `Click to manage →` hint → opens existing `GroupedEventsModal` (bulk complete + per-event edit). Wired through new `onEditEvent` + `onEventUpdated` props from `PlantingCalendar/index.tsx` so the modal's per-event edit triggers the same `EventDetailModal` opened from CalendarGrid.

**Exact Transplant guardrail behavior (Option C):** `transplantDisabled = !representativePlant?.weeksIndoors` — true for `undefined`/`null`/`0`/falsy. When disabled:
- Radio + label both `disabled` with `opacity-50 cursor-not-allowed`.
- Helper text becomes: *"This crop is typically direct-seeded. Transplant requires indoor seed starting (weeks indoors)."*
- Plants with `weeksIndoors > 0` (tomato, pepper, etc.) unchanged.

**Build / test results:**
- `npx tsc --noEmit` → exit 0, zero TypeScript errors
- ListView tests: **3/3 passing** (1 updated for distinct bedIds, 2 new — grouped + singleton)
- `code-review` agent: **APPROVE — Ready to commit**. 0 critical / 0 warnings / 0 suggestions

Option B (auto-populate `row_group_id` on multi-cell drops) remains deferred per decision-v2.
