# Row Plantings Not Displaying Correctly — Investigation & Root Cause

**Date:** 2026-06-04
**Author:** PM (on behalf of marcsiegel)
**Status:** Decisions locked — data fixed; code fix ready for development
**Trigger:** Pepper (Pimento Sweet) placed as a "row" of 5 in Garden Bed Five stored as cell A7 qty=3 + C7 qty=2, rendered as a single icon in A7 instead of spread across A7/B7/C7. User reports rows display wrong "across the program."

---

## Expected vs actual

- **Expected:** A row of N plants in a square-foot bed = **1 plant per consecutive cell** (3 peppers → A7, B7, C7).
- **Actual:** Plants get **stacked as `quantity>1` into one or two cells** (5 → A7 qty3 + C7 qty2, skipping B7), and the grid draws **one icon per occupied cell** for wide-spacing plants, so the row visually collapses to a single square.

---

## Root cause (two compounding defects)

### Defect 1 — Placement stacks quantity into cells instead of 1-per-cell
`frontend/src/components/GardenDesigner.tsx:1914-1954` — when `config.previewPositions.length > 1`, the handler distributes `totalQuantity` across the preview cells with integer **remainder distribution**:
```
perCellQty = floor(thisRowTotal / rowPositions.length)
cellRemainder = thisRowTotal - perCellQty * rowPositions.length
// first cells get +1 each
```
With 5 plants and only 2 preview cells (A7, C7) → perCell=2, remainder=1 → **A7=3, C7=2**. This is the exact source of the stacked quantities. The backend (`blueprints/gardens_bp.py:1511-1540` batch endpoint) simply persists whatever positions/quantities the frontend sends — it has no independent layout logic. Confirmed by backend explore.

### Defect 2 — Preview offered only 2 cells (skipped B7) due to spacing stride
The preview-position generator in `PlantConfigModal.tsx` derives cell count from **plant spacing**, not 1-per-grid-cell. Pepper spacing = 18" in a 12" grid → it selects ~every-other cell (A7, C7) rather than every consecutive cell. So even before quantity stacking, the row is sparse/misaligned with the user's per-cell mental model. (`PlantConfigModal.tsx` ~lines 379-426, 968-1014 compute `plantsPerSquare`/preview from `bedLengthInches / spacing`.)

### Why it then renders as ONE icon (the visible symptom)
`GardenDesigner.tsx:2518-2666` — the renderer draws plant icons only at each PlantedItem's single `position`. It only sub-divides a cell into multiple icons when `isDensePlanting` is true, i.e. `plant.spacing <= gridSizeThreshold` (`PlantConfigModal.tsx:38-48`). Pepper spacing 18" > 12" → **not dense** → exactly **one icon centered in the cell**, regardless of `quantity=3`. So 3 (or 5) peppers in one cell look like a single pepper.

### Data-model context
- `PlantedItem` (`models.py:100-153`) has `position_x, position_y, quantity` and **no** `row_group_id`. A multi-cell row is *meant* to be represented as **multiple PlantedItem records, 1 per cell** — and the side panel grouping already assumes this (`GardenDesigner.tsx:3439-3465` shows "A7, B7, C7" only when there are 3 separate records).
- `PlantingEvent` (the schedule layer) *does* have `row_group_id`, `row_segment_index`, `total_row_segments`, `planting_style` — so the schedule layer models rows, but the placement layer (PlantedItem) flattens them into quantity-bearing cells.

**Net:** The bug is the mismatch — placement writes `quantity>1` per cell, but both the renderer and the side panel are built around 1 record per cell. Wide-spacing plants are where it's visible (dense plants accidentally "work" because the renderer sub-divides the cell).

---

## Scope across the program (why it's not just peppers)
- Any **wide-spacing plant** (spacing > grid size: peppers, tomatoes, broccoli, squash, etc.) placed with `quantity>1` in a cell renders as a single icon → rows collapse.
- The **side panel** count vs. positions disagree (sums quantity, lists only occupied cells).
- The **stride/skip** from spacing-based preview means rows skip cells inconsistently depending on plant spacing vs grid size.
- Dense plants (lettuce, radish, carrots; spacing <= grid) hide the bug because sub-cell icon rendering exists for them.

---

## Recommended fix direction (for decision)
**Option A — Placement writes 1 PlantedItem per cell (recommended).** For non-dense plantings, lay plants into consecutive cells, `quantity=1` each, instead of stacking. Aligns with renderer + side panel which already expect 1-record-per-cell. Localized change in the placement handler (`GardenDesigner.tsx:1914-1954`) + the preview generator so it offers consecutive cells for the requested count.

