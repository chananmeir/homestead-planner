# Phase B — Manual Smoke-Test Checklist

**Created**: 2026-04-22
**Scope**: Production-readiness audit, Phase B (user-journey validation)
**Approach**: Manual smoke first; automate stable flows later (user decision 2026-04-22).
**Time budget**: ≤15 minutes per probe. Run in order — later probes consume data created by earlier probes.
**Out of scope**: Fixing bugs while testing. Flag findings; do NOT code-fix during the pass.

---

## Pre-flight

- [ ] Backend running (`cd backend && python app.py`, port 5000)
- [ ] Frontend running (`cd frontend && npm start`, port 3000)
- [ ] Fresh/empty account available OR willingness to use an existing account (Probe 1 assumes fresh)
- [ ] Browser devtools open; watch Network + Console for 4xx/5xx and warnings
- [ ] NOTE: `SimulationToolbar` ("Time Machine") is a QA/testing tool and by design only renders when `NODE_ENV === 'development'`. Probe 5 requires running the frontend via `npm start` (which is the intended environment for this tool).

---

## Probe 1 — Onboarding → Property setup → Zone resolution

**Time**: ~10 min
**USER_JOURNEY reference**: January Week 2 (Property Refresh), Preface (year-round mindset requires accurate zone/frost data)

### Prerequisites
- Fresh or reusable account
- A known US ZIP code in zone 5b (e.g., 55404 Minneapolis) and one outside the known-ZIP table to exercise fallback
- An Alaska lat/long (e.g., 61.2, -149.9 Anchorage) and a South Florida lat/long (e.g., 25.8, -80.2 Miami) for edge-region coordinate fallback

### Steps
1. Register a new account → expect successful login and redirect to Dashboard.
2. Open **Property Designer**. Verify no property exists yet.
3. Create property: enter name, street address, city, state, **ZIP = known 5b ZIP** (e.g., 55404). Save.
   - Expect hardiness zone resolves (via `phzmapi.org` if online, OR deterministic known-ZIP fallback).
   - Expect first/last frost dates populate from zone lookup.
4. Edit property → change ZIP to a ZIP not in the known-ZIP table but with a real address → Save.
   - Expect graceful behavior: ZIP API used if reachable; otherwise coordinate-based regional fallback.
5. Edit property → clear ZIP, enter Alaska lat/long manually (if the form allows) → expect Alaska-appropriate zone (1a–6a depending on coords).
6. Edit property → enter South Florida lat/long → expect zone 10a–11a range.
7. Dashboard → confirm no stale "zone unknown" banners and that any frost-date display matches resolved zone.

### Red flags
- ZIP changes but frost dates do not refresh (property explicit > zone lookup > default priority is documented in `GET /api/frost-dates`).
- Network errors from `phzmapi.org` cause hard failure instead of fallback (resilience was the Phase 1 fix — regressions here are high-signal).
- South Florida returns a 5b default (known-ZIP table bias).
- Alaska returns non-Alaska zone (coordinate fallback failure).
- Non-US ZIPs do not degrade gracefully.

### Deviation noted
_(fill if observed)_

### Scratch




---

## Probe 2 — Jan Week 4 full planner wizard → export to calendar → re-export idempotency

**Time**: ~15 min
**USER_JOURNEY reference**: January Week 4 ("The Big Plan"), "How succession planting actually lives in the app"

### Prerequisites
- Probe 1 complete (property with valid zone/frost dates)
- At least one garden bed created (use Garden Designer → Create Bed if none exist)
- Seed inventory with ≥5 items including at least one succession-capable crop (radish, lettuce, bush beans) and one main-season crop (tomato). If empty, add via **Seeds Hub → My Inventory → Add Seed** or CSV import.
- Record the current plan count (Garden Planner landing page) before starting

### Steps
1. **Garden Planner** → click **Create Plan** (button label confirmed). Name: `Smoke Probe 2 — <date>`. Save.
2. Plan opens in wizard **Step 1 — Select Seeds**.
   - Select 3–5 seeds. Include at least one crop with succession (radish) and one without (tomato).
   - Set manual quantity on at least one seed (e.g., radish = 120, 8 successions).
   - Click **Next** to proceed.
   - **DEVIATION TO WATCH**: USER_JOURNEY Week 4 describes "Step 2 — Configure Strategy" (per-crop succession intervals). Per `CLAUDE.md` (2026-01-24 entry) and `GardenPlanner.tsx:42` comment, Step 2 was removed — the wizard now hardcodes `strategy='balanced'` and `succession_preference='moderate'`. If the UI still exposes a strategy step, note it; if it does not, note "Deviation noted: USER_JOURNEY Week 4 Step 2 no longer present — wizard uses hardcoded defaults."
