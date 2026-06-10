# Bed-View Harvest Workflow — Finding

**Date**: 2026-05-04
**Question**: From the Garden Designer (Design → Garden Designer → "View Bed"), how does a user harvest a crop?
**Short answer**: They can't — not from inside the bed view. There is no "Log Harvest" / "Mark Harvested" / "Record Harvest" button in the bed-view detail panel. Harvest logging lives in a separate top-nav tab (Harvests / Harvest Tracker), and even when used it does not auto-update the plant in the bed.

---

## What the bed-view plant detail panel offers today

When the user clicks a placed plant inside a bed, the detail panel opens (`frontend/src/components/GardenDesigner.tsx:3464-3790`). The available actions are:

| Action | Location | What it does |
|---|---|---|
| Save for Seed toggle | `:3580-3590` | Marks `PlantedItem.saveForSeed = true`, status → `saving-seed` |
| Set seed maturity date | `:3604-3609` | Opens `SetSeedDateModal` |
| **Collect Seeds** | `:3614-3620` | Opens `CollectSeedsModal` → `POST /api/planted-items/{id}/collect-seeds`. Sets status → `harvested`, `seeds_collected = true`, creates a `SeedInventoryItem`. **This is the only in-bed action that produces `status='harvested'`.** |
| Move | `:3727-3735` | Reposition the plant on the grid |
| Delete | `:3737-3743` | Removes the `PlantedItem` outright |
| Remove All [Plant] / [Variety Plant] | `:3760-3784` | Bulk-delete same-type/variety items in this bed |

**Everything else in the panel is read-only display**: status badge, planted date, transplant date, harvest date (actual or estimated), days-to-harvest countdown, days-to-maturity, future plantings list (`:3514-3669`).

There is no harvest-recording UI. Confirmed by full-text search of `GardenDesigner.tsx` and the entire `GardenDesigner/` subdirectory for `Log/Mark/Record Harvest` and `onHarvest` — no matches outside display-only formatting and the bed-delete confirmation message.

---

## Where harvest logging actually lives

**Primary**: `Harvests` tab in main top nav → `frontend/src/components/HarvestTracker.tsx:328` "Log Harvest" button → opens `LogHarvestModal` (`frontend/src/components/HarvestTracker/LogHarvestModal.tsx`).

**Secondary**: Dashboard → Quick Actions → "Log Harvest" tile (`frontend/src/components/Dashboard/QuickActions.tsx:28`). This just routes to the same Harvests tab via `nav.openHarvests` (`frontend/src/components/Dashboard/index.tsx:50`); it does not pre-fill anything.

**Tertiary**: Dashboard Needs-Attention "harvest ready" rows (`frontend/src/components/Dashboard/NeedsAttentionPanel.tsx:889`) deep-link to either `kind: 'harvest'` (Harvest Tracker) or `kind: 'harvestBed'` (Garden Designer bed view) — but the bed view itself still has no harvest action, so `harvestBed` ends up at the same dead end the user is asking about.

### `LogHarvestModal` form fields (`LogHarvestModal.tsx:23-30`)

- **Plant** (dropdown of every plant in DB — required)
- **Harvest Date** (defaults to today)
- **Quantity** (numeric, min 0.1)
- **Unit** (lbs / oz / count / bunches)
- **Quality** (excellent / good / fair / poor)
- **Notes** (optional)

Backend endpoint: `POST /api/harvests` (`backend/blueprints/harvests_bp.py:23-67`).

---

## The hidden gap: harvest doesn't update the bed

`LogHarvestModal` payload (`LogHarvestModal.tsx:84-91`) sends:

```json
{ "plantId", "harvestDate", "quantity", "unit", "quality", "notes" }
```

**It does not send `plantedItemId`** — even though the backend supports it.

The backend's auto-sync block (`harvests_bp.py:38-65`) is gated on exactly that field:

```python
if record.planted_item_id:           # never true from LogHarvestModal
    planted_item.status = 'harvested'
    planted_item.harvest_date = record.harvest_date
    # ...also flips linked PlantingEvent.completed and IndoorSeedStart.status
```

**Consequence**: a user who clicks a tomato in the bed, walks to the Harvests tab, logs a harvest, and walks back will see the same tomato still sitting there with status `growing`. The harvest exists as a `HarvestRecord` (counts in stats, shows in Harvest Tracker list), but it is not bound to that specific placement.

The plant only disappears from the bed grid when one of these happens (`GardenDesigner.tsx:678-708`):

1. Its `harvestDate` is set AND is < the view's date filter (i.e. bed-grid date filter advances past it).
2. Its `status === 'harvested'` AND `harvestDate` is set.
3. The user manually deletes it.
4. Save for Seed → Collect Seeds runs (only path that *is* wired to set `status='harvested'` from the bed view).

So in the current build, the cleanest "harvest this exact plant" operation from the bed view is actually **delete it**. That's not great, and the user's question is essentially exposing that.

---

## What the user can do today (workaround paths)

### Path 1 — Log + manually clear (most common, leaves the bed view stale until cleanup)
1. From bed view, note the plant + variety + date.
2. Top nav → Harvests → Log Harvest, fill modal, submit.
3. Return to bed view. Plant is still shown.
4. Click plant → Delete (or wait for the bed's date filter to move past the harvest date).

### Path 2 — Save for Seed → Collect Seeds (only "in-bed" harvest-style action)
1. In bed view, click plant → toggle Save for Seed.
2. Set seed maturity date if not auto-calculated.
3. When ready, click "Collect Seeds" → fills `CollectSeedsModal`.
4. PlantedItem flips to `status='harvested'`, seeds saved to inventory.
   This is *not* a food harvest — it's specifically the seed-saving lifecycle, but it is the only in-bed button that produces `harvested` status.

### Path 3 — Just delete the plant
Click plant → Delete. No harvest record is produced; only the placement is removed. Useful only if the user logs the harvest separately or doesn't care about tracking yields.

---

## Recommended fixes (out of scope for this finding, listed for backlog)

1. **Add a "Log Harvest" button to the bed-view detail panel** that opens `LogHarvestModal` pre-populated with `plantId`, `variety`, and the planted item id.
2. **Make `LogHarvestModal` accept a `plantedItem` prop** (optional) and include `plantedItemId` in the POST body when present. This single change unlocks the existing backend auto-sync that already updates `PlantedItem.status`, `PlantedItem.harvest_date`, the linked `PlantingEvent.completed`, and the linked `IndoorSeedStart.status`.
3. Optional: when modal is opened from the bed view, default Quality to "good" and lock the plant dropdown to avoid mismatch.

Each of these is small (one file each) but they're the missing piece for the user's mental model: "I'm in the bed, I want to harvest the thing I'm looking at, I want it to disappear from the bed and show up in my stats." Today the app does the second and third only by coincidence.

---

## Files referenced

- `frontend/src/components/GardenDesigner.tsx:3464-3790` — bed-view plant detail panel
- `frontend/src/components/GardenDesigner/CollectSeedsModal.tsx` — seed-saving harvest path
- `frontend/src/components/HarvestTracker.tsx:328` — "Log Harvest" button (top-nav page)
- `frontend/src/components/HarvestTracker/LogHarvestModal.tsx:84-91` — POST payload (missing `plantedItemId`)
- `frontend/src/components/Dashboard/QuickActions.tsx:28` — Dashboard "Log Harvest" tile
- `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx:868-895` — harvest deep-link rows
- `backend/blueprints/harvests_bp.py:23-67` — `POST /api/harvests` + conditional auto-sync
- `backend/blueprints/harvests_bp.py:39-65` — the `if record.planted_item_id:` gate the modal never trips
