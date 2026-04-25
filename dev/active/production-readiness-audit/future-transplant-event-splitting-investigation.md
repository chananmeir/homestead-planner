# Future Transplant Event-Splitting — Investigation (2026-04-25)

Backend investigation companion to
`future-transplant-event-splitting-finding.md`. Investigation only —
no code changes.

## TL;DR

The "4 transplant events for 48 radishes" outcome is the natural
consequence of two facts, both pre-existing:

1. **The split happens entirely on the frontend.** The backend
   `batch_add_planted_items` endpoint receives N positions and
   creates N PlantedItems and N PlantingEvents — exactly one of
   each per position. There is no server-side fan-out logic that
   "explodes" a single logical row into multiple events. Whatever
   the request says, that's what gets persisted.

2. **The "transplant" label is purely UI-derived.** The calendar
   labels every event by which date field is populated, not by an
   `event_type` discriminator. Radish is direct-seeded by default
   (`weeksIndoors=0`), so the user must have explicitly toggled
   "Transplant" in the config modal — meaning the transplant label
   is correct *for the request that was actually sent*, but it is
   semantically odd for radish.

Verdict: **by-design but UX problem**. The split count and the
"transplant" framing are both accurate reports of what the user did,
but the user clearly didn't intend either.

## Q1: How does 48 radishes become 4 PlantingEvents?

### Backend behavior (no fan-out)

`backend/blueprints/gardens_bp.py:619-940`. The loop at
`gardens_bp.py:727-810` iterates `data['positions']` and creates
exactly one `PlantedItem` + one `PlantingEvent` per position:

- `gardens_bp.py:743-756` — PlantedItem per position
- `gardens_bp.py:770-810` — PlantingEvent per position

The row-continuity fields (`row_group_id`, `row_segment_index`,
`total_row_segments`) at `gardens_bp.py:797-799` are **passed
through from the request** (`seed_density_data.get('rowGroupId')`)
— the backend does not generate them. Same for `seed_density_per_sq_ft`,
`ui_segment_length_inches`, and the rest of the row metadata.

So if the request contains 4 positions, you get 4 events. Period.

### Where the 4 positions come from (frontend)

`frontend/src/components/GardenDesigner.tsx:1635-1651` — the batch
POST is invoked with the `positions` array built earlier. Two
upstream paths feed it:

1. **`config.previewPositions` path** at
   `GardenDesigner.tsx:1593-1683` — used when the modal user invoked
   auto-placement preview. Positions come straight from
   `autoPlacePlants(...)` in
   `frontend/src/components/GardenDesigner/utils/autoPlacement.ts`,
   which runs cell-by-cell (one position per grid cell that gets
   used).
2. **`squaresNeeded > 1` fallback path** at
   `GardenDesigner.tsx:1736-1791` — generates positions in a compact
   grid using `plantsPerSquare`, where one position == one grid
   cell.

In both paths, **one position == one grid cell**. The split count is
"how many grid cells the auto-placer used."

### The 48-radish math, by method

Radish data:
- `plant_database.py:494-521`: `spacing=2`, `rowSpacing=6`,
  `weeksIndoors=0` (direct-seed)