3. **Allocation step** — assign seeds to beds. If a succession crop is selected, confirm bed allocation UI accepts it. Verify allocated sum matches total quantity (per-seed checkmark appears when fully allocated).
4. **Review step** — confirm projected totals appear (plant count, conflicts = 0, rotation warnings listed or empty).
5. Save plan → expect success toast, return to plan list.
6. Open saved plan → click **Export to Calendar** (button label confirmed).
   - Expect conflict-check call first. If conflicts found, ConflictWarning modal appears.
   - On clean export: `PlantingEvents` created for each seed/succession. Confirm by opening **Planting Calendar** → list view → events appear on expected dates.
7. **Re-export idempotency**: return to Garden Planner → same plan → click the button again.
   - Button label should now read **Re-Export to Calendar** (`allExported` flag).
   - Click it. Expect no duplicate events in the calendar (`export_key` prevents duplicates; see `backend/services/garden_planner_service.py::export_to_calendar` + `PlantingEvent.export_key`).
   - Count events in calendar for this plan before and after: MUST match.
8. Change one quantity in the plan, save, re-export → expect the matching `PlantingEvent` to be updated in place (matched by `export_key`), NOT duplicated.

### Red flags
- Re-export creates duplicate PlantingEvents (export_key collision or bypass).
- Export crashes or returns 500 on crops with no `daysToMaturity` (DTM resolution chain should handle null).
- Succession series stored without shared `succession_group_id`.
- Manual quantity overrides silently replaced with auto-calc.
- Conflict-preview runs but conflict-override path is not wired through.
- First-plant-date sometimes a string, sometimes a `datetime.date` — `strptime` guards on all four parse paths (bed-allocated, legacy, trellis, preview) were fixed Feb 2026; regressions would show here.

### Deviation noted
_(fill if observed — Step 2 removal is the most likely one)_

### Scratch




---

## Probe 3 — Feb–Apr indoor starts → transplant to designer → row planner

**Time**: ~15 min
**USER_JOURNEY reference**: February Week 6 ("First Indoor Starts"), March Week 10–11, April Week 13 (MIGardener Row Planner)

### Prerequisites
- Probe 2 plan exported (Planting Events exist)
- At least one garden bed with `planning_method='migardener'` for the Row Planner portion (create one via Garden Designer if needed)
- At least one seed in the plan that has an indoor-start lead time (tomato is ideal)

### Steps
1. Open **Indoor Seed Starts**. If empty or stale, click the equivalent of **Import from Garden Plan** (see `IndoorSeedStarts.tsx:653` — "Import from Garden Plan Modal"). Select the Probe 2 plan.
2. Verify starts are generated for indoor-start-eligible crops (tomato, pepper, etc.). Each row shows: variety, sow-by date, expected transplant date, "Transplant in: N days" countdown.
3. Pick one indoor start → click **Transplant Now** (button label confirmed at `IndoorSeedStarts.tsx:548`).
4. Navigate to the assigned bed in **Garden Designer** via the bed-name link on the start row (`onNavigateToBed` call, label "Open <bed> in Garden Designer").
5. In Garden Designer, place the transplanted plants on the grid by drag-and-drop from the **Plant Palette**.
   - Placed cells become `PlantedItem` rows with `source_plan_item_id` linked to the plan.
6. Open the sidebar (**Planned Plants Section**) — confirm progress counter `X / Y` reflects the placement. USER_JOURNEY and CLAUDE.md both specify this is **date-aware**: sidebar count is plants expected in-ground on the view date, not full-season totals.
7. Change the view date (if the bed view supports it) and confirm the denominator recalculates.
8. Switch to a **MIGardener row bed**. Open **Row Planner** / **MIGardenerRowPlanner**. Pick a row → expect **Row Schedule Modal** to open with succession schedule.
9. Confirm a row can be assigned to a crop with N successions at D-day intervals; confirm start/harvest windows render.

### Red flags
- Progress counter treats all placed plants the same regardless of `source_plan_item_id` — CLAUDE.md explicitly warns "Progress sidebar must be computed per plan item id, not by plantId::variety, because multiple plan rows can share the same plant/variety."
- Date-aware denominator falls back to full-season total when `firstPlantDate` is missing without making that clear to the user.
- PlantedItem created without `source_plan_item_id` — means future sidebar progress updates will ignore it (silent bug).
- Row Planner succession strip does not persist after refresh.
- Transplanting an indoor start does not mark the Indoor Seed Start as `transplanted` with an actual date.

