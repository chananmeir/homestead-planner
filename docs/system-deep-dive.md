# Homestead Planner — Complete System Deep-Dive

**Generated:** 2026-06-10 · **Codebase state:** commit `9dfb056` (post unused-code audit)
**Purpose:** An exhaustive, all-angles reference describing everything this software does —
every screen, every interaction, every API endpoint, every database table, every calculation,
every integration — so the owner can read it, ask questions against it, and spot anything
missing. Verified counts: **135 API routes + 11 legacy page routes across 19 blueprints ·
26 database models · 118 plants in the plant database (backend = frontend) · 702 backend
tests in 36 files · 29 frontend unit-test files · 37 Playwright e2e specs.**

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Domain Concepts & Vocabulary](#2-domain-concepts--vocabulary)
3. [The User Experience, Screen by Screen](#3-the-user-experience-screen-by-screen)
4. [Core Engines & Business Rules](#4-core-engines--business-rules)
5. [Data Model Reference](#5-data-model-reference)
6. [API Reference](#6-api-reference)
7. [Static Data & the Synchronized Pairs](#7-static-data--the-synchronized-pairs)
8. [External Integrations & Environment](#8-external-integrations--environment)
9. [Time & the Simulation System](#9-time--the-simulation-system)
10. [Architecture & Operations](#10-architecture--operations)
11. [Appendix A — Observations: Possible Gaps & Inconsistencies](#11-appendix-a--observations-possible-gaps--inconsistencies)
12. [Appendix B — Glossary & File Map](#12-appendix-b--glossary--file-map)

---

# 1. Executive Overview

## 1.1 What this software is

Homestead Planner is a **full-stack, multi-user homestead management application**. Its core
is garden planning — deciding what to grow, where, and when, then tracking it from seed packet
to harvest — but it extends across the whole homestead: livestock (chickens, ducks, beehives,
general animals), composting, photos, property layout, weather, soil temperature, maple
tapping, and nutrition accounting for everything produced.

It is a single-household-scale product (SQLite database, localhost deployment, a default
`admin` account seeded at first start) with real multi-user support: every record is owned by
a `user_id`, authentication is session-based, and an admin role manages accounts.

## 1.2 The core mental model: Plan → Schedule → Place

Almost everything in the garden side of the app flows through **three linked models**, each
representing a different "level of reality":

```
   GardenPlanItem            PlantingEvent                PlantedItem
  (the intention)          (the schedule)               (the reality)
 ┌────────────────┐   export    ┌────────────────┐   place    ┌────────────────┐
 │ "519 carrots   │ ──────────► │ "Plant 130     │ ─────────► │ "Carrot at     │
 │  this season,  │  to         │  carrots in    │  on the    │  cell B3 in    │
 │  4 successions,│  calendar   │  Bed A on      │  Designer  │  Bed A, planted│
 │  in Beds A+B"  │             │  Apr 12" (×4)  │  grid      │  Apr 12" (×130)│
 └────────────────┘             └────────────────┘            └────────────────┘
   GardenPlanner view            PlantingCalendar view         GardenDesigner view
```

- A **GardenPlanItem** is one row of a season plan: a crop target with quantity, succession
  settings, and bed assignments. Created in the **Garden Planner**.
- **Export to Calendar** turns each plan item into one or more **PlantingEvents** — dated,
  positioned schedule entries (one per succession per bed). These are what the **Planting
  Calendar** shows and what the **Dashboard** nags you about. Export is idempotent: each
  event carries an `export_key` so re-exporting updates instead of duplicating.
- When you actually put a plant in the ground (drag-and-drop on the **Garden Designer**
  grid), a **PlantedItem** is created — the ground truth of what is physically growing where.
  Placing a plant also auto-creates/completes the matching PlantingEvent, so the calendar and
  the grid stay in step.

A fourth model, **IndoorSeedStart**, runs in parallel for crops started indoors: it tracks
seeds → germination → hardening-off → transplant, and links to the PlantingEvent that
represents the outdoor side of the same planting.

The linkages (detailed in §5.2): `PlantedItem.source_plan_item_id` and the event's
`export_key` tie reality back to the plan; `IndoorSeedStart.planting_event_id` ties the
indoor tray to the outdoor schedule; `succession_group_id` ties a succession series together;
`harvest_group_id` ties the records of one bulk harvest together.

## 1.3 Technology at a glance

| Layer | Technology | Notes |
|---|---|---|
| Backend | Python / Flask 3.0, SQLAlchemy, Flask-Migrate (Alembic), Flask-Login, Flask-CORS | 19 blueprints under `backend/blueprints/`, services layer under `backend/services/` |
| Database | SQLite at `backend/instance/homestead.db` | 26 models; 18 Alembic migrations; `db.create_all()` also runs at startup |
| Frontend | React 19 / TypeScript 4.9 / Tailwind CSS (Create React App) | No URL router — state-based tab navigation in `App.tsx` with URL-parameter deep links |
| Drag & drop | `@dnd-kit/core` | Designer plant placement, Property Designer structures |
| HTTP | `fetch` wrappers in `frontend/src/utils/api.ts` (credentialed) | Backend CORS allows localhost:3000/3001 with credentials |
| Weather/soil | Open-Meteo (no key needed), optional WeatherAPI.com | 15-minute caching layers |
| Geocoding | Geocodio (default) or Google, ZIP cache, phzmapi.org for USDA zones | All optional — graceful fallbacks |
| Nutrition | USDA FoodData Central API + bundled baseline CSV | Optional API key |
| Tests | pytest (702 tests), Jest/RTL (29 files), Playwright (37 specs) | |
| Ports | Backend **5051** (via `start-backend.bat`; code default 5000), frontend **3000** | `REACT_APP_API_URL` points the SPA at the backend |

## 1.4 The seven navigation areas

The SPA's top navigation groups everything into: **Dashboard** · **Plan** (Garden Plans,
Garden Snapshot) · **Design** (Garden Designer, Property Designer) · **Grow** (Planting
Calendar, Indoor Starts, Soil Temperature, Weather) · **Track** (Harvests, Photos, Nutrition)
· **Manage** (Seeds, Livestock, Compost) · **Admin** (User Management, admins only). A
floating **Simulation toolbar** lets a developer time-travel the whole app to any date.

---

# 2. Domain Concepts & Vocabulary

These are the concepts the entire system is built on. Understanding them makes every screen
and API self-explanatory.

## 2.1 Plant, variety, and seed — three different things

- A **plant** is an entry in the static 118-entry plant database (`backend/plant_database.py`
  mirrored by `frontend/src/data/plantDatabase.ts`), identified by an id like `tomato-1`.
  It carries the agronomic defaults: spacing, row spacing, days to maturity (DTM), weeks
  indoors, germination days/temps, frost tolerance, soil pH, water/sun needs, companions and
  incompatibles, optional MIGardener spec, days-to-seed for seed saving, an emoji icon, etc.
- A **variety** is a free-text refinement carried on records ("Brandywine" on a tomato).
  Varieties are not separate plant entries; they ride along on SeedInventory rows,
  PlantingEvents, PlantedItems, and IndoorSeedStarts and are matched by string comparison.
- A **seed** is a `SeedInventory` row — a packet you own (or a global catalog entry when
  `user_id` is NULL / `is_global` true). Seeds can carry **14 nullable agronomic override
  fields** (days_to_maturity, germination_days, plant_spacing, row_spacing, planting_depth,
  germination_temp_min/max, soil_temp_min, heat/cold tolerance, bolt_resistance,
  ideal_seasons, flavor_profile, storage_rating). **NULL means "use the plant default";
  0 is a real value** — a rule enforced throughout the codebase with explicit
  `is not None` / `!= null` checks (see CLAUDE.md "NULL vs Falsy").

**Resolution chain for any agronomic number** (e.g., DTM): seed override → plant database
default → hard fallback (60 days for DTM). The newer maturity-learning feature (§4.10) adds a
learned, per-variety layer on top.

## 2.2 Beds, planning methods, grids, and planting styles

- A **GardenBed** has width × length (feet), height (inches, default 12), sun exposure
  (full/partial/shade), soil type (sandy/loamy/clay), mulch type, an optional permaculture
  **zone** (zone0–zone5), optional **season extension** JSON (cold frame / row cover /
  greenhouse / shade cloth layers), and — critically — a **planning_method**.
- The **planning method** is bed-level and decides the grid and the spacing math:

| Method | Grid cell | Spacing philosophy |
|---|---|---|
| `square-foot` | 12″ | Mel Bartholomew SFG: fixed plants-per-square tiers (0.5, 1, 4, 8, 9, 16) |
| `row` | 6″ | Traditional rows: row spacing × within-row spacing |
| `intensive` | 6″ | Jeavons bio-intensive: hexagonal on-center spacing (rows offset by 0.866×) |
| `migardener` | 3″ | Luke Marion ultra-dense rows; per-crop overrides, seed-density planting |
| `raised-bed` | 6″ | Flexible (any method inside) |
| `permaculture` | 12″ | Zone-based, mature-size spacing |
| `container` | 12″ | Per-container |

- The grid is addressed like a spreadsheet: columns A, B, C…, rows 1, 2, 3…
  (`gridCoordinates.ts` converts both ways; "B3" = x:1, y:2).
- A **planting_style** is plant-level (on PlantingEvent): `row_based`, `broadcast`,
  `dense_patch`, or `plant_spacing` — it describes *how that particular planting is sown*
  (one transplant vs. a seeded row segment vs. broadcast seed). Planning method drives space
  math; planting style drives seed-quantity math and rendering. (CLAUDE.md flags the
  interaction of the two as an incompletely refactored area.)

## 2.3 Individual plants vs. seed-density plantings

Two fundamentally different quantity models coexist:

- **Individual plants**: quantity = number of plants. A tomato occupies 1 SFG cell.
- **Seed-density plantings** (lettuce rows in MIGardener, broadcast arugula): quantity =
  number of **seeds**, with expected germination and survival rates producing an
  `expected_final_count`. Space math is *per seed* (cells per seed = 1 / seeds-per-sqft),
  and PlantingEvent carries the extra fields (`seed_count`, `seed_density`,
  `ui_segment_length_inches` for rows; `seed_density_per_sq_ft` for broadcast;
  `seeds_per_spot` / `plants_kept_per_spot` for the seed-several-keep-one style).

## 2.4 Succession planting

A plan item with succession enabled becomes N staggered plantings. Vocabulary:
- **succession_count** (1–8) and **succession_interval_days** (≥14).
- The total quantity is split across plantings with **remainder-to-early distribution**
  (21 plants / 4 successions → 6, 5, 5, 5 — no fractional loss).
- All events in a series share a **succession_group_id** (UUID string, always filtered by
  user_id since it has no FK).
- A per-user/per-seed **succession preference** scales 0–8 ('0' = none … '8' = very heavy);
  legacy values none/light/moderate/heavy are normalized to the numeric scale.
- Suitability is derived from DTM: quick crops (≤ ~90 days) are succession-friendly;
  long-season crops are excluded.

## 2.5 Trellises and linear feet

Vining crops (pole beans, indeterminate tomatoes, grapes) are planned in **linear feet**
along a **TrellisStructure** rather than bed cells. Each plant consumes
`linearFeetPerPlant` (from the plant's MIGardener spec, default 5 ft). Exported trellis
events carry `trellis_position_start_inches` / `end_inches` — a reserved segment along the
trellis — plus `linear_feet_allocated`. Database CHECK constraints enforce sane segments
(start ≥ 0, end > start, both-or-neither). Capacity = total length − sum of allocations.

## 2.6 Completion, cancellation, and "what counts as done"

- **PlantingEvent** has two completion fields: `completed` (boolean) and
  `quantity_completed` (None = not started, partial counts, ≥ quantity = done), plus
  `harvest_completed` for the harvest phase. The **canonical check is the computed property
  `is_complete`** (prefers quantity comparison, falls back to the boolean). Write endpoints
  keep the two normalized (e.g., setting `completed=true` auto-fills `quantity_completed`).
- **PlantedItem** has a separate informational `status` string
  (planned/seeded/transplanted/growing/harvested/saving-seed). It is *not* automatically
  synced to event completion except at harvest.
- **Soft delete**: PlantingEvent, PlantedItem, and IndoorSeedStart all have a nullable,
  indexed `cancelled_at`. "Skip" actions set it; "uncancel" clears it; queries filter
  `cancelled_at IS NULL`. Nothing is lost — a skipped task can be restored.

## 2.7 The active plan and the season

The frontend keeps one **active GardenPlan** (ActivePlanContext, persisted in
localStorage, auto-selecting the current year's plan). The Designer's sidebar progress, the
designer-sync feature, and dashboard plan attribution all read the active plan.

## 2.8 Simulated time

A development "time machine": the backend `simulation_clock` can pin "today" to any date;
nearly every date-sensitive subsystem (dashboard signals, validation, frost logic, soil
temperature, rotation, models) calls `get_today()/get_now()` instead of raw datetime, and the
frontend mirrors it via SimulationContext + a floating toolbar. Past dates even fetch real
historical weather from the Open-Meteo archive. (§9 lists what does and doesn't honor it.)

## 2.9 Seed saving

Any PlantedItem can be flagged **save_for_seed**: its status becomes `saving-seed`, a
`seed_maturity_date` is computed (base date + plant `days_to_seed`, base = harvest date →
transplant+DTM → planted+DTM), and the linked event's expected harvest date is *extended* to
the seed maturity date so the plant stays "in the ground" in every view. **Collect seeds**
finishes the cycle: status → harvested, and optionally a new homegrown SeedInventory row is
created with provenance (`source_planted_item_id`, `is_homegrown=true`).

---

# 3. The User Experience, Screen by Screen

## 3.1 App shell, navigation, and cross-cutting UI plumbing

**File:** `frontend/src/App.tsx` (~917 lines).

- **Provider stack** (outermost → innermost): `SimulationProvider` → `AuthProvider` →
  `ToastProvider` → `ActivePlanProvider` → `ErrorBoundary` → app shell. Toasts
  (success/error/warning) float globally; the ErrorBoundary catches render crashes with a
  fallback UI.
- **Header**: site title, weather/location summary, signed-in user, login/logout buttons.
- **Navigation**: grouped tabs (Dashboard / Plan / Design / Grow / Track / Manage / Admin).
  There is **no URL router** — the active view is React state. Deep-linking is done with URL
  *parameters* read once at load (`urlParams.ts`): tab, bedId, date, focus ids, etc.
  `buildAppDestinationUrl()` + `openAppDestination()` construct such URLs (used by the
  Dashboard to open the right screen focused on the right row).
- **Auth gating**: unauthenticated users see `LoginRequiredMessage` with Login/Register
  modals (username/email/password). Session cookie (7-day lifetime) carries auth; every
  fetch goes through credentialed wrappers in `utils/api.ts` (`apiGet/apiPost/apiPut/
  apiPatch/apiDelete`).
- **Deep-link focus system**: a `NeedsAttentionTarget` discriminated union with **14 kinds**
  (`harvest`, `harvestBed`, `indoorStart`, `transplant`, `directSeed`, `placePlantedItem`,
  `germinationCheck`, `indoorGerminationCheck`, `compost`, `seedLow`, `seedExpiring`,
  `livestock`, `weatherFrost`, `weatherRain` — `Dashboard/types.ts:216-241`). App.tsx routes
  each kind to a view and passes a `focus*` prop; destination views use the
  `useFocusHighlight` hook (registerRef per row → scrollIntoView + ~2s highlight) or, where
  rows aren't ref-registered, a "clear filters and show everything" trigger. Several
  destinations auto-adjust their own filters on focus (IndoorSeedStarts forces status='all',
  PlantingCalendar forces list view, SeedsHub jumps to the inventory subtab, Livestock
  switches category via a `FOCUS_TYPE_TO_CATEGORY` map).
- **Simulation toolbar** (`SimulationToolbar.tsx`): floating control to set/clear/advance the
  simulated date; visible app-wide; syncs with the backend clock (§9).

## 3.2 Dashboard

**Files:** `frontend/src/components/Dashboard/` (index + 7 widgets + types + hooks).
**Data:** one call — `GET /api/dashboard/today` (optionally `?date=YYYY-MM-DD`).

Widgets, top to bottom/grid:

- **ActivePlanCard** — the active season plan's summary with quick jumps to Designer and
  Calendar.
- **NeedsAttentionPanel** — the heart of the dashboard (§4.8 covers the engine). Renders
  signal rows grouped by type, each row with an icon, label, context (plant, variety, bed,
  date deltas), and actions:
  - **Click** → deep-link navigation to the exact task (see 3.1).
  - **Snooze** (3 days default, 1–30, or forever) / **Unsnooze** — `POST/DELETE
    /api/dashboard/snooze` with the row's `signalKey`.
  - **Cancel task** (where applicable) — soft-cancels the underlying PlantingEvent /
    PlantedItem / IndoorSeedStart (`.../cancel` endpoints), with undo via uncancel.
  - **Row grouping**: same-day/same-plant/same-bed harvest rows collapse into one row
    carrying multiple `plantingEventIds`; grouped cancel fans out.
  - **Stale vs missed**: overdue harvest rows stay visible but demote with an `isStale`
    badge; overdue start/transplant/seed tasks age out of the active list into a separate
    **Missed** block (still actionable). Display-layer only — no data is mutated by aging.
- **WeatherSummaryTile** — compact current conditions + frost/rain alerts.
- **QuickActions** — one-click jumps: add planting, log harvest, add seed, add livestock,
  add compost, upload photo.
- **UpcomingTimeline** — the next 7 days of planting events.
- **DashboardGardenSnapshot** — what's in the ground right now (same data as §3.4 snapshot).
- **PlansSection** — all plans with create/edit/delete/activate.

## 3.3 Garden Planner (season planning wizard)

**File:** `frontend/src/components/GardenPlanner.tsx` (~3,400 lines) + `GardenPlanner/`
(PlanNutritionCard, GardenSnapshot).

**The workflow** (one plan per season/year, many allowed):

1. **Plan list** — create (CreatePlanModal: name, optional duplicate-from), edit, delete,
   **activate** (sets the app-wide active plan).
2. **Seed selection** — pick from your SeedInventory (search/filter/sort). Per seed you can
   set a **manual quantity** override and a **per-seed succession preference** (0–8, with a
   suitability hint computed from DTM: ideal / good / limited / unsuitable).
3. **Calculate** — `POST /api/garden-plans/calculate` runs the quantity engine (§4.5):
   strategy (`balanced` / `maximize_harvest` / `use_all_seeds`) + space limits + seed counts
   + germination/survival rates → proposed quantities per crop, with a **space summary**
   (total used vs available, utilization % broken down per planning method) and appended
   **rotation warnings**.
4. **Bed allocation** — per plan item, choose beds via `bedAssignments`
   (`[{bedId, quantity}]`, the single source of truth) with **even** or **custom**
   allocation mode; incompatible beds can be hidden; trellis crops get **trellis
   assignments** (linear-feet placement on chosen trellises) instead.
5. **Review** — feasibility check (`GET .../feasibility`), **PlanNutritionCard**
   (projected calories/macros for the plan via `GET .../nutrition`), **shopping list**
   (`GET .../shopping-list`: seeds needed vs owned → packets to buy with cost estimate).
6. **Export to calendar** — `POST .../export-to-calendar`. First call returns **409 with a
   conflict preview** if prospective events would overlap anything (modal shows details);
   confirming re-calls with `conflictOverride: true`. Creates/updates PlantingEvents
   idempotently (§4.6). Plan items flip to status `exported`.
7. **Plan detail / progress** — per-item season progress (planned vs placed, attributed by
   `source_plan_item_id`, date-aware in the Designer sidebar), rotation warnings per bed.

**Garden Snapshot** (Plan → Snapshot, also embedded on the Dashboard): pick any date and see
exactly what is in the ground on that date — `GET /api/garden-planner/garden-snapshot?date=…`
aggregates active PlantedItems (planted ≤ date, not yet harvested by date, seed-saving plants
extended to seed maturity) by plant+variety with per-bed quantities.

## 3.4 Garden Designer (the grid)

**File:** `frontend/src/components/GardenDesigner.tsx` (~4,600 lines) + 20 subcomponents in
`GardenDesigner/`. This is the most interaction-dense screen; full-viewport.

**Two modes:**
- **Overview** — `BedOverviewGrid` of `BedThumbnail` cards: mini-render of every bed, stats,
  click-through to detail. `BedSummaryCard` shows per-bed occupancy/summary.
- **Bed detail** — an SVG grid of the selected bed (zoom + pan), one cell per grid unit,
  column letters / row numbers, plant icons per cell with status badges and quantity
  indicators, spacing-buffer shading around multi-cell plants (circular buffer — a plant with
  24″ spacing shades every cell whose center is within 24″, mirroring how plants really
  spread; `footprintCalculator.ts::calculateSpacingBuffer`).

**Bed management:** BedFormModal — name, width/length, height (raised-bed presets with
soil-volume guidance from `raisedBedHeight.ts`), sun, soil, mulch, planning method (sets grid
size), permaculture zone, season-extension layers. Bed delete requires typing `delete`
(confirmation string) because it cascades hard (§6 gardens_bp).

**Plant Palette** (`common/PlantPalette.tsx`): searchable plant list with **readiness
tinting** (each plant validated for "can I plant this today?" via
`POST /api/validate-plants-batch` — soil temp + frost checks) and a **Quick Harvest filter**
("show me crops I could still harvest within N days"), which also feeds the future-plantings
overlay window.

**Placement flows:**
- **Drag-and-drop** a palette plant onto a cell (`@dnd-kit`; pointer-event tracked — a
  documented gotcha is that `mousemove` alone is unreliable during dnd-kit drags).
- **PlantConfigModal** opens before commit: variety picker (from your seeds), quantity,
  planting date, planting style, seed-density fields where applicable, **MIGardener row
  mode** (physical row number snapping via 3″ grid), **row continuity** (placing seeded row
  segments adjacent to existing ones links them into a `row_group_id` chain with a
  user-facing message), trellis binding for vining crops, and **auto-placement** ("place 12
  more like this": `autoPlacement.ts` walks the grid in a fill direction, skipping occupied/
  buffered cells).
- **Batch placement** — multiple positions in one `POST /api/planted-items/batch` (shares a
  succession_group_id).
- **Server-side conflict validation** on every placement: spatial + temporal overlap → 409
  with details; the UI surfaces a ConflictWarning and offers override.
- **Transplant mode**: arriving from Indoor Starts ("transplant this tray"), the grid enters
  a placement mode that calls `POST /api/indoor-seed-starts/<id>/transplant` and links
  everything.
- **Sidebar — PlannedPlantsSection**: the active plan's items for this bed with **date-aware
  progress** ("X/Y" where Y = plants expected in-ground on the currently viewed date given
  succession starts + DTM, X = placed items attributed by `source_plan_item_id`; full-season
  totals shown alongside). Placing from the sidebar increments exactly that plan item
  (designer-sync, §4.7).
- **Guilds**: GuildSelector/GuildPreview place a pre-designed companion group (e.g., Three
  Sisters) as a unit.

**Date filter & future overlay:** a single date filter (today = actuals; any future date =
projection). `FuturePlantingsOverlay` renders scheduled-but-not-placed PlantingEvents as
dashed green circles with a FUTURE badge on origin cells and lighter buffer cells; toggle
defaults off; quick-harvest filter narrows it to events starting within the window.

**Lifecycle actions on a placed plant** (click a cell): edit (variety/date/quantity/notes),
**move** (drag to a new cell or bed — `bulk-move` validates conflicts per move), **skip**
(soft-cancel with undo), delete (hard, cascades to its event/start/harvests), **harvest**
(HarvestPlantModal: date, quantity, unit, quality, notes → creates a HarvestRecord and
completes the linked event), **bulk harvest** (BulkHarvestModal: all items of a plant in the
bed at once; the resulting records share a `harvest_group_id`), **save for seed**
(SetSeedDateModal: compute/enter seed maturity date) and **collect seeds**
(CollectSeedsModal: count + date, optionally creating a homegrown seed-inventory row).
A **group quantity correction** (PATCH planted-item-groups/quantity) lets you reduce the
displayed count of a plant group, cancelling the excess items and re-syncing event
quantities.

**WeatherAlertBanner**: bed-level alerts (frost/heat risk for what's planted there, factoring
season-extension protection offsets).

## 3.5 Planting Calendar

**Files:** `frontend/src/components/PlantingCalendar/` (index ~600 lines + CalendarGrid/,
TimelineView/, ListView/, CropsSidebar/, AddCropModal/, SoilTemperatureCard/ + 4 modals).

**Three views** of the user's PlantingEvents (fetched via `GET /api/planting-events`):

- **Month grid** (CalendarGrid): day cells with event markers (seed-start, transplant,
  direct-seed, harvest, plus non-planting garden events), grouped markers for busy days
  (GroupedEventsModal), a DayDetailModal listing the day's events, and an EventDetailModal
  for one event (view/edit; shows an `indoorSeedStartStatus` overlay telling you whether the
  event's indoor side is tracked, plan-only, or absent).
- **Timeline** (TimelineView): horizontal bars per crop across the season (planting →
  harvest spans), making succession overlap and bed contention visible; conflict details pop
  a ConflictDetailsModal; an AvailableSpacesView surfaces open space windows.
- **List** (ListView): sortable/filterable table — this is the view dashboard deep-links
  force, so a focused event is always findable.

**CropsSidebar**: search + filters (plant, bed, status) + sort, shared across views.

**Creating events:**
- **AddCropModal** — pick plant (and variety), seed vs transplant method,
  dates (auto-suggested from frost dates via `dateCalculations.ts`:
  seed start = transplant − weeksIndoors, harvest = plant date + DTM), a **SuccessionWizard**
  (suggested interval + count with reasoning from `successionCalculations.ts`), an optional
  **PositionSelector** (bed + cell with live conflict checking), and an
  **AutoAdjustmentModal** when validation suggests shifting dates.
- **AddGardenEventModal** — non-planting events: mulch / fertilizing / irrigation etc.,
  stored as PlantingEvents with `event_type` + JSON `event_details` (validated server-side
  for known types).
- **AddMapleTappingModal** + **MapleTappingSeasonCard** — tap-count/sap tracking events plus
  a season-readiness card driven by `GET /api/maple-tapping/season-estimate` (freeze-thaw
  cycle detection from the forecast).

**SoilTemperatureCard** (also the Grow → Soil Temperature destination): current estimated
soil temperature at three depths, a 16-day forecast, a **ReadinessIndicator** per crop
(ready / risky / too cold for seed vs transplant mode), and a SoilConfigForm (soil type, sun,
mulch, location) feeding `GET /api/soil-temperature` (§4.4).

**Cold-risk overlays**: events get too-cold/marginal/too-hot badges from validation, and
forward-looking cold danger (§4.4) warns when a *future* planned date has a historical
freeze risk after germination.

## 3.6 Indoor Seed Starts

**Files:** `frontend/src/components/IndoorSeedStarts.tsx` + `IndoorSeedStarts/` (3 modals).

- **Cards** for every IndoorSeedStart: plant/variety, seeds started vs germinated (with
  actual germination % once recorded), status badge
  (planned → seeded → germinating → growing → ready → transplanted), location
  (windowsill/grow-lights/heat-mat/greenhouse), expected vs actual germination and
  transplant dates, destination-bed chips, and a **garden-sync line** ("plan expects N — in
  sync / mismatch warning") computed by the model's plan-matching logic (§4.9).
- **Filters**: status (dashboard focus forces 'all'), destination bed.
- **Plan-only seedings banner**: `GET /api/planting-events/needs-indoor-starts` lists
  calendar events that *should* have an indoor tray but don't. Banner shows count + timing
  status per row (good / urgent / past), **Start tracking** (creates the IndoorSeedStart via
  `POST /api/indoor-seed-starts/from-planting-event`), and client-side dismiss.
- **Actions per start**: edit (EditSeedStartModal — dates recalc when start date moves,
  germination logging, status), **transplant** (jumps to the Designer in transplant mode),
  **mark failed** (FailedSeedStartDialog with cascade choice: convert the linked event to
  direct-seed, or abandon it), skip/cancel (soft), delete (hard, cascades),
  **ImportFromGardenModal** (bulk-create starts from needs-indoor-starts).
- **Quantity helper**: `POST /api/indoor-seed-starts/calculate-quantity` — seeds to start =
  desired plants ÷ germination rate × 1.15 safety buffer; germination-history prediction
  (§4.9) refines expected germination days from your own past data.

## 3.7 Seeds Hub

**Files:** `SeedsHub.tsx` (tab container) → `MySeedInventory.tsx` and `SeedCatalog.tsx` +
`SeedInventory/` modals.

- **My Inventory**: your SeedInventory rows — search, filters (plant, expiring soon, low
  stock), sort; AddSeedModal / EditSeedModal expose every field incl. the **14 agronomic
  overrides**, packet math (quantity × seeds_per_packet − seeds used by starts =
  seedsAvailable), price, location, brand; homegrown seeds show provenance (which plant they
  were saved from). **CSV import** (CSVImportModal → `POST /api/seeds/import`, header-aliased
  parser with per-row error reporting) and a CSV export; **SeedImportModal** imports
  varieties (`POST /api/varieties/import`).
- **Seed Catalog**: the global (admin-curated, `is_global`) seed list — browse/filter,
  **Add to my inventory** (AddFromCatalogModal clones the entry, keeping `catalog_seed_id`),
  and per-seed **Sync from catalog** (refreshes agronomic fields, stamps `last_synced_at`).

## 3.8 Harvest Tracker

**Files:** `HarvestTracker.tsx` + `HarvestTracker/` (Log/Edit modals).

Stats header (total yield, counts, quality mix via `GET /api/harvests/stats`) over a
filterable/sortable table of HarvestRecords (date, plant, variety, quantity, unit, quality,
notes). LogHarvestModal creates standalone records (`POST /api/harvests`); records created
from the Designer arrive pre-linked to their PlantedItem/PlantingEvent and sync completion
backwards. Bulk harvests share a `harvest_group_id`. Dashboard "harvest ready" clicks land
here with filters cleared (signal rows reference PlantingEvents, which don't map 1:1 to
HarvestRecord rows — an intentional design noted in Appendix A).

## 3.9 Compost Tracker

**File:** `CompostTracker.tsx`. Piles (name, location, dimensions, status
building → cooking → curing → ready, temperature, moisture, **C:N ratio**) with: add pile,
**add ingredient** (pick a material from the 15-entry COMPOST_MATERIALS table or custom;
backend recomputes the pile's weighted C:N), **log turn** (updates `last_turned` — the
dashboard nags when piles go 7+ days unturned), edit, delete. Deep-link focus highlights a
pile (`focusPileId`).

## 3.10 Photo Gallery

**Files:** `PhotoGallery.tsx` + Upload/Edit modals. Grid of photos with caption, date,
optional links to a plant, bed, or specific PlantedItem, and a category
(garden/plant/harvest/pest). Upload is multipart to `POST /api/photos` (stored under
`backend/static/uploads/`, 16 MB cap, png/jpg/jpeg/gif). Filter by date range/plant; edit
metadata; delete removes the file from disk too.

## 3.11 Livestock

**Files:** `Livestock.tsx` + `AnimalFormModal.tsx`. Category tabs:

- **Chickens** — flocks (name, breed, quantity, hatch date, purpose eggs/meat/dual, sex mix,
  status, coop location) + **daily egg production logging** (collected/sold/eaten/incubated)
  via `/api/egg-production`. The dashboard's "livestock actions due" fires when today's
  collection isn't logged.
- **Ducks/waterfowl** — same shape, separate model + `/api/duck-egg-production`.
- **Beehives** — hive (type Langstroth/TopBar/Warré, install date, queen marked + color,
  status) with **inspections** (queen seen, eggs, brood pattern, temperament, population,
  stores, pests, actions) and **honey harvests** (frames, honey lbs, wax lbs).
- **Other livestock** — general animals (species, breed, tag, birth date, sex, purpose,
  sire/dam, weight, status) with **health records** (vaccination/deworming/illness/injury/
  checkup, medication, dosage, vet, cost, next due date).

Deep-link focus auto-switches to the category owning the focused element
(`FOCUS_TYPE_TO_CATEGORY`). Egg/animal production feeds the nutrition dashboard via breed
production-rate data.

## 3.12 Property Designer

**Files:** `PropertyDesigner.tsx` + PropertyFormModal, StructureFormModal, TrellisManager.

- **Properties**: the homestead lot(s) — name, dimensions (feet), address (validated +
  geocoded via `POST /api/properties/validate-address`), lat/lon, USDA zone, soil, slope,
  and optional per-property frost-date overrides.
- **The map**: an SVG canvas of the property where you **drag structures** from the 75-entry
  structures catalog (10 categories: buildings, livestock housing, water, storage, orchard
  trees, etc.). Placement runs **collision validation** (`collision_rules/validator`:
  overlap rules, containment — e.g., what may sit inside what), live position feedback,
  rotation (0/90/180/270), custom dimensions, circle shapes for **trees** (canopy
  diameter; fruit/nut trees live here rather than in garden beds and contribute to the
  nutrition "trees" source). Your garden beds also appear as placeable structures
  (`garden-bed-{id}`), linking the bed layout into the property map.
- **TrellisManager**: CRUD for TrellisStructures (type fence/arbor/A-frame/post-wire/
  espalier, geometry start/end points or length, height, wire spacing/count), attached to a
  property or directly to a bed; capacity view shows allocated vs free linear feet.

## 3.13 Nutritional Dashboard

**File:** `NutritionalDashboard.tsx`. Year selector → `GET /api/nutrition/dashboard?year=`:
total projected calories/protein/carbs/fat/fiber/vitamins/minerals from three sources
(**garden** yields × per-100g baseline data, **livestock** via breed production rates,
**trees**), RDA percentages, **person-days** ("this harvest feeds one person for N days"),
per-plant breakdown, a list of plants missing nutrition data, and CSV export. Custom
nutrition entries can be added/managed (`/api/nutrition/data`), including **importing from
USDA FoodData Central** (search + import by FDC id).

## 3.14 Weather Alerts

**File:** `WeatherAlerts.tsx`. Card list of current alerts (frost, freeze, heat, storm,
precipitation) with severity, date range, description; powered by `GET /api/weather/current`
and `/api/weather/forecast` (Open-Meteo). The same data feeds the dashboard tile and the
designer's bed banner.

## 3.15 Admin — User Management

**Files:** `AdminUserManagement/` (admin-only tab). User table (username, email, admin flag,
created, last login) with Add / Edit / Reset-password modals and delete-with-confirm. All
against `/api/admin/users*` (admin-gated). Deleting a user cascades to all their data.

## 3.16 Simulation toolbar

Floating widget (any screen): shows real vs simulated date, set-date picker, advance-by-N
days, clear. Backed by `/api/simulation/*`; the whole app re-reads "today" through
SimulationContext so views (designer date filter, dashboard, calendar) follow the simulated
clock.

## 3.17 Legacy server-rendered pages

`backend/templates/*.html` served by `pages_bp` directly from Flask (`/`,
`/garden-planner`, `/visual-designer`, `/planting-calendar`, `/weather`,
`/compost-tracker`, `/photos`, `/harvest-tracker`, `/seed-inventory`,
`/property-designer`, `/livestock`). These predate the React SPA and remain reachable by
browsing the backend port directly. As of Jun 2026 all data-bearing routes require login and
filter strictly by the current user (they previously leaked all users' data); `/` and
`/weather` render no data and stay public. They duplicate SPA functionality in older form —
kept deliberately, flagged in Appendix A as a "keep or retire" decision.

---

# 4. Core Engines & Business Rules

## 4.1 Space calculation (the most protected logic in the codebase)

**Backend:** `services/space_calculator.py::calculate_space_requirement(plant_id, grid_size,
planning_method)` · **Frontend twin:** `utils/gardenPlannerSpaceCalculator.ts::
calculateSpaceRequirement(plant, gridSize, planningMethod)` — **these must return identical
values** (CLAUDE.md critical constraint; 114 backend sync tests + 55 frontend tests +
cross-stack parity tests enforce it).

Per-method rules (result = square-foot-equivalent cells per plant, or per **seed** for
seed-density crops):

- **Square-foot**: lookup in the SFG table (`sfg_spacing.py` / `sfgSpacing.ts`, 52+ entries
  with variety→prefix→ancestor fallback): 0.5 (melons — 2 squares each), 1 (tomato, pepper,
  broccoli…), 4 (lettuce, chard…), 8, 9 (bush beans, spinach…), or 16 (carrots, radishes)
  plants per square → cells = 1/per-square (e.g., 16/sq → 0.0625 cells each).
- **Row**: row spacing × within-row spacing ÷ 144.
- **Intensive**: hexagonal packing — on-center spacing² ÷ 144, with the hex efficiency
  factor (rows offset by 0.866; ~15% denser than square packing) applied where cells are
  derived (`calculate_intensive_cells_required` ≈ ceil(squareCells × 1/1.15)).
- **MIGardener**: per-crop overrides (54 entries, three categories): row-based seed-density
  crops (cells **per seed** = 1 / seeds-per-sqft, where seeds/sqft = rows-per-foot ×
  seeds-per-row-foot), intensive-style crops (null row spacing), and traditional spacing
  crops; unknown plants fall back to 0.25× standard spacing.
- **Trellis crops** bypass area math entirely: `effectiveQuantity × linearFeetPerPlant`
  linear feet (§2.5), not counted against bed cells.
- Fallback for anything unresolvable: 1 cell.

The frontend additionally computes per-bed breakdowns, seed-row optimization, and the
planner's method-by-method utilization summary.

## 4.2 Conflict detection (can these two plantings coexist?)

**File:** `backend/conflict_checker.py` (mirrored client-side for instant feedback).

- **Spatial**: Chebyshev-style distance on the bed grid using each planting's effective
  footprint (spacing capped at grid size for SFG so only same-cell collisions count there).
- **Temporal**: date-range overlap of [start, expected end] for both plantings — strict
  inequality, so back-to-back sequences (B starts the day A ends) are *not* conflicts. This
  is what makes succession planting in the same cells legal.
- **Candidates**: `query_candidate_items` reads **PlantedItems** (ground truth, can't be
  orphaned) in the bed for the user; proposed events are compared against them plus, in
  export preview, against other prospective events.
- **Enforcement**: every placement/creation path calls `validate_planting_conflict` →
  HTTP 409 with conflict details unless `conflict_override=true` is passed (the override is
  stored on the event). A read-only `POST /api/planting-events/check-conflict` powers
  pre-flight UI checks, and `GET /api/planting-events/audit-conflicts` scans everything for
  anomalies (debug tool).
- A **sun-exposure warning** rides along (plant's needs vs bed's exposure) without blocking.

## 4.3 Crop rotation

**File:** `services/rotation_checker.py`. A 3-year family window: planting a crop whose
botanical family appeared in the same bed within the last 3 years yields
`{has_conflict, conflict_years, last_planted, family, recommendation, safe_year}`.
`suggest-beds` ranks all beds by rotation safety; `bed-history` lists what grew where.
Limitations are documented (CLAUDE.md): it ignores intervening cover crops and intercropping
and can produce false positives — flagged, not blocking.

## 4.4 Planting-date validation: frost, soil temperature, forward cold danger

- **Frost** (`season_validator.py` + `frost_date_lookup.py`): each plant has a frost
  tolerance (very-tender → very-hardy). Tender plants planted before the last spring frost
  (or after the first fall frost) get warnings; **season-extension protection offsets**
  (cold frame, row cover, etc. → +°F) can downgrade a warning to "mitigated" info.
  Frost dates resolve through a chain: property's explicit dates → property zone →
  ZIP→zone (phzmapi.org) → default zone 5b (Apr 15 / Oct 15), from a 22-zone table.
- **Soil temperature** (`soil_temperature.py`, surfaced by `GET /api/soil-temperature`):
  base temperature comes from Open-Meteo *measured* soil temps at 0 cm / 6 cm / 18 cm
  (mapped to planting depths: <0.5″ → 0 cm, 0.5–3″ → 6 cm, >3″ → 18 cm), falling back to an
  **estimation model** when offline: air temperature adjusted by soil type (sandy warms
  faster, clay slower), sun exposure, mulch type (dark absorbs, light reflects, organic
  insulates), seasonal lag, and season-extension offsets. Per-plant **crop readiness**
  compares the depth-appropriate soil temp against the seed's/plant's `soil_temp_min`
  (transplants use a relaxed ~80% threshold, min 40°F) → ready / risky / too cold, today and
  across a 16-day forecast (seed mode vs transplant mode).
- **Forward cold danger** (`forward_planting_validator.py`): for a *future* planned date, it
  checks historical daily temperature curves for a freeze likely to hit after germination —
  "don't plant yet; a cold snap typically lands in week 6" — returning risk days and
  suggested protection.
- All of this is bundled by `POST /api/validate-planting` (one planting) and
  `POST /api/validate-plants-batch` (palette tinting), and date *suggestions* (earliest safe
  date, optimal window) are computed for the AutoAdjustment flow.

## 4.5 The quantity engine (what "Calculate" does)

**File:** `services/garden_planner_service.py::calculate_plant_quantities`.

For each selected seed: resolve the plant; compute per-plant space cost (§4.1); apply the
**strategy** — `maximize_harvest` (fill available space), `use_all_seeds` (plant everything
you own), `balanced` (≈70% of space, diversity-weighted) — capped by seeds on hand and any
**manual quantity override**; decide **succession** (per-seed preference or plan default,
suitability from DTM, interval ≥ 14 days, count 1–8) and stamp first/last plant dates +
harvest windows; compute **seeds required** = ceil(target ÷ (germination rate × survival
rate) × 1.15 buffer), where germination = seed override → plant default → 85%, and survival
depends on method (direct seed 0.75, transplant 0.90, indoor start 0.95, MIGardener
override when present). Output: plan items + a space summary (used/available/utilization,
per-method breakdown) + rotation warnings.

## 4.6 Export to calendar (plan → schedule), idempotently

**File:** `garden_planner_service.py::export_to_calendar` (+ `preview_export_conflicts`).

Three paths per plan item:
1. **Bed-allocated** (normal): for each `bedAssignments` entry and each succession index,
   create/update a PlantingEvent with quantity from the **integer remainder distribution**,
   dates offset by `succession_interval_days × i`, `seed_start_date` back-computed from
   `weeksIndoors` for transplant crops, and an **export_key** of the form
   `"{user}_{item}_{bed}_{plantDate}_{successionIndex}"`.
2. **Trellis**: same, but allocating linear feet and assigning sequential
   `trellis_position_start/end_inches` segments (bounds-validated against the trellis).
3. **Legacy** (no assignments): single-bed fallback from `beds_allocated`.

Re-export matches existing events by export_key and **updates** them (counts reported as
created vs updated). `preview_export_conflicts` builds the same events in memory and checks
new-vs-new and new-vs-existing overlaps → the 409 preview the UI shows before committing.
Items flip to `status='exported'`; bulk-deleting a plan's events flips them back to
`planned`.

## 4.7 Designer-sync (keeping the plan honest while you freestyle)

`POST /api/garden-plans/<id>/designer-sync`: when you place or remove plants in the Designer
outside the plan flow, the active plan absorbs it — matching plan item found → its
bed_assignments quantity adjusts; none found → an `status='auto'` plan item is created (and
decremented/deleted on removal). This keeps season-progress numbers meaningful even for
ad-hoc planting.

## 4.8 The dashboard signal engine

**File:** `services/dashboard_service.py::build_dashboard_today` (~1,300 lines). For a
target date (param → simulated clock → real today), it builds:

| Signal | Trigger | Aging rule |
|---|---|---|
| `harvestReady` | event has quantity, `expected_harvest_date ≤ today`, harvest not recorded | never hides; demotes with `isStale` after ~14 days; rows grouped by date+plant+variety+bed (multi-event ids) |
| `indoorStartsDue` | `seed_start_date ≤ today`, no completed/linked start (event path + start path) | active ≤14 days; older → **missed** bucket |
| `transplantsDue` | `transplant_date ≤ today`, not complete; suppressed if the linked indoor start was never actually started (guards nagging for impossible transplants) | active/missed split (~10 days) |
| `directSeedDue` | `direct_seed_date ≤ today`, not complete | active/missed split |
| `placePlantedItem` | PlantedItem status `planned`, `planted_date ≤ today` (confirm you actually planted it) | 14-day staleness |
| `germinationCheck` | direct-seeded event reaches seed date + germination days | silently drops after 14 days |
| `indoorGerminationCheck` | indoor start (or start-less event) reaches expected germination | deduped across the two paths via linked-event ids |
| `frostRisk` / `rainAlert` | forecast ≤33°F in 24 h / ≥0.5″ precip in 48 h (simulation-aware weather) | n/a |
| `compostOverdue` | pile not turned in 7 days | n/a |
| `seedLowStock` / `seedExpiring` | <2 packets / expires within 30 days | n/a |
| `livestockActionsDue` | today's egg collection not yet logged for active flocks | n/a |

Every row carries a **signalKey** (stable, prefixed string) used for snoozing
(DashboardSnooze upsert; "forever" = year-9999 sentinel) and for deep-link identity. The
aging/missed logic is **display-layer only** — nothing mutates the underlying records.

## 4.9 Indoor-start ↔ plan synchronization & germination learning

- `IndoorSeedStart.get_current_garden_plan_count()` answers "how many does the plan expect?"
  by matching PlantingEvents (or plan items) on plant + variety + transplant-date window,
  resolving destination beds three ways: manual `destination_bed_ids` → linked event's bed →
  inference from plan items. The UI shows in-sync/mismatch and where the seedlings are
  headed; `get_placed_count_for_destination_beds()` counts what's already in the ground.
- Placement heuristics: placing a plant that matches an unplaced indoor start (same plant +
  variety, date within ±14 days) **links and transplants** that start instead of creating a
  duplicate; placing a transplant-type crop with no start auto-creates one when appropriate.
- **Germination history** (`GET /api/germination-history[/<plant>/prediction]`): your own
  recorded germination outcomes aggregate into average days + success rate per plant and
  feed predicted germination dates for new starts.

## 4.10 Seed saving & maturity learning

- Seed-saving lifecycle is described in §2.9 (toggle → maturity date → collect).
- **Maturity learning** (migration `a7f3c9d21e04`): every harvest can capture feedback
  (`maturity_feedback`, `outcome_reason`) plus context snapshots (days in ground, planted
  date, variety, sun exposure, covered, bed). These accumulate into
  **variety_maturity_model** — a learned DTM per (user, plant, variety, sun, covered) with
  sample counts — refining future harvest-date predictions beyond the static plant database.

## 4.11 Nutrition computation

**Files:** `services/nutritional_service.py`, `breed_service.py`, `data/
baseline_nutrition.csv` (≈39 crops with per-100g nutrients + yield/sqft),
`data/breed_production_rates.json`. Garden: projected/actual yields × baseline (or
user-imported USDA) nutrient profiles. Livestock: flock sizes × breed production rates
(eggs/meat/milk) × nutrient profiles. Trees: orchard structures × yield estimates. Combined
into totals, per-source and per-plant breakdowns, RDA %, person-days. Missing-data plants
are listed so the user can import USDA entries.

## 4.12 Placement helpers (Designer micro-engines)

- **Footprints** (`footprintCalculator.ts`): circular spacing buffer — all cells whose
  center is within the plant's spacing radius, in every direction, negative coords clipped.
- **Auto-placement** (`autoPlacement.ts`): row-major or column-major walk placing N plants
  in the first valid cells (respecting buffers, method-aware spacing).
- **Row continuity** (`rowContinuity.ts`): adjacent seeded segments of the same crop merge
  into a `row_group_id` chain with segment indexes — the basis for treating a 4-cell lettuce
  row as one logical row.
- **MIGardener row mapping** (`PlantConfigModal` + event `row_number`): display rows snap to
  physical rows from row spacing on the 3″ grid.
- **Distribution** (`designerHelpers.distributePlantsAcrossCells`): spreading a quantity
  over a set of cells for batch placement.

---

# 5. Data Model Reference

**File:** `backend/models.py` — **26 models**. All user-owned models carry an indexed
`user_id` FK to `users`; child collections cascade `all, delete-orphan` from their parents;
every model has a `to_dict()` that converts snake_case columns to camelCase for the API.

## 5.1 Models by domain

### Identity & configuration
| Model | Purpose & key fields |
|---|---|
| **User** | Auth + ownership root. `username`/`email` (unique, indexed), `password_hash`, `is_admin`, `created_at`, `last_login`. `set_password`/`check_password`. Deleting a user cascades to everything they own. |
| **Settings** | Per-user key-value store (`UNIQUE(user_id, key)`), static `get_setting`/`set_setting`. Used for backend defaults; has no dedicated UI (Appendix A). |
| **DashboardSnooze** | `signal_key` + `snooze_until` per user (`UNIQUE(user_id, signal_key)`); forever = 9999-12-31 sentinel. |

### Property & structures
| Model | Purpose & key fields |
|---|---|
| **Property** | The lot: name, width/length (ft), address, lat/lon, USDA `zone`, soil, slope, optional `last_frost_date`/`first_frost_date` overrides, notes. Cascades PlacedStructures. `to_dict` includes acreage. |
| **PlacedStructure** | A catalog structure placed on a property: `structure_id` (string ref into the structures catalog, or `garden-bed-{id}`), optional `garden_bed_id` link, `position_x/y`, `rotation` (0/90/180/270), `shape_type` (rectangle/circle), optional `custom_width/length`, `built_date`, `cost`. Effective dimensions via `get_width()/get_length()/get_diameter()`. |
| **TrellisStructure** | Linear trellis: type (fence/arbor/a-frame/post_wire/espalier), geometry (`start_x/y`–`end_x/y` → Pythagorean `total_length_feet/inches`), `height_inches` (default 72), wire spacing/count; attachable to a property and/or a bed (both nullable). |

### Garden infrastructure
| Model | Purpose & key fields |
|---|---|
| **GardenBed** | width/length (ft), `height` (in, default 12), location, `sun_exposure`, `soil_type`, `mulch_type`, `planning_method`, `grid_size` (in/cell), `season_extension` (JSON), permaculture `zone`. Cascades PlantedItems; `to_dict` filters out cancelled items and parses season_extension. |

### The plant lifecycle trio (see §5.2)
| Model | Purpose & key fields |
|---|---|
| **GardenPlan** | Season plan container: name, `season`, `year`, `strategy`, `succession_preference` ('0'–'8', legacy strings normalized), target totals, notes. Cascades items. |
| **GardenPlanItem** | One crop target: `plant_id`, `variety`, optional `seed_inventory_id`, `unit_type` (plants/row_ft/area_sqft/cells) + `target_value` + normalized `plant_equivalent`, `seeds_required`/`seed_packets_required`, succession (`succession_enabled/count/interval_days`, `first/last_plant_date`, `harvest_window_start/end`), **`bed_assignments`** (JSON `[{bedId, quantity}]` — source of truth) + `allocation_mode` (even/custom) + legacy `beds_allocated`, `trellis_assignments` (JSON ids), `space_required_cells`, `status` (planned/exported/auto), `export_key`, `source` (manual vs 'indoor-seed-start') + `indoor_seed_start_id`. |
| **PlantingEvent** | The schedule entry — the widest model. Identity: `event_type` ('planting' default; or mulch/fertilizing/irrigation/maple-tapping with JSON `event_details`), `plant_id`, `variety`, `garden_bed_id`. Dates: `seed_start_date`, `transplant_date`, `direct_seed_date`, `expected_harvest_date`, `actual_harvest_date`. Succession: flag, interval, `succession_group_id` (UUID, indexed). Position/space: `position_x/y`, `space_required`, `conflict_override`. Quantity model: `planting_method` (individual_plants/seed_density), `quantity`, `spacing`, `planting_style` (row_based/broadcast/dense_patch/plant_spacing) and style-specific seed fields (`seed_count`, `seed_density`, `ui_segment_length_inches`; `seed_density_per_sq_ft`, `grid_cell_area_inches`; `seeds_per_spot`, `plants_kept_per_spot`), expectations (`expected_germination_rate/survival_rate/final_count`), `harvest_method`. Rows: `row_group_id` (UUID), `row_segment_index`, `total_row_segments`, `row_number`. Trellis: `trellis_structure_id`, `trellis_position_start/end_inches`, `linear_feet_allocated` (+ CHECK constraints: start ≥ 0, end > start, both-or-neither, qty_completed ≤ qty). Completion: `completed`, `quantity_completed`, `harvest_completed`; **property `is_complete`** is canonical. Lifecycle: `cancelled_at` (soft delete), `export_key` (idempotency), notes. *Note: no `status` and no `planted_date` columns — those live on PlantedItem.* |
| **PlantedItem** | The placed plant: `plant_id`, `variety`, `garden_bed_id`, `planted_date`, `transplant_date`, `harvest_date`, `position_x/y`, `quantity`, `status` (planned/seeded/transplanted/growing/harvested/saving-seed), **`source_plan_item_id`** (FK → plan item), seed-saving fields (`save_for_seed`, `seed_maturity_date`, `seeds_collected`, `seeds_collected_date`), `cancelled_at`, notes. |
| **IndoorSeedStart** | The indoor tray: plant/variety, optional `seed_inventory_id`, dates (start, expected/actual germination, expected/actual transplant), counts (`seeds_started`, `seeds_germinated`, expected/actual germination rate), conditions (location, light hours, temperature), `status` (planned→seeded→germinating→growing→ready→transplanted), `transplant_ready`, `hardening_off_started`, `destination_bed_ids` (JSON, NULL = infer from plan), **`planting_event_id`** (FK → outdoor event), `cancelled_at`. Heavy computed helpers: `get_current_garden_plan_count()` (plan matching, §4.9), `get_placed_count_for_destination_beds()`, `has_planned_placement()`, `actual_germination_days`. |

### Seeds
| Model | Purpose & key fields |
|---|---|
| **SeedInventory** | A seed packet OR a global catalog row (`user_id` NULL + `is_global`). Core: plant/variety/brand, `quantity` (packets), `seeds_per_packet` (default 50), purchase/expiration dates, germination_rate, location, price, notes. Catalog linkage: `catalog_seed_id` (self-FK) + `last_synced_at`. Provenance: `source_planted_item_id` + `is_homegrown`. Plus the **14 nullable agronomic overrides** (§2.1). `get_seeds_used()` sums linked starts' seeds_started → `seedsAvailable` in to_dict. |

### Harvest & learning
| Model | Purpose & key fields |
|---|---|
| **HarvestRecord** | One harvest: plant, optional `planted_item_id`, date, quantity + unit (lbs/oz/count), quality (excellent→poor), notes, **`harvest_group_id`** (UUID for bulk harvests). Maturity-learning snapshots (all nullable): `maturity_feedback`, `outcome_reason`, `days_in_ground`, `planted_date_snapshot`, `variety_snapshot`, `sun_exposure_snapshot`, `covered_snapshot`, `garden_bed_id_snapshot`. |
| *(table)* **variety_maturity_model** | Created directly by migration `a7f3c9d21e04` (no Python class): learned DTM per `UNIQUE(user_id, plant_id, variety, sun_exposure, covered)` with `sample_count`, `last_recomputed`. |

### Livestock & apiary
| Model | Purpose & key fields |
|---|---|
| **Chicken** | Flock row: name, breed, `quantity`, hatch_date, purpose (eggs/meat/dual), sex mix, status, coop location. `get_age_weeks()`. Cascades EggProduction. |
| **EggProduction** | Per-day: `eggs_collected/sold/eaten/incubated`, notes. |
| **Duck** / **DuckEggProduction** | Waterfowl twins of the above (note: DuckEggProduction's FK column is named `chicken_id` for frontend compatibility — a documented quirk). |
| **Beehive** | name, type (Langstroth/TopBar/Warré…), install date, `queen_marked` + `queen_color`, status (active/swarmed/dead/combined), location. Cascades inspections + harvests. |
| **HiveInspection** | queen_seen, eggs_seen, brood_pattern, temperament, population, honey_stores, pests_diseases, actions_taken. |
| **HoneyHarvest** | frames_harvested, honey_weight (lbs), wax_weight (lbs). |
| **Livestock** | General animal: species, breed, tag_number, birth_date, sex, purpose, `sire`/`dam`, status, location, weight. `get_age_months()`. Cascades HealthRecords. |
| **HealthRecord** | type (vaccination/deworming/illness/injury/checkup), treatment, medication, dosage, veterinarian, cost, `next_due_date`. |

### Compost, media, nutrition
| Model | Purpose & key fields |
|---|---|
| **CompostPile** | name, start_date, location, dimensions, `last_turned`, `estimated_ready_date`, temperature, moisture (dry/ideal/wet), **`cn_ratio`** (default 30.0), status (building/cooking/curing/ready). Cascades ingredients. |
| **CompostIngredient** | name, amount (cu ft), type (green/brown), added_date, cn_ratio — pile C:N recomputed on add. |
| **Photo** | filename + filepath (under static/uploads), uploaded_at, optional `plant_id` / `garden_bed_id` / `planted_item_id` links, caption, category (garden/plant/harvest/pest). |
| *(table)* **nutritional_data** | **Not a SQLAlchemy model** — a raw-SQL table managed directly by `services/nutritional_service.py` via sqlite3: per-food nutrient profile (per 100g) + yield factors; global rows or per-user custom/USDA-imported entries (managed via `/api/nutrition/data`). Together with `variety_maturity_model`, one of two tables living outside the ORM. |

## 5.2 The linking fields (how everything connects)

| Link | From → To | Nature | Meaning |
|---|---|---|---|
| `source_plan_item_id` | PlantedItem → GardenPlanItem | FK, indexed | the ONLY reliable plan-attribution for placed plants (progress counting) |
| `export_key` | PlantingEvent (and plan item) | indexed string | idempotent export identity: `user_item_bed_date_successionIdx` |
| `succession_group_id` | PlantingEvent ↔ PlantingEvent | UUID string (no FK!) | succession series membership — must always be queried WITH user_id |
| `row_group_id` (+ indexes) | PlantingEvent ↔ PlantingEvent | UUID string (no FK!) | adjacent row segments forming one logical row |
| `planting_event_id` | IndoorSeedStart → PlantingEvent | FK | the outdoor half of an indoor start |
| `indoor_seed_start_id` + `source` | GardenPlanItem → IndoorSeedStart | FK | plan items auto-created from a tray |
| `seed_inventory_id` | plan item / start → SeedInventory | FK (weak) | which packet is being used |
| `catalog_seed_id` + `last_synced_at` | SeedInventory → SeedInventory | self-FK | personal seed cloned from catalog |
| `source_planted_item_id` + `is_homegrown` | SeedInventory → PlantedItem | FK | saved-seed provenance |
| `planted_item_id` | HarvestRecord / Photo → PlantedItem | FK | what was harvested/photographed |
| `harvest_group_id` | HarvestRecord ↔ HarvestRecord | UUID string | one bulk-harvest action |
| `trellis_structure_id` + position inches | PlantingEvent → TrellisStructure | FK + CHECKs | reserved trellis segment |
| `garden_bed_id` | PlacedStructure → GardenBed | FK | bed drawn on the property map |
| `cancelled_at` | PlantingEvent / PlantedItem / IndoorSeedStart | timestamp | soft-delete ("skip") with undo |

**There is no `PlantingEvent.source_plan_item_id`** — events tie to plans only via
`export_key`; and PlantingEvent↔IndoorSeedStart are linked one-way from the start side.
Exporting a plan does **not** create IndoorSeedStarts (deliberate decision — the calendar
overlays `indoorSeedStartStatus` instead, and the "plan-only seedings" banner closes the
gap manually).

## 5.3 Serialization contract

Backend columns are snake_case; every `to_dict()` emits camelCase; inbound payloads are
camelCase and converted at the endpoint. Dates: JS sends ISO strings with `Z` — the backend
must always parse via `utils/helpers.py::parse_iso_date` (raw `fromisoformat` chokes on Z).
The frontend must always parse `YYYY-MM-DD` via `dateUtils.parseLocalDate` (naked
`new Date()` shifts a day in western timezones). `/api/plants` additionally normalizes the
plant database's few snake_case keys to camelCase in the HTTP layer only
(`data_bp._normalize_plant_keys`).

---

# 6. API Reference

**138 JSON API routes + 11 HTML page routes** (135 verified against the `@…route` decorators
at commit `9dfb056`; +3 calendar-feed routes added Jun 2026). Unless marked *(public)* or *(admin)*, every route requires login
(session cookie). Errors are `{error: "message", details?}` with appropriate status codes;
conflict-protected writes return **409** with conflict details.

## 6.1 auth_bp — `/api/auth` (5)
| Route | Purpose |
|---|---|
| `POST /register` *(public)* | Create account (username, email, password). |
| `POST /login` *(public)* | Start session. |
| `POST /logout` | End session. |
| `GET /me` | Current user profile. |
| `GET /check` | Auth status probe (also used by the SPA on boot). |

## 6.2 admin_bp — `/api/admin` (4, all *admin*)
| Route | Purpose |
|---|---|
| `GET /users` · `POST /users` | List (paginated) / create users. |
| `GET·PUT·DELETE /users/<id>` | Read / update (incl. is_admin) / delete-with-cascade. |
| `POST /users/<id>/reset-password` | Force-set a new password. |

## 6.3 data_bp — `/api` (7, reference data)
| Route | Purpose |
|---|---|
| `GET /plants` | All 118 plants (fruit/nut categories filtered out — those live in Property Designer), camelCase-normalized. |
| `GET /guilds` · `GET /guilds/<id>` | Companion-planting guilds (6). |
| `GET /plant-guilds` | Alias of the guild list (legacy callers). |
| `GET /bed-templates` · `GET /bed-templates/<id>` | 28 pre-designed bed layouts (used by the legacy visual designer's template picker). |
| `GET /structures` | 75 catalog structures + the user's own beds as placeable structures + categories. |

## 6.4 gardens_bp — `/api` (27; the workhorse)
**Beds**
| Route | Purpose |
|---|---|
| `GET·POST /garden-beds` | List / create beds (grid size derived from planning method). |
| `GET·PUT·DELETE /garden-beds/<id>` | Read / update / **hard-delete** (requires body `confirmation:"delete"`; cascades planted items, events, photos, bed trellises; scrubs references in seed provenance, indoor-start destinations, and plan bed_assignments; returns deletion counts). |
| `PATCH /garden-beds/<id>/planted-item-groups/quantity` | Downward-correct a plant group's quantity (cancels excess items, re-syncs event quantities). |

**Planted items (the grid)**
| Route | Purpose |
|---|---|
| `POST /planted-items` | Place one plant. Side effects: conflict validation (409), auto-create/complete matching PlantingEvent, heuristic link-or-create IndoorSeedStart for transplant crops, plan attribution via sourcePlanItemId. |
| `POST /planted-items/batch` | Place many positions at once (shared succession_group_id; same side effects per item; all-or-nothing transaction). |
| `POST /planted-items/bulk-move` | Move items across cells/beds with per-move conflict checks. |
| `PUT·PATCH·DELETE /planted-items/<id>` | Update (syncs variety to linked event) / partial update / hard-delete with cascades. |
| `POST /planted-items/<id>/collect-seeds` | Seed-saving completion (counts, date, optional auto seed-inventory row). |
| `POST /planted-items/<id>/cancel` · `/uncancel` | Soft skip / restore. |
| `DELETE /garden-beds/<id>/planted-items` · `…/date/<date>` · `…/plant/<plant_id>` | Bulk clears: whole bed / by planting date / by plant. |

**Planting events (the schedule)**
| Route | Purpose |
|---|---|
| `GET·POST /planting-events` | List (filters: bed, status, year, date ranges) / manual create with conflict validation. |
| `GET·PUT·DELETE /planting-events/<id>` | Read / update (re-validates conflicts) / delete. |
| `POST /planting-events/<id>/cancel` · `/uncancel` | Soft skip / restore. |
| `POST /planting-events/bulk-delete` | Bulk soft-delete; unlinks indoor starts; reverts plan items to `planned` when their last event goes. |
| `POST /planned-items/unassigned/bulk-delete` | Purge exported events that never got a bed. |
| `PATCH /planting-events/<id>/harvest` | Mark harvested (sets harvest_completed, actual date, quantity_completed; auto-creates a HarvestRecord). |
| `PATCH /planting-events/<id>/variety` | Variety change, synced to linked items/starts/plan rows. |
| `PATCH /planting-events/<id>/switch-to-direct-seed` · `PATCH /planting-events/bulk-switch-to-direct-seed` | Convert failed-transplant events to direct seeding (clears transplant date, recomputes harvest, unlinks the start). |
| `PATCH /planting-events/bulk-update` | Field updates across many events (e.g., bulk complete). |
| `POST /planting-events/check-conflict` | Read-only pre-flight conflict check. |
| `GET /planting-events/needs-indoor-starts` | Transplant events lacking a linked tray (powers the banner). |
| `GET /planting-events/audit-conflicts` | Diagnostic full-scan conflict report. |

## 6.5 garden_planner_bp — `/api` (16)
| Route | Purpose |
|---|---|
| `GET·POST /garden-plans` · `GET·PUT·DELETE /garden-plans/<id>` | Plan CRUD (items embedded). |
| `GET·POST /garden-plans/<id>/items` | Item list / add item. |
| `POST /garden-plans/calculate` | The quantity engine (§4.5). |
| `POST /garden-plans/<id>/optimize` | Recalculate an existing plan with new strategy/succession. |
| `GET /garden-plans/<id>/feasibility` | Space feasibility check. |
| `POST /garden-plans/<id>/export-to-calendar` | Idempotent export; 409 conflict preview unless `conflictOverride`. |
| `GET /garden-plans/<id>/shopping-list` | Seeds needed vs owned → packets to buy. |
| `GET /garden-plans/<id>/nutrition` | Plan-level nutrition projection. |
| `POST /rotation/check` · `POST /rotation/suggest-beds` · `GET /rotation/bed-history/<bed_id>` | Rotation engine (§4.3). |
| `GET /garden-plans/<id>/beds/<bed_id>/items` | Plan items assigned to one bed (sidebar data: per-bed quantity, succession fields, DTM). |
| `GET /garden-planner/season-progress` | Planned vs placed, by plant / bed / planItemId. |
| `GET /garden-planner/garden-snapshot?date=` | Point-in-time in-ground inventory. |
| `POST /garden-plans/<id>/designer-sync` | Absorb ad-hoc Designer adds/removes into the plan (§4.7). |

## 6.6 utilities_bp — `/api` (17)
| Route | Purpose |
|---|---|
| `POST /spacing-calculator` | Plants-per-bed math for a plant × bed × method. |
| `GET /soil-temperature` | Multi-depth soil temp + forecast + per-crop readiness (§4.4). |
| `GET /maple-tapping/season-estimate` | Freeze-thaw tapping window. |
| `GET·POST /indoor-seed-starts` · `GET·PUT·DELETE /indoor-seed-starts/<id>` | Tray CRUD (create auto-builds the outdoor event; updates re-sync dates/variety to linked records). |
| `POST /indoor-seed-starts/<id>/cancel` · `/uncancel` · `/mark-failed` | Skip / restore / fail with cascade choice (direct-seed or abandon). |
| `POST /indoor-seed-starts/<id>/transplant` | Record the transplant into a bed/position; links + completes. |
| `POST /indoor-seed-starts/calculate-quantity` | Seeds-to-start helper (germination ÷ buffer). |
| `GET /indoor-seed-starts/by-planting-event/<event_id>` · `POST /indoor-seed-starts/from-planting-event` | Lookup / create the tray for a calendar event. |
| `POST /validate-planting` · `POST /validate-plants-batch` · `POST /validate-planting-date` | Full validation bundle / palette tinting / forward cold danger. |
| `GET /germination-history` · `GET /germination-history/<plant_id>/prediction` | Personal germination stats + prediction. |

## 6.7 Other blueprints
| Blueprint (prefix) | Routes |
|---|---|
| **harvests_bp** (`/api/harvests`, 4) | `GET·POST ''` (list/create with completion sync), `POST /bulk` (multi-event harvest, shared group id), `PUT·DELETE /<id>`, `GET /stats`. |
| **compost_bp** (`/api/compost-piles`, 3) | `GET·POST ''`, `GET·PUT·DELETE /<id>`, `POST /<id>/ingredients` (C:N recompute). Turns are logged via pile update (`last_turned`). |
| **livestock_bp** (`/api`, 13) | `GET·POST /chickens` + `GET·PUT·DELETE /chickens/<id>`; `GET·POST /egg-production`; same pair for `/ducks` + `/duck-egg-production`; `/beehives` pair + `GET·POST /hive-inspections` + `GET·POST /honey-harvests`; `/livestock` pair + `GET·POST /health-records` (user-scoped via joins). |
| **photos_bp** (`/api/photos`, 2) | `GET·POST ''` (multipart upload), `PUT·DELETE /<id>` (delete removes the file). |
| **properties_bp** (`/api`, 6) | `GET·POST /properties`, `GET·PUT·DELETE /properties/<id>`, `GET /frost-dates` (resolution chain §4.4), `POST /properties/validate-address` (geocode), `POST /placed-structures`, `PUT·DELETE /placed-structures/<id>` (collision-validated). |
| **seeds_bp** (`/api`, 10) | `GET·POST /seeds`, `GET /seeds/varieties/<plant_id>`, `PUT·DELETE /seeds/<id>`, `GET /seed-catalog` (+ `/available-crops`), `GET /my-seeds` (user's view), `POST /my-seeds/from-catalog` (clone), `POST /my-seeds/<id>/sync-from-catalog`, `POST /seeds/import` (CSV), `POST /varieties/import` (CSV; admin-gated). |
| **nutrition_bp** (`/api/nutrition`, 10) | `GET /dashboard`, `POST /estimate`, `GET /garden`, `GET /livestock`, `GET /trees`, `GET·POST /data`, `DELETE /data/<id>`, `GET /usda/search`, `POST /usda/import`. |
| **weather_bp** (`/api/weather`, 2) | `GET /current`, `GET /forecast` (1–16 days). |
| **trellis_bp** (`/api`, 3) | `GET·POST /trellis-structures`, `GET·PUT·DELETE /trellis-structures/<id>` (delete cascades allocations), `GET /trellis-structures/<id>/capacity`. |
| **dashboard_bp** (`/api/dashboard`, 3) | `GET /today` (the signal engine §4.8), `POST /snooze`, `DELETE /snooze`. |
| **calendar_feed_bp** (`/api/calendar`, 3 — added Jun 2026) | `GET /feed-info` (the user's secret iCal URL, token auto-created in Settings), `POST /feed-token/regenerate` (revokes the old URL), `GET /feed/<token>.ics` (token-authenticated — no session — iCalendar payload: one all-day VEVENT per phase date of every active planting event, stable UIDs, RFC 5545 folding/escaping). |
| **simulation_bp** (`/api/simulation`, 3) | `GET /status`, `POST /set-date`, `POST /advance` (dev tooling; no auth). |
| **pages_bp** (no prefix, 11 HTML) | Legacy server-rendered pages (§3.17); data routes login-gated + user-filtered. |

---

# 7. Static Data & the Synchronized Pairs

## 7.1 The plant database (118 entries, both sides)

`backend/plant_database.py::PLANT_DATABASE` ⇄ `frontend/src/data/plantDatabase.ts` —
**identical 118 entries** (verified). Each entry can carry up to ~27 fields: identity (`id`,
`name`, `scientificName`, `family`, `category`), spacing (`spacing`, `rowSpacing`, perennial
`matureSpacing`/`matureRowSpacing`), timing (`daysToMaturity`, `germination_days`,
`weeksIndoors`, `transplantWeeksBefore`, `days_to_seed`, perennial `yearsToMaturity`),
temperature/soil (`germinationTemp{min,max}`, `soil_temp_min`,
`transplant_soil_temp_min`, `soilPH{min,max}`, `planting_depth`), hardiness
(`frostTolerance`, `winterHardy`, `heat_tolerance`, `ideal_seasons`), care (`waterNeeds`,
`sunRequirement`), companions (`companionPlants`, `incompatiblePlants` — arrays of plant
ids), optional `migardener{}` spec (row/broadcast/plant-spacing parameters, seed densities,
survival rates, `linearFeetPerPlant` for trellis crops), `lifecycle` (perennial), `icon`
(emoji), `notes`. A **PLANT_ID_ALIASES** map (`utils/plant_id_resolver.py` ⇄
`utils/plantIdResolver.ts`) resolves deprecated ids to canonical ones everywhere ids enter
the system.

## 7.2 Methods, spacing tables, guilds, templates

`backend/garden_methods.py`: **GARDEN_METHODS** (7 methods with grid size, standard bed
sizes, benefits, ideal-for); **SFG_SPACING** (6 tiers: 0.5/1/4/8/9/16 per square);
**ROW_SPACING** (22 crops); **INTENSIVE_SPACING** (24 crops, on-center); **MIGARDENER_
SPACING** (14 base pairs; the dedicated `migardener_spacing.py` override table holds 54
entries, fully mirrored in `migardenerSpacing.ts`); **PLANT_GUILDS** (6: three-sisters,
tomato-basil-marigold, salad-bowl, carrot-onion-defense, herb-spiral, brassica-companion —
each with plant roles, bed size, method); **BED_TEMPLATES** (28 ready-made layouts with
plant-by-cell placements — consumed by the legacy visual designer).

## 7.3 Other data assets

`structures_database.py`: **75 structures** in 10 categories (ground-covering, building,
compost, garden, infrastructure, livestock, orchard, storage, structures, water) with
dimensions, icon, color, cost, materials. `plant_database.py::COMPOST_MATERIALS`: 15
green/brown materials with C:N ratios. `backend/data/`: `baseline_nutrition.csv` (≈39 crops:
per-100g nutrients + yield/sqft), `breed_production_rates.json` (chicken/duck/goat breed
production), `varieties/lettuce_varieties.csv` (variety DTM/soil-temp seed data).

## 7.4 The five synchronized pairs (the must-not-diverge rule)

| Domain | Backend | Frontend |
|---|---|---|
| Space calculator | `services/space_calculator.py` | `utils/gardenPlannerSpaceCalculator.ts` |
| SFG spacing | `sfg_spacing.py` (+ garden_methods) | `utils/sfgSpacing.ts` |
| MIGardener spacing | `migardener_spacing.py` | `utils/migardenerSpacing.ts` |
| Intensive spacing | `intensive_spacing.py` | `utils/intensiveSpacing.ts` |
| Plant database | `plant_database.py` | `data/plantDatabase.ts` |

Frontend computes estimates live; backend validates on submit — if they diverge the user
sees impossible numbers or surprise 409s. Any change to one side must change the other
(CLAUDE.md constraint #2), guarded by `test_space_calculation_sync.py` (114 tests),
`test_cross_stack_parity.py`, `test_sfg_spacing_resolver.py`, and the 55 frontend
calculator tests.

---

# 8. External Integrations & Environment

## 8.1 Weather & soil — Open-Meteo (primary, keyless)

`openmeteo_service.py` / `weather_service.py`: forecast API
(`api.open-meteo.com/v1/forecast`) for current conditions (temp, humidity, apparent temp,
weather code, wind), daily forecast (1–16 days: hi/lo, precipitation, wind, humidity), and
**measured soil temperature at 0 cm / 6 cm / 18 cm**; archive API
(`archive-api.open-meteo.com`) for historical days (simulation mode + forward-cold-danger
history). Caching: `requests_cache` on-disk session (temp dir, 15-min TTL) + in-memory
`_weather_cache`/`_forecast_cache` (15 min, location-matched to ~0.01°); 5 retries with
backoff. On failure everything degrades to clearly-flagged mock data (65°F air / 50°F soil)
rather than erroring.

## 8.2 WeatherAPI.com (optional secondary)

`weather_service.get_current_temperature` uses `api.weatherapi.com/v1/current.json` **only
when `WEATHER_API_KEY` is set** (1M calls/month tier), same 15-min cache, mock fallback.
(The missing-constant bug that silently disabled this branch was fixed Jun 2026.)

## 8.3 Geocoding & hardiness zones

`services/geocoding_service.py`: provider chosen by `GEOCODING_PROVIDER`
(**geocodio** default, or **google**), keyed by `GEOCODING_API_KEY`. ZIP lookups run through
a thread-safe in-process cache (success 7 days, not-found 30 min, provider-error 1 min) and
a 23-entry `KNOWN_US_ZIPCODE_COORDS` fallback table that costs no quota. Address validation
returns ok/not_found/provider_error/invalid_input statuses with accuracy/confidence.
**Hardiness zones**: phzmapi.org (`https://phzmapi.org/{zip}.json`, free USDA 2023 data) →
regional latitude-band fallback. Frost dates then resolve via the §4.4 chain
(22-zone month/day table, default 5b).

## 8.4 USDA FoodData Central

`services/usda_api_service.py` (`api.nal.usda.gov/fdc/v1`, key `USDA_API_KEY`): food search,
detail fetch, and a mapper translating ~20 USDA nutrient codes into the app's
NutritionalData schema; imports cached in the database. Per-instance rate-limit tracking
(900/hr against the 1000 cap).

## 8.5 Other outbound calls

NOAA data for maple tapping (`maple_tapping_calculator.py`); nothing else — all HTTP goes
through `requests`.

## 8.6 Environment variables (complete)

| Variable | Default | Used for |
|---|---|---|
| `DATABASE_URL` | `sqlite:///instance/homestead.db` | SQLAlchemy URI |
| `SECRET_KEY` | random 24-byte hex per boot | session signing (set explicitly in production or sessions die on restart) |
| `HOMESTEAD_BACKEND_HOST` / `HOMESTEAD_BACKEND_PORT` | 0.0.0.0 / **5000** (bat sets **5051**) | Flask bind |
| `BLUEPRINT_PREFIX` | '' | test-only URL wrapper |
| `FLASK_ENV` | — | dev checks |
| `GEOCODING_PROVIDER` / `GEOCODING_API_KEY` | geocodio / — | geocoding (optional) |
| `USDA_API_KEY` | — | nutrition import (optional) |
| `WEATHER_API_KEY` | — | WeatherAPI branch (optional) |
| `REACT_APP_API_URL` (frontend) | http://localhost:5000 (bat sets 5051) | SPA → backend base URL |

`.env` is loaded first thing in `app.py` (python-dotenv). All third-party keys are optional;
missing keys mean silent fallbacks (Appendix A flags the silence).

---

# 9. Time & the Simulation System

- **Backend** `simulation_clock.py`: a process-global optional date.
  `get_now()/get_utc_now()/get_today()` are the sanctioned replacements for raw datetime
  calls (simulated date renders as noon). `advance_days(n)` steps it. **Not persisted** —
  restarting Flask returns to real time.
- **Endpoints** (`/api/simulation`): status / set-date / advance (no auth; dev tool).
- **Simulation-aware weather**: `simulation_weather.py` swaps forecast calls to the
  Open-Meteo *archive* when simulating a past date (responses flagged `isHistorical`), so
  frost-risk signals replay real history.
- **Frontend**: SimulationContext syncs with the backend on mount and exposes
  `useNow()/useToday()`; the SimulationToolbar drives it; date-aware components (designer
  date filter, dashboard, calendar, compost) read through it.
- **Coverage**: 17 backend modules import the clock (all blueprints with date logic, the
  dashboard/planner/nutrition/rotation services, frost/soil/weather modules, models).
  **However ~69 raw `datetime.now()/date.today()/utcnow()` calls remain** in less-traveled
  paths (and migrations, where it's fine) — meaning some logic ignores the simulated clock
  (Appendix A).

---

# 10. Architecture & Operations

## 10.1 Request lifecycle & app wiring

`backend/app.py`: loads `.env` → configures SQLAlchemy/SECRET_KEY/session cookies
(HttpOnly, SameSite=Lax, Secure **off** — localhost posture, 7-day lifetime) → CORS for
`localhost:3000/3001` with credentials → Flask-Login (JSON 401 instead of redirects) →
registers all 19 blueprints → `db.create_all()` (creates missing **tables** — never columns;
column changes require migrations) → seeds a default **admin / admin123** account if no
admin exists. `python app.py` runs the dev server.

## 10.2 Startup & ports

`start-app.bat` → `start-backend.bat` (venv + `HOMESTEAD_BACKEND_PORT=5051` + `python
app.py`) and `start-frontend.bat` (`REACT_APP_API_URL=http://localhost:5051` + `npm start`
on 3000). Note the deliberate 5051 (avoiding port-5000 collisions) vs the code default 5000
— anything run outside the .bat files must set both env vars to match.

## 10.3 Database & migrations

SQLite file `backend/instance/homestead.db`. **Policy:** all schema changes via
Flask-Migrate (`flask db migrate` / `upgrade`); the historical
`migrations/custom/schema/` scripts (28) are deprecated; `migrations/custom/data/` (23)
remains for data backfills (plant additions, catalog population, completion-consistency
fixups). Migrations are **not auto-run** — `flask db upgrade` is a manual step.

**The 18-revision Alembic chain** (oldest → newest):
1. `256f54bf5501` per-property frost-date overrides · 2. `3b3c91600150` actual germination
date on starts · 3. `44a1203779c7` PlantedItem.source_plan_item_id · 4. `454d42db4ccb` plan
trellis_assignments · 5. `579239b7ea80` event harvest_completed · 6. `631fced45d74` FK
indexes · 7. `649b4fcf7611` seed-saving fields · 8. `8b2eca933349` trellis CHECK constraints
· 9. `a1b2c3d4e5f6` completion-consistency CHECK · 10. `de0b8c7ef792` event export_key ·
11. `ff76eff9eab7` bed_assignments + allocation_mode · 12. `b4d826b4780f` plan-item source +
indoor_seed_start_id · 13. `e2c4d6d3bc2f` start destination_bed_ids · 14. `d37b8238c461`
DashboardSnooze table · 15. `faa8053ea705` + 16. `f2bb35af831e` cancelled_at soft-deletes
(events/items/starts) · 17. `c79bda51a2e9` harvest_group_id · 18. `a7f3c9d21e04` maturity
learning (harvest snapshots + variety_maturity_model).

## 10.4 Dependencies (why each exists)

**Backend:** Flask 3 / Flask-SQLAlchemy / Flask-Migrate / Flask-Login / Flask-CORS (core);
requests + requests-cache + retry-requests + openmeteo-requests (integrations); numpy (soil
temp aggregation); Pillow (photos); python-dateutil + python-dotenv; astor (the
plant-database AST updater utility); pytest. **Frontend:** React 19, TypeScript 4.9,
Tailwind 3.4, @dnd-kit/core (drag-drop), date-fns, lucide-react (icons), axios (present;
most calls use the fetch wrappers), Testing Library + Playwright 1.56.

## 10.5 Test landscape

- **Backend — 702 tests / 36 files** (in-memory SQLite; conftest builds a minimal app with
  registered blueprints, sample users/beds/trellis fixtures, login helpers). Cover: auth +
  isolation (32), space-calc sync (114), succession export (36), planting-event status (36),
  conflict detection, dashboard (endpoint/grouping/staleness/placement), indoor starts
  (cascade/overdue/variety-sync/dedup/from-event), harvests (bulk/sync), geocoding (+ ZIP
  cache), frost lookup, season validator, event-details validator, seed import, breed
  service, bed delete cascade, bulk move/delete, cross-stack parity, pepper-quantity
  reconciliation. Known: 5 geocoding tests hit live APIs and fail offline (pre-existing).
- **Frontend — 29 unit/component test files** (Jest/RTL): dashboard widgets + focus hook,
  designer helpers + modals (PlantConfig, HarvestPlant, BulkHarvest, ConfirmDialog),
  indoor-starts behaviors (banner, focus, placement, date formatting), calendar grid pieces,
  space calculator (55 tests), date utils, App shell.
- **E2E — 37 Playwright specs** (`frontend/tests/`): auth + isolation, admin, planner
  lifecycle, designer flows (incl. click-to-place, drag-drop), beds, calendar, harvests,
  indoor starts, compost, livestock, nutrition/USDA, dashboard buckets, cross-feature
  journeys, seasonal phase suites (p2-*/p3-*). Require both servers running.
- **Notable gaps**: simulation archive-weather paths, geocoding fallback cascade edges, the
  legacy HTML pages (untested), USDA rate-limit recovery.

## 10.6 Files & storage

Photos under `backend/static/uploads/` (16 MB cap, png/jpg/jpeg/gif), Open-Meteo cache in
the OS temp dir, SQLite under `backend/instance/`. Documentation lives in `docs/`
(reference guides incl. this file), `dev/active|completed/` (task logs — notably
`production-readiness-audit/`), CLAUDE.md / AGENTS.md / CODEX.md (AI-collaboration operating
guides).

---

# 11. Appendix A — Observations: Possible Gaps & Inconsistencies

Everything below is **descriptive, not prescriptive** — raised so we can discuss whether it's
intentional, missing, or worth changing. Grouped by flavor; each item has a place to look.

## A. Product gaps & open questions

1. **~~Calendar Timeline-view editing is a dead click~~ — RESOLVED Jun 2026.** Timeline bars
   now open the shared EventDetailModal like the other views. The same effort shipped the
   calendar Tier-2 upgrades — drag-to-reschedule on the month grid (type-aware date fields,
   409 conflict toasts), hover quick actions on markers (complete / skip / reschedule
   popover), overdue styling + simulation-aware today highlight, and a "Show skipped"
   toggle backed by a new `includeCancelled` query param on `GET /api/planting-events` —
   and the Tier-3 upgrades: succession-series badges ("↻k/N" + per-series color bar) with
   a "shift entire series" option in the detail modal's reschedule flow, a **Week view**
   (same grid surface, 7 tall day columns, week-stepping header), dashboard-parity
   overlays (harvest-ready amber glow, missed flags from `/api/dashboard/today`), and a
   frost/rain forecast strip (❄️/🥶/🌧️ icons on upcoming day cells from the 10-day
   forecast). Tier 4 followed: an **iCal subscription feed** (see item 5 and §6
   calendar_feed_bp) with a Subscribe modal on the calendar (copy/download/regenerate the
   secret URL + per-provider instructions). The Settings model also gained its first real
   consumer (the feed token), softening item 7.
2. **Seed catalog multi-plant mapping** — `SeedCatalog.tsx:226` carries a TODO ("update
   backend to support multiple plant_ids"); catalog rows currently map to exactly one plant.
3. **Plan export does not create indoor trays** — deliberate Apr 2026 decision: exporting a
   plan creates PlantingEvents only; the "plan-only seedings" banner is the manual bridge to
   IndoorSeedStarts. If that banner gets ignored in practice, auto-create-on-export (option
   "A2" in the dev notes) may deserve a revisit.
4. **Germination checks silently disappear** — a direct-seed germination check older than
   14 days drops from the dashboard without ever telling the user "this seeding probably
   failed" (`dashboard_service._build_germination_check`). A "presumed failed" state might
   be the missing piece.
5. **~~No notification channel beyond the dashboard~~ — LARGELY RESOLVED Jun 2026** via the
   iCal subscription feed (calendar_feed_bp): subscribe a phone/Google/Apple calendar to the
   secret per-user `.ics` URL and the device's native reminders cover garden tasks. (True
   push/email remains unbuilt — likely unnecessary now.)
6. **No backup/export story** — data lives in one SQLite file; there's no in-app backup,
   restore, or full-data export (CSV export exists only for seeds and nutrition summaries).
7. **Settings model has no UI** (`models.py:378`) — a per-user key-value store exists and is
   used internally, but users can't see or set preferences anywhere.
8. **Photo.category is barely used** — uploads can be categorized
   (garden/plant/harvest/pest) but little UI filters on it.
9. **Plant database breadth** — 118 crops; worth a pass to confirm everything you actually
   grow is present with accurate numbers (the variety-override system covers gaps, but only
   if a base plant exists).
10. **Guild support depth** — guild data (6 guilds) + GuildSelector/Preview exist and place
    plants client-side; there's no guild-aware validation beyond normal conflict checks, and
    no custom-guild authoring.
11. **GardenPlan.strategy is persisted but the UI mostly pins 'balanced'** — the engine
    supports `maximize_harvest` / `use_all_seeds`; surfacing the chooser is an easy win if
    wanted.
12. **Desktop-first** — the Designer/Property SVG canvases assume mouse + viewport; no
    mobile layout has been attempted.

## B. Known bugs & quirks (documented in dev notes/memory)

13. **~~Row-display stacking bug~~ — FIXED Jun 10 2026.** All placement paths now cap at
    per-cell capacity via `distributePlantsAcrossCells` (overflow warns and stops at the bed
    edge), and `autoPlacement.ts` strides by the SFG table in square-foot beds (pepper
    ≥1/sq → consecutive cells A7,B7,C7; melon 0.5/sq → every other cell) while non-SFG
    methods keep the real-spacing stride. The non-SFG-method single-item carve-out and the
    single-preview-cell `ceil()` path — both of which stacked quantity into one cell — were
    removed. Guarded by `autoPlacement.test.ts` + `designerHelpers.test.ts`; full record in
    `dev/active/seed-planning-ui-improvements/row-display-investigation.md`.
14. **Harvest deep-link doesn't highlight a row** — dashboard harvest signals carry
    PlantingEvent ids, HarvestTracker rows are HarvestRecords; by design the click clears
    filters instead of highlighting (signals fire before a record exists).
15. **`DuckEggProduction.chicken_id`** — the duck egg FK is named `chicken_id` for frontend
    compatibility (`models.py:874`). Works; reads oddly.
16. **Two frontend date-handling styles** — most code uses the safe
    `parseLocalDate`/`formatLocalDate`, but a few modals still construct raw `Date`s
    (off-by-one risk in western timezones). The canonical helpers exist; stragglers remain.

## C. Technical-debt & consistency observations

17. **~69 raw `datetime.now()/today()/utcnow()` calls** remain outside the simulation clock
    (mostly low-traffic paths and migrations) — under simulation, those spots quietly use
    real time.
18. **Harvest creation isn't idempotent** — double-submitting `POST /api/harvests` (or the
    event-harvest PATCH twice) yields duplicate records; there's no natural-key/export_key
    guard like exports have.
19. **UUID link fields have no referential integrity** — `succession_group_id` and
    `row_group_id` are plain strings; every query must (and does) filter by `user_id`, but
    the DB can't enforce chain consistency.
20. **`event_details` JSON is schema-validated only for mulch and maple-tapping** event
    types; other types are accepted as-is (forward-compatible by design; reads stay
    defensive).
21. **Trellis overlap protection is application-level only** — `check_trellis_overlaps`
    guards the gardens_bp path and export assigns sequential segments, but no DB constraint
    prevents overlapping allocations written by other paths.
22. **Rotation model is simplistic by design** — fixed 3-year family window; ignores cover
    crops/intercropping; can false-positive.
23. **Hardcoded tunables** — dashboard staleness windows (14/10/14 days), compost turn
    threshold (7 days), seed low-stock (<2) and expiry (30 days), seed-buffer (×1.15):
    all constants in code, not user settings (pairs with the unused Settings model, item 7).
24. **Snooze-forever sentinel** — "forever" stores year 9999-12-31 rather than NULL.
25. **Export-key format evolution risk** — idempotency keys encode
    user/item/bed/date/index; changing the format or plan-item identity later would orphan
    old events into "duplicate" territory.
26. **`GardenPlanItem.status` is a free string** (planned/exported/auto) — no enum
    enforcement.

## D. Production-readiness (fine for localhost; gaps if ever hosted)

27. **CORS origins and cookies are localhost-tuned** — hardcoded `localhost:3000/3001`,
    `SESSION_COOKIE_SECURE=False`; and if `SECRET_KEY` isn't set, it randomizes each boot
    (all sessions die on restart).
28. **Ports 5000 vs 5051** — code defaults 5000; the .bat files set 5051 + matching
    `REACT_APP_API_URL`. Running outside the .bats without env vars mismatches the two.
29. **Migrations are manual** — `flask db upgrade` isn't run automatically;
    `db.create_all()` masks missing *tables* but never adds columns → silent drift on stale
    databases.
30. **SQLite write concurrency** — fine single-household; parallel e2e runs can hit lock
    contention.
31. **Per-process integration state** — USDA rate-limit window and ZIP cache live in
    process memory (resets on restart; wouldn't share across instances).
32. **Silent integration fallbacks** — missing/failed API keys degrade to mock weather/
    known-ZIP coordinates without any UI indication that data is synthetic.
33. **Legacy server-rendered pages still exist** — now login-gated and user-scoped (Jun 2026
    fix), but they duplicate the SPA in stale form; keep-or-retire is an open decision.
34. **Default admin credentials** — `admin/admin123` seeded on first boot; fine locally,
    must change if ever exposed.

---

# 12. Appendix B — Glossary & File Map

## Glossary (quick reference)

**Active plan** — the season plan the app currently attributes work to. · **Bed
assignments** — per-bed quantity JSON on a plan item (source of truth for allocation). ·
**DTM** — days to maturity. · **Export key** — idempotency string tying an event to its plan
item/bed/date/succession slot. · **Missed bucket** — dashboard section for aged-out overdue
tasks. · **Planning method** — bed-level spacing system (SFG/row/intensive/MIGardener/…). ·
**Planting style** — per-planting sowing pattern (row/broadcast/dense-patch/plant-spacing).
· **Plan-only seeding** — a scheduled transplant event with no tracked indoor tray. ·
**Seed-density planting** — quantity measured in seeds with germination/survival
expectations. · **Signal / signalKey** — one dashboard needs-attention row and its stable
snooze/deep-link identity. · **Soft delete / skip** — `cancelled_at` timestamp, reversible.
· **Succession group** — UUID linking a staggered planting series. · **Sync pair** — a
backend/frontend file duo that must stay identical (§7.4).

## File map (where things live)

```
backend/
  app.py                     Flask wiring, CORS, login, blueprint registration, admin seed
  models.py                  all 26 SQLAlchemy models
  blueprints/                19 route modules (see §6)
  services/                  space_calculator, garden_planner_service, dashboard_service,
                             rotation_checker, geocoding, nutritional, usda, breed,
                             csv/seed import, trellis_validation, event_details_validator
  conflict_checker.py        spatial/temporal conflict engine
  season_validator.py        frost + soil-temp planting validation
  forward_planting_validator.py  future cold-danger checks
  soil_temperature.py / historical_soil_temp.py / weather_service.py /
  openmeteo_service.py / simulation_weather.py    weather & soil stack
  frost_date_lookup.py       zone→frost-date resolution
  simulation_clock.py        the time machine
  garden_methods.py / sfg_spacing.py / migardener_spacing.py / intensive_spacing.py
                             methods + spacing tables (sync pairs)
  plant_database.py (118) / structures_database.py (75)   static catalogs
  data/                      baseline nutrition CSV, breed rates JSON, variety CSVs
  migrations/versions/       the 18-revision Alembic chain
  templates/ + static/uploads/   legacy pages + photo storage
  tests/                     702 pytest tests (36 files)
frontend/src/
  App.tsx                    shell, nav, deep-link routing
  contexts/                  Auth, ActivePlan, Simulation
  components/                Dashboard/, GardenPlanner(.tsx + /), GardenDesigner(.tsx + /),
                             PlantingCalendar/, IndoorSeedStarts(.tsx + /), SeedsHub +
                             SeedCatalog + MySeedInventory + SeedInventory/, HarvestTracker,
                             CompostTracker, PhotoGallery, Livestock, PropertyDesigner,
                             NutritionalDashboard, WeatherAlerts, AdminUserManagement/,
                             SimulationToolbar, common/ (Modal, Toast, PlantPalette, forms…)
  utils/                     api, dateUtils, plantUtils, plantingStyles, urlParams,
                             space calculators (sync pairs), permacultureZones,
                             raisedBedHeight, plantIdResolver, completionHelpers
  data/plantDatabase.ts      the 118-plant mirror
  types.ts                   domain TypeScript types
frontend/tests/              37 Playwright e2e specs
docs/ · dev/                 reference docs (this file) · task logs & audits
start-app.bat / start-backend.bat / start-frontend.bat   launchers (5051/3000)
```

---

*End of deep-dive. Questions, corrections, and "wait, why does it do that?" welcome — every
section above is anchored to real files so claims can be checked in seconds.*