- `garden_methods.py:198-200` SFG: 16 plants per sq ft
- `garden_methods.py:217-219` row: `[6, 2]` (rowSpacing × spacing)
- `intensive_spacing.py:46`: `radish-1: 2` (2" on-center)
- `migardener_spacing.py:33`: `radish-1: (4, 1)` (4" rows × 1" spacing)
- `frontend/src/utils/sfgSpacing.ts:127-128`: 16/sqft (mirrors backend)

Frontend computes `plantsPerSquare` at
`GardenDesigner.tsx:1535-1554`:

| Bed method     | plantsPerSquare for radish | squaresNeeded for 48 |
|----------------|----------------------------|-----------------------|
| `square-foot`  | `floor((12/2)^2) = 36` (uses raw plant.spacing) | `ceil(48/36) = 2` |
| `intensive`    | `floor((12/2)^2) = 36`     | `ceil(48/36) = 2`     |
| `migardener`   | from row-density formula → ~36 (4" rows × 12" cells, ~1 seed/inch) | varies |
| `row` / other  | falls into single-position path (line 1686) | 1 position           |

None of those give 4. So the **4 events came from `previewPositions`**,
not from `squaresNeeded`. Plausible scenarios for 48 radishes
producing exactly 4 cells:

- A 4-cell row in MIGardener row mode (e.g., user requested 4 cells
  in a 1-row strip, modal multiplied 12 plants per cell × 4 cells).
- A 4-square SFG block with `numberOfSquares=4` and the user typed
  48 instead of letting the modal compute it; auto-place returned 4
  cells, batch path divides 48 into 12 each (`Math.ceil(48/4)=12`).
- A 2×2 dense-planting block where `plantsPerSquare` was
  user-overridden to 12.

Without the actual request payload, I can't pin which exact UI flow
the user took, but **4 cells is what the modal returned, and the
backend faithfully created 4 events to match.**

### Are the 4 events grouped via `row_group_id`?

**Only if the modal sent grouping metadata.** Inspecting
`PlantConfigModal.tsx` and `GardenDesigner.tsx:1635-1651`: the batch
payload at this call site does **not** include a
`seedDensityData.rowGroupId`. So the 4 events for a SFG/intensive
radish placement land with `row_group_id = NULL`,
`row_segment_index = NULL`, `total_row_segments = NULL`. There is no
client-side or server-side hint that these 4 events came from one
logical placement.

The row-continuity fields exist (added by
`migrations/custom/schema/add_row_continuity_fields.py`) and are
respected end-to-end, but they're populated only via the row-mode
codepath that runs through `seedDensityMetadata` in
`PlantConfigModal.tsx`. Default SFG/intensive placements bypass them.

`gardens_bp.py` does serialize these fields back via
`PlantingEvent.to_dict()` (`models.py:304-306`), so the frontend
*could* group them — but the records won't have the linkage to do so.

## Q2: Is the "transplant" label correct?

### Where `planting_method` is set

`gardens_bp.py:686-691`:
```python
weeks_indoors = plant.get('weeksIndoors', 0) if plant else 0
default_method = 'transplant' if weeks_indoors > 0 else 'direct'
planting_method = data.get('plantingMethod', default_method)
```

For radish, `weeksIndoors=0`, so the **server default is `'direct'`**.
The client must explicitly pass `plantingMethod: 'transplant'` to
override that.

`PlantConfigModal.tsx:1044-1048` mirrors this:
```typescript
const defaultMethod = planningMethod === 'migardener'
  ? 'direct'
  : (weeksIndoors > 0 ? 'transplant' : 'direct');
```

So for the user to land on `transplant`, they had to manually toggle
the radio button in the modal.

### How the calendar labels events

There is no `event_type='transplant'` — `PlantingEvent.event_type`
discriminates `'planting' | 'mulch' | 'fertilizing' | ...`
(`models.py:158`). The `batch_add_planted_items` path doesn't set
`event_type` explicitly, so it defaults to `'planting'`.

The calendar derives the visual label from which date column is
populated. `PlantingCalendar/CalendarGrid/DayDetailModal.tsx:22-26`:
```typescript
if (event.seedStartDate) → "Start Seeds (Indoor)"
if (event.directSeedDate) → "Direct Seed"
if (event.transplantDate && !event.seedStartDate) → "Transplant"
```

`gardens_bp.py:775-776` writes either `direct_seed_date` or
`transplant_date` (mutually exclusive) based on `planting_method`.
So if `planting_method='transplant'`, only `transplant_date` is
populated, and the calendar shows "Transplant" — even though the
plant is radish.

### So is the label wrong?

**It's a faithful echo of the user's input, not a backend
mis-derivation.** The bug (if any) is upstream: the modal accepted
"Transplant" for radish without a guardrail or warning. The
backend's "did the user pick transplant?" → "store as transplant"
behavior is correct in isolation.

## Q3: Calendar grouping — does the user actually see 4 separate pills?

This is the missing half of the puzzle. The backend creates 4 events
faithfully — but the calendar **does** have grouping logic that
should collapse same-day same-plant same-bed events. Here's what
each calendar surface does:

### CalendarGrid (the default month/week view) — DOES group

`frontend/src/components/PlantingCalendar/CalendarGrid/utils.ts:137-167`
groups date-markers by composite key:

```typescript
const groupKey = `${dateKey}_${marker.type}_${marker.event.plantId}_${marker.event.variety || 'none'}_${marker.event.gardenBedId || 'none'}`;
```

When 4 events share **all five fields** (date, marker type, plantId,
variety, bedId), they collapse into **one** `GroupedDateMarker` with
`count: 4`, rendered as a single pill labeled `"Direct Seed Radish (4)"`
or `"Transplant Radish (4)"` (`EventMarker.tsx:194-196`):

```jsx
<span className="text-[10px] ml-1 font-semibold">({count})</span>
```

Clicking opens `GroupedEventsModal` which lists all underlying events.

So **on CalendarGrid, the user should see ONE pill, not four** — for
same-day, same-bed, same-plant, same-variety placements.

### ListView — DOES NOT group

`frontend/src/components/PlantingCalendar/ListView/index.tsx:329-480`
renders one card per event:

```typescript
events.map((event) => ...)   // line 335
```

No grouping logic. 4 PlantingEvents → 4 cards.

**This is the most likely surface where the user saw the 4 events.**
ListView is the alternate calendar view; switching to it strips the
grouping affordance that CalendarGrid provides.

### Practical outcome for the radish report

Three plausible explanations for the user's observation:

1. **User was on ListView** — sees 4 cards because that view has no
   grouping. Most likely cause if the user said "calendar workload looks
   inflated".
2. **User was on CalendarGrid but the events differ in `variety`** —
   each cell might have ended up with a different variety string, breaking
   the group key. Worth verifying with the actual request payload.
3. **User was on CalendarGrid but the bedId differs** — unlikely for one
   logical drop.

The CalendarGrid grouping path is already wired and works for
identical-key events. ListView doesn't honor it.

## Verdict

**By-design splits, three distinct UX defects:**

1. **The 4-event count itself is technically correct** (4 grid
   cells used). The fan-out happens at modal preview time, not in
   the backend write path. This is fundamental to the data model —
   per-cell PlantingEvents enable per-cell completion, conflicts,
   and indoor-start linking. Collapsing them at the data layer
   would lose information.

2. **ListView has no grouping** while CalendarGrid does — same
   underlying data, two different presentations. If the user saw 4
   separate "Transplant Radish" cards, they were almost certainly
   on ListView. CalendarGrid would have shown ONE pill labeled
   "Transplant Radish (4)". The grouping logic should be ported to
   ListView (or a deliberate call made that ListView is "the
   detailed view, no grouping by design"). Currently this is just
   inconsistent — a bug, not a design choice.

3. **`row_group_id` is the right primitive but isn't populated for
   default dense-planting drops.** Only row-mode flows through
   `PlantConfigModal.tsx` set it. A future improvement would
   auto-populate `row_group_id` for any multi-cell drop, then the
   calendar (both views) could collapse "this came from one logical
   placement" even when plant/variety/bed match coincidentally.

4. **"Transplant" label for radish** is a faithful echo of user
   input. For radish (`weeksIndoors=0`), the modal allowed
   "Transplant" without warning — a frontend UX issue, not a
   backend mis-derivation. Worth gating Transplant in the modal
   when `weeksIndoors=0`, with an override option.

Neither layer of the stack has a bug per the established rules in
the strict sense (every individual write is correct). The finding
is real because the **emergent UI behavior** is confusing — and the
fix lives entirely on the frontend:

- (a) Fix ListView grouping to match CalendarGrid, OR
- (b) Auto-populate `row_group_id` on multi-cell drops + use it
  alongside the existing group-key in both views, OR
- (c) Gate "Transplant" in PlantConfigModal for direct-seed crops
  (defensive UX), OR
- (d) Some combination of the above.

The just-shipped Layer 1 completion fix (commit `35cb6fe`) is
unaffected — that addressed `completed=True` for future dates;
this finding is about how many events get produced, not whether
they're correctly marked complete.