### Deviation noted
_(fill if observed)_

### Scratch




---

## Probe 4 — Aug seed-saving flow (Set Seed Date → Collect Seeds → MySeedInventory)

**Time**: ~12 min
**USER_JOURNEY reference**: August Week 32, September Week 35 ("Collecting Saved Seeds")

### Prerequisites
- At least one PlantedItem on the grid from Probe 3 (or place one directly) — ideally a tomato or bean, something that has `daysToSeed` defined in the plant DB
- The PlantedItem should be in `growing` (or later) status — if still `planned`, advance it via the grid UI (mark planted / seeded)

### Steps
1. Open **Garden Designer** → bed with the PlantedItem → click the plant cell.
2. In the plant actions menu, choose **Set Seed Date** (opens `SetSeedDateModal.tsx`).
   - Expect the default date to be auto-computed: `base_date + daysToSeed` where `base_date` priority is `harvestDate → transplantDate + DTM → plantedDate + DTM`. If the plant has no `daysToSeed`, expect fallback of `now + 60 days` (`SetSeedDateModal.tsx:47-50`).
3. Accept or adjust the date → Save.
   - Expected effects: `save_for_seed=True`, `seed_maturity_date` set, PlantedItem status transitions to `saving-seed`, linked `PlantingEvent.expected_harvest_date` extends to `seed_maturity_date`.
4. Verify status change:
   - Sidebar or cell badge should reflect "saving-seed" status.
   - CLAUDE.md specifies lifecycle: `growing → saving-seed` (toggle ON), with restoration rules on toggle OFF.
5. Advance time to the seed maturity date (use **Time Machine** toolbar if available, OR choose a PlantedItem whose computed seed date is already passed).
6. Dashboard → **Needs Attention** → expect a "Seeds Ready" signal for this plant.
7. Click the signal OR open the plant again → choose **Collect Seeds** (opens `CollectSeedsModal.tsx`).
   - Fill: packets=2, seeds/packet=30, germination rate=85, variety (defaults to planted variety or "Homegrown"), notes.
   - Submit.
   - Expected: POST `/api/planted-items/:id/collect-seeds`, PlantedItem status → `harvested`, new `SeedInventoryItem` created with `is_homegrown=True`.
8. Open **Seeds Hub → My Inventory**. Find the new entry.
   - **DEVIATION CHECK (likely finding)**: USER_JOURNEY Week 3 and Week 35 both describe "Homegrown badges" on saved seeds. Grep confirms `MySeedInventory.tsx` has no `Homegrown`/`isHomegrown`/`is_homegrown` rendering — only `CollectSeedsModal` and the backend use the flag. If no badge appears next to the homegrown seed, flag this as: **"Deviation noted: MySeedInventory.tsx does not render the Homegrown badge that USER_JOURNEY Week 3 and Week 35 describe. Backend `SeedInventoryItem.is_homegrown` is written by CollectSeedsModal but the inventory UI ignores it."** Do NOT attempt to fix.
9. Toggle the seed-saving flag OFF on a different (non-collected) PlantedItem to confirm status restoration: `saving-seed` → `harvested | transplanted | growing | planned` per lifecycle fallback.

### Red flags
- Set Seed Date default falls back to `now + 60` for plants that clearly have `daysToSeed` (chain resolution bug).
- PlantingEvent.expected_harvest_date not extended on toggle ON (in-ground time incorrectly short).
- Toggle OFF does not restore expected_harvest_date to `in_ground_date + daysToMaturity`.
- Collect Seeds creates SeedInventoryItem but does not set `is_homegrown=True`.
- Status does not transition to `harvested` on seed collection (CLAUDE.md High Risk area).
- CLAUDE.md warns: "PlantingEvent has NO `status` column and NO `planted_date` column. Do not attempt to set these." Verify no 500s when the flow writes back.

### Deviation noted
_(fill — Homegrown badge in MySeedInventory is the leading candidate)_

### Scratch




---

## Probe 5 — Nov–Dec date-aware views + year boundary

**Time**: ~12 min
**USER_JOURNEY reference**: November Week 41–43 (winter harvest-only mode), December Week 47–48 (year review, plan clone)