**Option B — Renderer spreads a `quantity>1` item across footprint cells.** Keep stacked storage but make the grid + panel expand a quantity into multiple visual cells. More rendering complexity; conflicts with existing per-record grouping; risk of touching many views.

**Option C — Hybrid / honor agronomic spacing.** Respect plant spacing (peppers every 18" ≈ skip cells) but still 1-per-cell. More "correct" agronomically but contradicts the user's simple per-square expectation and complicates SFG (where peppers are 1 per square by convention).

**PM lean:** Option A, with SFG treating wide-spacing plants as **1 per consecutive cell** (no stride). It matches the user's expectation, the data model's intent, and the existing side-panel/grouping code with the least cross-cutting rendering risk.

---

## Open decisions needed from user
1. Confirm the desired rule: in a square-foot bed, a row = **1 plant per consecutive cell** (no skipped cells), correct?
2. What happens when the count exceeds one row's width (bed is 4 cells wide; 5 plants)? Wrap to the next row, or extend/stop? 
3. Fix the existing pepper data now (re-lay A7/B7/C7 × 1), and/or fix the placement behavior program-wide?

## Decisions (locked 2026-06-04)
1. **Layout rule:** *Respect real spacing.* A row places **1 plant per cell** (never `quantity>1` stacked), stepping across cells at the plant's real spacing (e.g. pepper 18" in a 12" grid ≈ every-other cell). Eliminates the remainder-stacking in `GardenDesigner.tsx:1940-1945`.
2. **Overflow:** *Stop at bed edge.* Place only what fits in the row at proper spacing; **warn** the user that the remainder didn't fit. Do NOT stack overflow into existing cells or silently drop it (must `log`/surface the dropped count).
3. **Action taken:** Existing pepper data corrected now (see below); program-wide code fix specced here.

### ⚠️ Known tension to resolve in implementation
"Respect real spacing" (18") on a 12" grid does NOT snap cleanly to consecutive cells — peppers want a gap, conflicting with the user's original A7/B7/C7 mental image. For the **immediate data fix** we used 1-per-consecutive-cell (A7,B7,C7) for visibility; the **code fix** must decide cell snapping for spacing > grid (round vs floor, even distribution across available row width). Flag to user if the spacing-based result looks sparse. For pure SFG, convention is often 1 plant per square regardless of stated spacing — confirm whether SFG should override real spacing.

### Data fix applied (user 59, Bed 41, 2026-06-04)
- Backed up DB → `backend/instance/homestead.db.bak-pepperfix-20260604`.
- Re-laid Pepper (Pimento Sweet) from stacked A7 qty3 → **3 separate 1-qty records**: `id 1927` A7, `id 1929` B7 (new), `id 1928` C7 (reactivated, moved to x2, qty→1). Total active = 3.
- IndoorSeedStart #131 `remainingToPlant` re-verified = 12 (15 germinated − 3 placed). Unchanged.

## Implementation — 2026-06-04 (code fix shipped)
- New pure helper `distributePlantsAcrossCells(cells, totalQuantity, cellCapacity)` in `frontend/src/components/GardenDesigner/utils/designerHelpers.ts`: fills each preview cell up to `cellCapacity` (= method-aware `plantsPerSquare`) before advancing; returns `{positions, notFitted}`. Never stacks beyond a cell's capacity.
- Wired into the primary multi-cell placement path `GardenDesigner.tsx:1915-1941` (the `previewPositions.length > 1` branch — the exact path the pepper hit). Replaced the old row-grouping remainder distribution that produced A7 qty3 + C7 qty2.
- Overflow handling ("stop at bed edge"): when `notFitted > 0`, a `showWarning` toast tells the user how many didn't fit (`GardenDesigner.tsx:1979-1981`).
- Method-safety: `plantsPerSquare` (computed at ~1853-1874) is method-aware — 1 for wide-spacing square-foot crops (peppers), higher for dense/MIGardener crops — so the cap auto-adjusts per method and does NOT break dense/row-segment fills.
- **Deliberately NOT changed:** the secondary `else`-branch preview path (`GardenDesigner.tsx:~2065`, only reached when `previewPositions.length === 1`) carries an explicit row-segment-semantics warning; left as-is to avoid regressing MIGardener/row-segment placements. Logged as follow-up.
- **Still unresolved (modal-side):** preview cell *selection* / snapping for spacing > grid (why peppers got A7,C7 with B7 skipped) lives in `PlantConfigModal.tsx` and was not touched. The distribution fix stops the stacking + invisible-plant symptom regardless, but tidy consecutive-cell layout for wide crops needs a modal-preview follow-up.

## Completion — 2026-06-10 (remaining halves shipped; bug closed)

The 2026-06-04 pass fixed the *distribution* half (capacity capping). This pass fixed the
*cell-selection* half and the two residual stacking paths:

1. **SFG-aware placement stride** (`GardenDesigner/utils/autoPlacement.ts`) — resolves the
   "known tension" above in favor of the SFG convention: in **square-foot beds** the SFG
   lookup table (already authoritative for space_calculator) drives the stride. A plant
   rated ≥1/sq (pepper, tomato) occupies exactly one cell → `requiredDistance = 1` →
   **consecutive cells (A7,B7,C7 — the user's original expectation)**. Fractional ratings
   (melon 0.5/sq) get `ceil(1/perCell)` cells of separation. **Non-SFG methods keep the
   real-spacing stride** per locked decision #1 (pepper on a 12" row-method grid still steps
   every other cell). The same stride now also governs proximity checks against *existing*
   plants, so adding more peppers beside a placed row works.
2. **Path B carve-out removed** (`GardenDesigner.tsx` ~1998) — multi-square placements on
   row/raised-bed/container/custom-method beds previously took the single-PlantedItem branch
   and stacked the whole quantity into one cell. Now only `squaresNeeded === 1` takes the
   single-item path; everything else goes through the spread/batch path (capacity-capped).
3. **Single-preview-position path capacity-capped** (`GardenDesigner.tsx` ~2062, the
   "deliberately NOT changed" branch above) — replaced the `ceil(quantity/positions)`
   distribution with `distributePlantsAcrossCells` + a didn't-fit warning, identical to the
   primary path. The old comment's rationale (a position = a whole row) no longer holds:
   preview positions have been per-cell since the modal's row-mode bypass shipped.
4. **Modal preview messages corrected** (`PlantConfigModal.tsx` ~1245) — the row-mode
   warning/success math used `ceil(quantity/cells)` (the stacking model) and could promise
   "~3 plants per cell" for peppers. Now mirrors the placement cap: wide-spacing = 1/cell,
   dense = `floor((grid/spacing)²)`/cell, and warns with exact didn't-fit counts.

**Renderer note:** no renderer change needed — `GardenDesigner.tsx` already badges
`item.quantity` on non-dense items, so any legacy stacked records remain visible until
re-placed; new placements can no longer create them.

**Tests:** new `__tests__/autoPlacement.test.ts` (6 tests: SFG-consecutive pepper repro,
row-method stride preserved, melon 0.5/sq separation, adjacent-to-existing allowed, dense
unaffected, edge-stop with shortfall reporting + no-duplicate-cells invariant). Existing
`designerHelpers.test.ts` (16, incl. the original pepper reproduction) still green.
Full frontend suite 304/304 (33 suites), tsc clean, production build compiles. No backend
changes (batch endpoint persists as-sent, unchanged by design).

### Verification
- `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern=designerHelpers` → 16 passed (6 new, incl. pepper-bug reproduction).
- `cd frontend && npx tsc --noEmit` → exit 0 (clean).
- `cd frontend && CI=true npm run build` → **Compiled successfully.** (Pre-existing ESLint warnings in BulkHarvestModal/PlannedPlantsSection/GardenPlanner/LogHarvestModal were also cleared — see below — so the CI build now passes.)

### Pre-existing lint debt cleared (2026-06-04, separate from the row fix)
- `BulkHarvestModal.tsx`: removed unused `Plant` import.
- `PlannedPlantsSection.tsx:726`, `GardenPlanner.tsx:996` (effects) + `GardenPlanner.tsx:1715/1789` (memos) + `LogHarvestModal.tsx:58` (effect): added `// eslint-disable-next-line react-hooks/exhaustive-deps` with reasons. These exclude `now`/`today`, whose Date/string identity changes every render — adding them as deps would cause refetch/reset loops. Matches the repo's existing convention (36 prior uses). Comment-only/import-only — zero behavior change.

## Files implicated
- `frontend/src/components/GardenDesigner.tsx` — placement handler `1914-1954`; grid renderer `2518-2666`; side-panel grouping `3439-3465`.
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` — preview/`plantsPerSquare` generation `~379-426`, `968-1014`; dense-planting threshold `38-48`.
- `backend/blueprints/gardens_bp.py` — batch placement persister `1395-1540` (no layout logic; persists as-sent).
- `backend/models.py` — `PlantedItem` `100-153` (no row_group_id); `PlantingEvent` row fields.
