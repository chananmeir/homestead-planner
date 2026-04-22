# Data Alignment Proposal (2026-04-22)

Research output for Tier 2 of the production-readiness audit, per
`dev/active/production-readiness-audit/next-developer-instructions.md`.
**No code modified — proposals only.**

This document covers 21 drift cases identified by the cross-stack parity test
harness (`backend/tests/test_cross_stack_parity.py`), grouped as:

- **Group A** — SFG `bean` / `bean-1` lookup (1 plant, 1 decision)
- **Group B** — Plant database field drift (18 plants, ~26 field-level decisions)
- **Group E** — `shallot-from-seed` / `shallot-from-sets` missing from backend SFG

Field-level drift was extracted by running a targeted diff against the frontend
parity snapshot (`backend/tests/fixtures/frontend_parity_snapshot.json`) and
the backend `PLANT_DATABASE`. The diff showed **no drift in any
`migardener.*` sub-block field** for the 18 Group B plants — only top-level
`spacing`, `rowSpacing`, `daysToMaturity`, and `category` drift.

---

## Group A — SFG `bean` / `bean-1`

### What the parity test actually shows

- **Frontend** (`frontend/src/utils/sfgSpacing.ts`): explicit entries
  `'bean': 9`, `'bean-1': 9` (9 plants per square foot — medium plants / 4" spacing bucket).
- **Backend** (`backend/garden_methods.py` → `SFG_SPACING`): no `bean` entry
  at any bucket. The resolver `backend/sfg_spacing.py::get_sfg_cells_required`
  strips the `-1` suffix to get `'bean'`, fails the exact-match pass, then in
  the prefix pass matches `'bean-pole'` (8 per square — the 8-per-square bucket
  lists `['pea', 'bean-pole']`) and returns `1/8 = 0.125` cells per plant.
- Net effect: frontend treats generic `bean-1` as **bush bean = 9/cell**;
  backend silently treats it as **pole bean = 8/cell**.

### What `bean-1` actually represents

Both databases describe `bean-1` as **Bean** (`Phaseolus vulgaris`), with:

- `spacing = 4`, `rowSpacing = 21` (bush-bean profile — pole beans would be
  ~30-36" rows)
- Backend MIGardener override keys `bean-1` → `(18, 5.5)` **with the comment
  "Bush beans: 4-7" between plants, 18" row gap for airflow"**
  (`backend/migardener_spacing.py:44`)
- A distinct `pole-beans-1` entry exists in both databases, so `bean-1` is
  unambiguously the bush/generic bean, not the pole bean.

### Proposal

| Plant  | Field      | Backend (resolved) | Frontend | Proposed winner | Source / rationale |
|--------|------------|--------------------|----------|-----------------|--------------------|
| bean-1 | sfgPerCell | 8 (via `bean-pole` prefix fallthrough) | 9 | **Frontend (9)** | Mel Bartholomew's *All New Square Foot Gardening* places bush beans in the 9-per-square (medium, 4" spacing) bucket. Johnny's Selected Seeds bush-bean growing guide also supports 2" in-row / 20–36" rows, which at SFG densification is 9/sq. Backend's own `migardener_spacing.py` already labels `bean-1` as a bush bean in its inline comment. |

### Recommended fix shape (not implemented — proposal only)

In `backend/garden_methods.py::SFG_SPACING`, add `'bean'` (and, for clarity,
`'bush-bean'` is already present) to the `9` bucket. The resolver will then
short-circuit on the first-pass exact match before falling through to
`bean-pole`.

**Sources consulted**:

- *All New Square Foot Gardening*, Mel Bartholomew, 2nd ed. — bush beans are in
  the 4"-spacing (9-per-square) category.
- [Johnny's Selected Seeds — Growing Bush Beans](https://www.johnnyseeds.com/growers-library/vegetables/beans/bush-bean-key-growing-information.html)
- [SquareFootGardening.org — Square Foot Spacing chart](https://squarefootgardening.org/2024/02/square-foot-spacing/)

### Commentary

- There is no product ambiguity here — the identifier `bean-1` with
  `spacing=4` + `rowSpacing=21` + the inline "bush beans" comment on the
  backend MIGardener override means both sides already agree that `bean-1`
  represents a bush bean. The backend SFG table just silently lacks the entry
  and the prefix-fallback matches the wrong row.
- **Downstream**: fixing this clears the three square-foot space-calculator
  xfails in `XFAIL_A_SPACECALC_CASES` (`bean`, `bean-1`, `bean-bush-1`) at the
  same time.

---

## Group B — Plant database field drift

Every table below lists only fields that actually drift for that plant, per
the diff against the frontend parity snapshot.

**Naming convention used by commercial seed catalogs vs. internal DB**:
In Johnny's Selected Seeds growing guides (and most commercial sources),
"spacing" means the in-row distance between plants (this matches the
`spacing` field in our DBs). "Row spacing" means distance between rows
(matches `rowSpacing`). All dimensions are inches.

---

### kale-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| daysToMaturity | 53 | 55 | **Frontend (55)** | Johnny's Winterbor F1 (flagship curly kale) is 55–65 days; Lacinato/Toscano ~62; Red Russian ~50. 55 is the best single midpoint across common varieties. 53 is unusual and not supported by a widely-cited source. |

Commentary: Tight call. Either value is defensible within the real-world range
(50–65 days). Frontend value aligns better with Winterbor/Lacinato
(the most common commercial kale cultivars).

Source: [Johnny's Winterbor Kale](https://www.johnnyseeds.com/vegetables/kale/winterbor-f1-kale-seed-365.html), [Gardener's Path: Kale Varieties](https://gardenerspath.com/plants/vegetables/best-kale-varieties/).

---

### arugula-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 4 | 3 | **Frontend (3)** | Johnny's arugula guide recommends 5 seeds/inch in rows, thinned to 2–3" for baby leaf / mature leaf. 3" is the typical mature-plant in-row spacing; 4" is on the loose end for arugula (which is typically grown at intensive density). |
| rowSpacing | 12 | 6 | **Frontend (6)** | Johnny's says rows "at least 2" apart" for baby-leaf; home-garden references typically use 6–12" rows for mature leaf. 6" is more aligned with arugula's salad-crop growth habit than 12". Backend's 12 treats arugula like a standard medium vegetable; frontend's 6 matches its baby-leaf/microgreen-adjacent usage. |

Commentary: Arugula is nearly always grown intensively. Frontend values are
more consistent with MIGardener / intensive-method usage and with commercial
baby-leaf guidance. Backend's 4×12 is more like a home-garden row crop —
defensible but inconsistent with how this app's other dense greens are
configured.

Source: [Johnny's Growing Arugula](https://www.johnnyseeds.com/growers-library/vegetables/greens/arugula-key-growing-information.html).

---

### carrot-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 3 | 2 | **Frontend (2)** | Johnny's: "thin young seedlings to ¾–2" apart, depending on root size desired." 2" is the upper bound in that range and the typical target for standard carrots (Nantes/Danvers). 3" produces oversized carrots and is used only for storage/large-root varieties. For a generic carrot entry, 2" better matches commercial practice. |

Commentary: 2" is the canonical commercial carrot spacing; 3" would
under-count density by ~33%. Additionally, the SFG frontend lookup lists
carrot at 16/sq (i.e. 3" on-center in both axes) — for the SFG code path
this field is moot, but for `row`/`intensive` calculators it matters.

Source: [Johnny's Carrot Bed Preparation & Spacing](https://www.johnnyseeds.com/growers-library/vegetables/carrots/carrot-bed-preparation-spacing-weeding-watering.html).

---

### beet-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 6 | 3 | **Frontend (3)** | Johnny's: "thin to 1 plant per 3"." 3" is the canonical direct-seeded beet spacing. 6" would halve density and is not supported by a primary source. The frontend SFG table has beet at 4/sq (6" on-center) — 3" in-row is consistent when paired with the ~6" between-row geometry typical of dense planting. |

Commentary: Backend's 6" looks like a confusion between the SFG on-center
(6") and the linear in-row spacing used by row/intensive calculators (3").

Source: [Johnny's Growing Beets](https://www.johnnyseeds.com/growers-library/vegetables/beets/beets-key-growing-information.html).

---

### radish-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 3 | 2 | **Frontend (2)** | Commercial + home-garden sources agree on 2–3" for Cherry Belle / standard round radishes. 2" is on the dense end; 3" is looser. Pick the value the user is most likely to encounter on a seed packet: 2" is the default on many (Burpee, Gurney's, Ferry-Morse) Cherry Belle packets. |
| rowSpacing | 4 | 6 | **Frontend (6)** | Commercial guidance: "6 to 12 inches between rows" is the typical home-garden range. 6" is the tight end. 4" is unusually dense and would only be used in block plantings, which is an SFG concern (already handled by the SFG table at 16/sq). |

Commentary: Both frontend values are closer to commercial packet defaults.
Honestly a coin-flip between 2" and 3" for in-row spacing, but the row
spacing of 4 on backend is hard to defend — I could not find a primary source
for a 4" radish row.

Source: [Gardener's Basics — How to Grow Cherry Belle](https://www.gardenersbasics.com/tools/blog/how-to-grow-cherry-belle-radish-from-seed), [Johnny's Radish Seeds catalog](https://www.johnnyseeds.com/vegetables/radishes/).

---

### onion-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 6 | 4 | **Frontend (4)** | Johnny's pelleted-onion guide says "3/4" spacing in rows 18" apart" for transplanted full-size storage onions, but the commonly-cited home-garden number for storage onions is 4" between plants in the row. 6" is for very large bulbs (jumbo/sweet-Spanish) and underestimates density for a generic entry. |
| daysToMaturity | 110 | 100 | **Frontend (100)** | Johnny's Patterson (storage yellow) = ~104; Red Wing = 108; Yellow Candy = ~85; Cortland = 105. 100 is a reasonable midpoint across full-size storage onions. 110 is on the long-season end; for a generic entry, 100 is more representative. |

Commentary: The frontend numbers are more representative of the *typical*
home-gardener planting rather than the max-bulb commercial case.

Source: [Johnny's How to Grow Onions From Seed](https://www.johnnyseeds.com/growers-library/vegetables/onions/onions-key-growing-information.html), [Johnny's Patterson Yellow Onion](https://www.johnnyseeds.com/vegetables/onions/full-size-onions/patterson-f1-onion-seed-2521.html).

---

### broccoli-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 13 | 18 | **Frontend (18)** | Johnny's: "Plants are spaced 7" apart in rows 18" apart" for mini/succession broccoli, but for standard heading broccoli (Green Magic, Imperial, etc.), 12–18" between plants is the home-garden recommendation. 18" matches Johnny's standard-broccoli row-spacing recommendation and the common SFG recommendation of 1 plant/sq with 12"+ minimum. 13" is an odd value I cannot find a primary source for. |
| daysToMaturity | 64 | 60 | **Frontend (60)** | Johnny's standard heading varieties: Green Magic 57, Marathon 68, Imperial 70. 60 is a reasonable midpoint. Both values fall in the defensible 55–70 range; 60 is slightly more aligned with early/main-season varieties which are the most commonly grown. |

Commentary: `spacing=13` is a surprisingly specific number — it may have been
derived from a calculation (e.g. ceil(12)/0.9) rather than a source. The
frontend's 18 is consistent with commercial spacing guidance.

Source: [Johnny's How to Grow Broccoli](https://www.johnnyseeds.com/growers-library/vegetables/broccoli/broccoli-key-growing-information.html).

---

### cabbage-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 12 | 18 | **Frontend (18)** | Johnny's: "Transplant outdoors… 12–18" apart in rows 18–36" apart." 18" is the upper bound / default for standard heading varieties; 12" is only for mini/early varieties or tight intensive plantings. For a generic `cabbage-1` entry, 18" better represents the typical home-garden planting. |

Commentary: Defensible at either value within the 12–18" range. 18" aligns
with commercial transplant guidance and avoids undersized heads.

Source: [Johnny's Growing Cabbage From Seed](https://www.johnnyseeds.com/growers-library/vegetables/cabbage/cabbage-key-growing-information.html).

---

### tomato-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 12 | 24 | **Frontend (24)** — with caveat | Johnny's: "space determinates 12–24" and indeterminates 24–36"" in rows 4–6' apart. For a generic `tomato-1` (most commonly an indeterminate — Better Boy, Celebrity, Sungold etc. are the top home-garden choices), 24" is the low end of the indeterminate range and a reasonable generic value. 12" is appropriate only for determinates and implies SFG usage where caging is assumed. |
| daysToMaturity | 70 | 75 | **Frontend (75)** | Johnny's standard slicers: Celebrity Plus ~73, Big Beef 73, Better Boy 70–75, Brandywine 80. 75 is a reasonable midpoint for a generic tomato. 70 is fine too, but 75 better covers the heirloom slicer range that home growers often choose. |

Commentary: This is the **biggest "generic entry covers a very wide real-
world range" case in the set.** Tomato varieties genuinely span 55 (early
cherry) to 90+ (late beefsteak) days; spacing ranges from 12" (tight
determinate/staked) to 36" (sprawling indeterminate). **A variety-specific
override system for `tomato-1` would eliminate most of the calibration
disagreement. Recommend flagging this plant for follow-up work once the
variety-override path is production-ready.**

Source: [Johnny's How to Grow Tomatoes](https://www.johnnyseeds.com/growers-library/vegetables/tomatoes/tomatoes-key-growing-information.html).

---

### pepper-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| daysToMaturity | 73 | 70 | **Frontend (70)** | Johnny's: bell pepper DTM "number of days from transplant date." California Wonder (reference heirloom bell pepper) is consistently listed at 70–75 across sources (Pinetree 75, Alibaba 65–70, American Seed Co 72–75). 70 is the typical lower-bound / "most popular varieties" midpoint for bell peppers. 73 is defensible but unusual. |

Commentary: This is a very tight call — 70 vs 73 is within noise across
sources. Frontend picked a round number from the common range; backend's
73 may have been pulled from a specific variety. Frontend is preferred for
consistency with widely-cited numbers.

Source: [Johnny's Growing Peppers](https://www.johnnyseeds.com/growers-library/vegetables/peppers/peppers-key-growing-information.html), [American Seed Co — California Wonder](https://americanseedco.com/shop/california-wonder-72-75-days/).

---

### cucumber-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| rowSpacing | 60 | 36 | **Frontend (36)** | Johnny's commercial guidance: "rows 6' apart" for direct-seeded sprawling cucumbers, but "2 rows per bed, with 12–18" between plants" for trellised bed-grown. 60" (5 ft) reflects commercial sprawling growth; 36" reflects home-garden trellised/staked practice. For a generic entry in a bed-based app, 36" is a better match to the user's likely context. |

Commentary: Neither value is "wrong" — they reflect different scales
(commercial field vs. home-garden bed). For an app that leans home-garden
/ SFG / intensive, 36" is the better default.

Source: [Johnny's How to Grow Field Cucumbers](https://www.johnnyseeds.com/cucumbers/cucumber-key-growing-information.html).

---

### pea-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 4 | 2 | **Frontend (2)** | Johnny's: "sow peas 1½–2" apart in rows 18–36" apart." 2" is the canonical in-row pea spacing; 4" halves the density and is not supported by a primary source. |
| rowSpacing | 24 | 18 | **Frontend (18)** | Johnny's: "rows 18–36" apart." 18" is the low end / typical home-garden value for trellised peas; 24" is defensible but generic-entry defaults usually pick the tighter commonly-cited number. |

Commentary: Both frontend values directly match Johnny's low-end / default
spacing. Backend values look like an extrapolation.

Source: [Johnny's Growing Peas](https://www.johnnyseeds.com/growers-library/vegetables/peas/peas-key-growing-information.html).

---

### lettuce-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 8 | 6 | **Frontend (6)** | Johnny's: "iceberg, romaine, butterhead lettuce 10–12" apart," "other types 8–10" apart," "mini heads as close as 6" in a grid." Since `lettuce-1` is "Lettuce" (generic — SFG table treats as leaf lettuce at 4/sq = 6" on-center), 6" matches the SFG table and the "mini heads / leaf / tight spacing" row. 8" is OK for looseleaf but disagrees with the SFG side of the app. |
| daysToMaturity | 60 | 45 | **Frontend (45)** | Looseleaf varieties (Black Seeded Simpson) mature in 40–50 days; head lettuce is 55–65. Since the SFG table classifies `lettuce-1` as 4/sq (leaf/looseleaf), 45 days is more consistent with that classification. 60 days would belong to a head-lettuce generic. |

Commentary: Internal consistency point — both sides' SFG tables already say
`lettuce-1` = 4/sq (leaf lettuce / 6" on-center). Backend's spacing=8 and
DTM=60 model a head-lettuce-like entry, which contradicts the SFG
classification. Frontend is self-consistent.

Source: [Johnny's Growing Lettuce](https://www.johnnyseeds.com/growers-library/vegetables/lettuce/lettuce-key-growing-information.html), [Pinetree — Black Seeded Simpson 46 days](https://www.superseeds.com/products/black-seeded-simpson-lettuce-46-days).

---

### basil-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 7 | 10 | **Frontend (10)** | Johnny's: "A final spacing of 4–8" apart produces healthy, full plants" for Genovese basil, but home-garden references and MIGardener favor 8–12" for full bushy plants with airflow. Backend MIGardener override (`basil-1`: `(12, 8)`) already assumes 8" in-row, consistent with 8–10" being the normal range. Frontend's 10" is on the upper end of Johnny's commercial range but matches typical home-garden guidance for Genovese. 7" is unusual and not widely cited. |

Commentary: Either 8 or 10 would be defensible. Frontend's 10 is the common
home-garden value; 8 is Johnny's upper commercial value. If the user
strictly prefers Johnny's commercial spacing, 8 would be an alternative.

Source: [Johnny's How to Grow Basil](https://www.johnnyseeds.com/growers-library/herbs/basil/basil-key-growing-information.html).

---

### parsley-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 6 | 8 | **Frontend (8)** | Johnny's: "Thin plants to 8–12" apart." 8" is the low end; 6" is below the cited range. Backend's MIGardener override (`parsley-1`: `(8, 4)`) uses 4" for intensive plantings — consistent with 8" being the "standard" (non-intensive) in-row spacing. |

Commentary: Frontend matches Johnny's lower bound; backend's 6" is below
the commercial range.

Source: [Johnny's Growing Parsley](https://www.johnnyseeds.com/growers-library/herbs/parsley/parsley-key-growing-information.html).

---

### cilantro-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 12 | 6 | **Frontend (6)** | Johnny's: "Sow seeds… ¼–½" apart in rows at least 3" apart. For coriander seed production, thin to stand 2–4" apart." For leaf harvest (the common home-garden use), no thinning needed — grown densely. 6" is consistent with cilantro's small habit. 12" would treat cilantro like a medium vegetable; it's actually a dense-sown herb. |
| daysToMaturity | 45 | 50 | **Frontend (50)** | Cilantro leaf harvest typically 45–55 days; seed (coriander) ~90+ days. 50 is a reasonable midpoint for leaf use. 45 is early-harvest; 50 is more representative. Both are defensible within ~45–55 range. |

Commentary: 12" on the backend strongly suggests cilantro was miscategorized
as a "medium vegetable" rather than a dense-sown herb. Frontend values
reflect herb-crop reality.

Source: [Johnny's Growing Cilantro](https://www.johnnyseeds.com/growers-library/herbs/cilantro-coriander/cilantro-coriander-key-growing-information.html).

---

### dill-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| spacing | 8 | 10 | **Frontend (10)** | Johnny's: "transplant out using 2–4" spacing in rows at least 4" apart," but for mature dill (Bouquet — the common variety), 10–12" gives room for its tall feathery growth. Backend MIGardener override (`dill-1`: `(12, 6)`) uses 6" intensive, implying the "standard" spacing should be in the 10–12" range. Frontend's 10" is a good fit. 8" is defensible but tight. |
| daysToMaturity | 50 | 40 | **Frontend (40)** — with mild caveat | Dill for fresh leaf: 40–50 days. Dill for seed: 70+ days. 40 is the lower bound and matches Johnny's "begin harvesting in 40 days" guidance for fresh leaf. 50 is defensible for later/fuller harvest or seed-leading. Frontend's 40 is a reasonable "first harvest" value. |

Commentary: Both DTM values fall within a reasonable range. Frontend
spacing is better supported; DTM is a tight call. If the user prefers a
"full plant" rather than "first harvest" metric, 50 would be an alternative.

Source: [Johnny's Growing Dill](https://www.johnnyseeds.com/growers-library/herbs/dill/dill-key-growing-information.html).

---

### strawberry-1

| Field | Backend | Frontend | Proposed winner | Source / rationale |
|---|---|---|---|---|
| rowSpacing | 24 | 18 | **Inconclusive — lean Frontend (18)** | Commercial June-bearing: 18–24" in rows 36–48". Home-garden / raised-bed / matted-row can go tighter. 18" is on the dense end; 24" is Johnny's recommended. **Either is defensible.** Frontend's 18 fits denser home-garden plantings. If the app's users are likely doing commercial or matted-row, 24 is better; if they're using raised beds or hill plantings, 18 is better. |
| daysToMaturity | 90 | 120 | **Inconclusive — lean Frontend (120)**, with strong caveat | Strawberry DTM is philosophically tricky. June-bearing strawberries **produce no fruit in year 1** (buds are removed to build roots); first harvest is year 2, ~270–365+ days after planting. So a "days to maturity" number for strawberry doesn't map cleanly onto the annual-crop semantics the field was designed for. 90 days is the approximate flower-to-fruit window *after* establishment; 120 is a slightly fuller margin. **Neither value is "correct" as days-from-planting-to-first-harvest.** |

Commentary: **Open question for user**: strawberry-1 is a perennial plant
and the DTM field semantics don't really apply. Recommend either (a) standardizing
to whatever value the app uses as a "flowering-to-fruit" approximation (90
for June-bearing, 60 for day-neutral) or (b) adding a `perennial: true`
flag and letting the UI surface a different "year-2 first harvest" workflow.

Source: [Johnny's How to Grow Summer-Bearing Strawberries](https://www.johnnyseeds.com/growers-library/fruit/strawberries/strawberries-summer-bearing-june-bearing-key-growing-information.html), [StrawberryPlants.org — June-Bearing Spacing](https://strawberryplants.org/how-to-space-june-bearing-strawberries-arrangement-tips/).

---

## Group E — `shallot-from-seed` / `shallot-from-sets`

### Current state

- **Frontend MIGardener** (`frontend/src/utils/migardenerSpacing.ts`):
  has `'shallot-from-seed': [6, 3]` and `'shallot-from-sets': [12, 10]`.
- **Backend MIGardener** (`backend/migardener_spacing.py`):
  also has these entries (same values). **No drift here.**
- **Frontend SFG** (`frontend/src/utils/sfgSpacing.ts`):
  does NOT have explicit entries for `shallot-from-seed` / `shallot-from-sets`.
  Frontend's resolver `getSFGPlantsPerCell` splits on `-` → base `'shallot'`
  → hits `'shallot': 4` entry → returns 4 plants/cell.
- **Backend SFG** (`backend/sfg_spacing.py` + `garden_methods.py`):
  `get_sfg_cells_required('shallot-from-seed')` does `rsplit('-', 1)`, gets
  `'shallot-from'` (last chunk `'seed'` is not a digit), fails first-pass
  exact match, fails second-pass prefix match (no pattern starts with
  `'shallot-from-seed-'`), falls through to default `1.0` cells/plant.
  **Net: backend returns 1.0 cells/plant, frontend returns 0.25.**
- **UI reachability**: `grep -rn 'shallot-from-(seed|sets)'` across the
  frontend `src/` tree returns **zero hits in UI components, zero hits in
  PlantPalette / plant catalog, zero hits in any dropdown or plant
  selector.** These IDs are only referenced in `migardenerSpacing.ts`
  (override values) and the parity fixture.
- **Plant database entries**: neither `plant_database.py` nor
  `plantDatabase.ts` has a `shallot-from-seed` or `shallot-from-sets` plant
  entry. Both only have `shallot-1`.
- **Documentation**: `docs/references/MIGARDENER_REFERENCE.md` and
  `docs/implementation-summaries/MIGARDENER_IMPLEMENTATION_SUMMARY.md`
  document these IDs as MIGardener cultivation-style distinctions
  (from-seed = 3" single-bulb, from-sets = 10" cluster-bulb).

### Decision table

| Plant | Decision | Rationale |
|---|---|---|
| shallot-from-seed | **Keep in frontend; add SFG-table entry in backend** (least risky) | The ID represents a real cultivation distinction that MIGardener uses (single-bulb production vs. cluster-bulb production), documented in the MIGARDENER_REFERENCE. It exists on BOTH sides in the MIGardener table, so removal would touch two files and invalidate the reference doc. The ONLY drift is that backend's SFG resolver returns 1.0 instead of 0.25 when asked to resolve it via the SFG path — which is unreachable from the UI today. Fix by either (a) adding `'shallot-from-seed'` to the backend SFG_SPACING `4`-per-square bucket, or (b) making the backend resolver fall through `shallot-from-*` → base `shallot`. Option (a) is additive and surgical. |
| shallot-from-sets | **Same — keep in frontend; add SFG-table entry in backend** | Identical reasoning. |

### If "add to backend" (recommended)

Suggested additions to `backend/garden_methods.py::SFG_SPACING` under the
existing `4:` bucket (6" on-center, 4 plants/sq ft — same as `shallot`):

```python
4: [
    'lettuce', 'lettuce-leaf', ...,
    'beet', 'onion', 'shallot', 'shallot-from-seed', 'shallot-from-sets',
    'garlic', 'leek', ...
]
```

Rationale for 4/sq (same as base `shallot`): Both cultivation styles mature
to the same bulb footprint from the SFG perspective (cluster-habit shallots
don't need more SFG cells — they just produce multiple bulbs per plant).
Only the MIGardener method (in-row / row-spacing) cares about the
from-seed vs. from-sets distinction.

**Alternative**: adjust the resolver in `backend/sfg_spacing.py` to strip
any trailing `-from-*` suffix before lookup. More generic but less explicit.

### If "remove from frontend"

Not recommended, but confirmed mechanically feasible:

- Remove `'shallot-from-seed'` and `'shallot-from-sets'` from
  `frontend/src/utils/migardenerSpacing.ts::MIGARDENER_SPACING_OVERRIDES`
  and the mirror file `backend/migardener_spacing.py::MIGARDENER_SPACING_OVERRIDES`.
- Remove references from the parity snapshot (regenerate).
- Remove references from `docs/references/MIGARDENER_REFERENCE.md` and
  `docs/implementation-summaries/MIGARDENER_IMPLEMENTATION_SUMMARY.md`.
- Verify no seed import CSV references these IDs (grep `shallot-from` in
  `services/csv_import_service.py` confirms they are not referenced in
  import logic, only in the parity-test file).

Removal is "safe" in the sense that no UI path currently uses these IDs,
but it's strictly destructive: deletes documented cultivation-method
distinctions + two well-researched MIGardener spacing values, and loses the
ability to model "from seed" vs "from sets" in the future.

**Recommended: Option (a) — add backend SFG entries.** Additive, surgical,
preserves the documented cultivation distinction.

---

## Open questions for the user

1. **`tomato-1` generic entry.** Both sides model this with a wide-range
   cover value (DTM 70 vs 75; spacing 12 vs 24). Real tomatoes span 55–90+
   days and 12–36" spacing. Strong recommendation: after alignment, flag
   `tomato-1` for variety-specific override work once the variety-override
   schema is considered production-ready.

2. **`strawberry-1` perennial DTM.** The `daysToMaturity` field for a
   perennial plant is semantically muddled. Neither 90 nor 120 is the
   "days from planting to first harvest" (which is ~270–365+). Product
   decision needed: (a) keep as a "flower-to-fruit" approximation for UX
   purposes, (b) introduce a `perennial` flag and a year-2 harvest path,
   or (c) set `daysToMaturity: null` and surface perennial semantics
   elsewhere.

3. **`arugula-1` `rowSpacing=12` vs `6`.** Arugula is usually treated as a
   dense/intensive crop in this app's MIGardener entries, but backend's
   `rowSpacing=12` models it as a standard medium-spaced vegetable. Worth
   confirming the user's intended modeling (I proposed 6, which aligns with
   MIGardener / dense use, but 12 is defensible for a "wide row" home garden
   user).

4. **Whether to use commercial seed-catalog values or SFG/home-garden
   values as the tie-break.** Several cases (broccoli 13 vs 18, cabbage 12
   vs 18, onion 4 vs 6) involve commercial-style tight packing vs. home-
   garden recommended spacing. This proposal consistently picked
   home-garden / Johnny's-catalog defaults over backend values. If the user
   prefers commercial/dense-packing as the reference, several calls
   (cabbage, broccoli spacing especially) would flip.

5. **`pepper-1` 70 vs 73 days.** Tight enough (~4% difference) that the
   choice is largely aesthetic. 70 is rounder and more commonly cited.

6. **Downstream parity groups C/D/F**: Once Group B is fixed, several
   `migardener` and `intensive`-method failures in Group F
   (`cilantro-1[intensive]`, `dill-1[intensive]`) will clear automatically
   because those paths consume the `spacing` field from `PLANT_DATABASE`.
   Groups C and D are architectural (unit mismatch in the calculator)
   and are addressed by the Tier-1 backend space-calculator rewrite, not
   by this data alignment.

---

## Method note

Prioritized sources used (in order of preference per field):

1. **Johnny's Selected Seeds Grower's Library** (johnnyseeds.com/growers-library)
   for `spacing` / `rowSpacing` / generic `daysToMaturity` — preferred because
   their guidance is cultivar-aware, commercially validated, and widely cited
   in home-garden references.
2. **Mel Bartholomew's *All New Square Foot Gardening*** (2nd ed.) for
   SFG-specific plants-per-square decisions, plus
   [SquareFootGardening.org](https://squarefootgardening.org/) for the
   canonical spacing-chart reference.
3. **Backend's own MIGardener-override inline comments** — useful
   cross-references because they were authored with commercial+MIGardener
   research and often explicitly label the crop type (e.g., `'bean-1'` →
   `(18, 5.5)` with comment "Bush beans: 4-7" between plants").
4. **Variety-specific seed retailer pages** (Pinetree, Ferry-Morse,
   Gardener's Basics, Gurney's, American Seed Co, Baker Creek/RareSeeds) for
   DTM sanity-checks on common heirloom varieties.
5. **University Extension** (Cornell, Oregon State, Penn State, Utah State,
   Iowa State) — consulted for strawberry, general greens, and
   cross-reference where commercial sources were unclear.
6. **MIGardener (Luke Marion)** — his website and the in-repo
   `docs/references/MIGARDENER_REFERENCE.md` for MIGardener-method fields.
   In this audit, no `migardener.*` fields drifted for the 18 Group B
   plants, so MIGardener didn't drive any decisions here — but it was
   consulted as a sanity check for every herb/dense-crop decision.

**Where primary sources conflict or are variety-specific** (e.g.,
tomato-1, pepper-1, strawberry-1), this proposal explicitly flags the
case as "commentary" / "caveat" / "inconclusive" rather than picking
silently. For truly inconclusive items (strawberry-1 DTM), I have
proposed the less-disruptive value and surfaced the decision to the
user in the "Open questions" section above.

---

## Verification note

Field-level drift was extracted by running:

```bash
cd backend && python -m pytest tests/test_cross_stack_parity.py::TestPlantDatabaseParity -v --runxfail
```

and diffing the frontend parity snapshot against the backend `PLANT_DATABASE`
using a small inline script. Of the 18 Group B plants, 17 produced
actionable drift; all `migardener.*` sub-fields matched exactly on all 18.
Per the task constraint, no production code or data was modified in
producing this proposal. The only file created is this one.