### Prerequisites
- Probe 2 plan still present with exported calendar events
- At least one PlantedItem on the grid from Probe 3 (for Snapshot to have data)
- Running frontend via `npm start` (Time Machine is a QA/testing tool and only renders in dev mode by design — see Pre-flight)
- Some harvest records logged in Harvest Tracker (add a quick one if none exist)

### Steps
1. Bottom-right of the app: find the **Time Machine** toolbar. Click to expand.
2. Quick-jump to **Dec 1** via the preset, OR enter a date manually (e.g., `2027-12-01`) and click **Set**.
   - Status banner should read `SIMULATING: 2027-12-01`.
3. Open **Dashboard** → verify dashboard "changes character" per USER_JOURNEY: winter-relevant signals only (weekly tunnel harvest reminder if implemented; see red flags), no summer planting alerts.
4. Open **Garden Planner → Garden Snapshot** (button label confirmed at `GardenPlanner.tsx:1799`).
   - Pick a snapshot date (e.g., the simulated Dec 1, or browse to another date via the date picker at `GardenSnapshot.tsx:66`).
   - Expect to see plants whose `planted_date ≤ date AND (harvest_date IS NULL OR harvest_date ≥ date)` grouped by `plant_id::variety`.
   - If cold-frame / high-tunnel crops exist, expect them to show.
5. Open **Nutrition Dashboard** (or equivalent rollup view). Select current plan year.
   - Confirm cumulative calories/protein/weight reflect the logged harvests.
   - Click CSV export → verify file downloads and opens cleanly.
6. **Year boundary test**: advance simulated date to `2027-12-31`, then to `2028-01-01`.
   - Open Dashboard → confirm year-dependent counters (nutrition totals, "this year harvest weight") correctly pivot on Jan 1.
   - Open Planting Calendar → confirm year navigation works and events for both 2027 and 2028 are reachable.
7. **Plan clone**: Garden Planner → select Probe 2 plan → use Clone action (USER_JOURNEY Week 48 describes this).
   - Name new plan `Smoke Probe 5 Clone`. Clone.
   - Expect: new plan opens with copied seed selections, quantities, bed allocations; NEW `export_key` behavior (re-export should be safe, no cross-plan collision).
8. Clear simulation (Time Machine → clear) before closing.

### Red flags
- **`SimulationToolbar` is a QA/testing tool, by design dev-only** (`process.env.NODE_ENV !== 'development'` early return). If you accidentally launched a production build you will have no Time Machine access and Probe 5 cannot run — switch to `npm start` and resume. Production-build testing of the year-boundary flow via simulation is out of scope for manual smoke: the toolbar is not intended to run there.
- Nutrition totals for 2028 include 2027 data (year filter bug — CLAUDE.md flags date-aware logic as high-risk).
- Garden Snapshot query uses naive `datetime.fromisoformat` on the date param → `'Z'`-suffix regression (`parse_iso_date` sweep is Phase A.2; this probe could catch it).
- Plan clone duplicates `export_key` values from the source plan → re-exporting the clone would collide with the source plan's events. export_key must be regenerated per clone.
- USER_JOURNEY Preface mentions a "winter tunnel info card" ("Weekly tunnel harvest logged recently? Current stocks: kale, mache, spinach…"). Grep suggests this is a **narrative aspiration**, not an implemented card — part of the R9 narrative gap retained in USER_JOURNEY per 2026-04-22 decision. If it is absent, note "Deviation noted: USER_JOURNEY winter tunnel info card not implemented (R9 gap, deferred)." Do NOT fix.
- Dashboard deep-links for **Harvest Ready** signals: CLAUDE.md memory note says HarvestTracker registers refs by `HarvestRecord.id` but dashboard sends `PlantingEvent.id` — highlight won't match for already-logged harvests. Flag if you click a harvest-related signal and the target row does not visibly highlight.

### Deviation noted
_(fill — weekly tunnel info card and HarvestTracker deep-link id mismatch are the leading candidates)_

### Scratch




---

## After the five probes

- [ ] Collect all "Deviation noted" items into a summary (to feed Phase C planning)
- [ ] Confirm backend logs show no unhandled 500s
- [ ] Confirm no new browser console errors beyond pre-existing ones
- [ ] Leave test data in place (do NOT clean up — useful for later automation baseline)
- [ ] Do NOT commit any fixes discovered during the pass; file them as findings

## Known blockers

- Git safe-directory still unresolved → no `git diff`/`git status` write-side review during this phase
- `frontend/src/components/GardenDesigner.tsx` is out of scope for Phase A per user constraint; if a probe reveals a regression inside it, note only — do not edit
