# HOMESTEAD PLANNER — COMPLETE APPLICATION CAPABILITY GUIDE

A full A-to-Z write-up of everything this application can do. The Homestead Planner is a full-stack multi-user homesteading and garden management platform that goes well beyond "just planning a garden" — it covers seed inventory, livestock, compost, weather, nutrition, seasonal planning, and property layout.

---

## 1. OVERALL PLATFORM CHARACTERISTICS

- **Multi-user system** with registered accounts, individual login, and full data isolation (each user's gardens, seeds, livestock, photos are private to them)
- **Admin role** — designated admins can manage other users
- **Location-aware** — weather, frost dates, growing zones, and soil temperature are calculated for your specific property
- **Time-aware** — every date-sensitive feature (dashboard signals, calendars, snapshots, alerts) is driven off a single "current date" value so behavior is consistent across the app (a development-only QA tool can override this for site validation; see §19)
- **Works across 5 gardening philosophies simultaneously** — each bed can independently use Square-Foot Gardening, MIGardener intensive, traditional rows, biointensive, or trellis-vertical methods
- **Over 100 crops** in the plant database with scientific names, families, spacing data, days-to-maturity, and companion plant rules
- **205 plant icons** and **63 structure icons** for visual representation

---

## 2. DASHBOARD (Home Screen)

The dashboard is the command center that shows everything demanding your attention today.

### Active Plan Card
- Shows the currently active garden plan at a glance
- Bed count, plant count, quick-access buttons to Designer, Calendar, and plan management

### "Needs Attention" Panel
Aggregates urgent tasks across every part of the homestead, color-coded by severity:
- **Harvest Ready** — plants past expected harvest date (with days overdue)
- **Indoor Starts Due** — seeds that should be started indoors this week
- **Transplants Due** — seedlings ready to move from indoors into beds
- **Direct Seed Due** — outdoor seeding events coming up
- **Germination Checks** — outdoor-seeded plants ready to check for sprouts
- **Indoor Germination Checks** — indoor trays ready to check
- **Compost Overdue** — piles needing turning
- **Seeds Low Stock** — inventory running low
- **Seeds Expiring** — packets approaching expiration
- **Livestock Actions** — egg collection, hive inspections, etc.
- **Frost/Heat Alerts** — weather warnings
- **Rain Alerts** — incoming precipitation
- **Maple Tapping Season** — freeze-thaw alerts for tapping

Each signal can be:
- Clicked to jump directly to the exact record needing action (deep-linking)
- Snoozed (hide for N days)
- Dismissed
- Marked as done

### Quick-Actions Grid
Six one-click buttons to add: planting, harvest, seed, livestock entry, compost entry, photo.

### Upcoming Timeline
14-day forward view listing all upcoming garden events chronologically.

### Garden Snapshot Widget
Bird's-eye view of beds with current plantings on "today's" date.

### Plan Overview
Lists saved plans with status labels (draft, planned, exported, active).

### Weather Tile
Current conditions with link to full weather page.

---

## 3. GARDEN SEASON PLANNER

The Season Planner is a multi-step wizard for designing an entire year's growing season from your seed inventory.

### Plan Management
- Create/edit/delete/clone garden plans
- Filter plans by type (SFG, MIGardener, Row, Intensive)
- Status tracking: draft → planned → exported → active
- Activate a plan to make it the "working" plan across the app

### Creation Wizard

**Step 1 — Select Seeds**
- Browse your personal seed inventory
- Filter by: days-to-maturity range, soil temperature requirements, plant category, season suitability
- See germination rate, expiration status
- Select seeds with checkboxes and specify quantities

**Step 2 — Allocate to Beds**

> *Product note: strategy and succession-interval configuration are currently simplified — the app applies `balanced` + `moderate` defaults. A future version may reintroduce per-crop strategy configuration as a power-user feature. Planning method is chosen per bed in the Garden Designer, and per-seed succession intent is set alongside quantities in Step 1.*

- Pick destination beds
- Per-bed allocation mode: even distribution OR custom quantities
- Trellis assignments for climbing plants
- Space warnings when over-booking a bed
- Rotation warnings (same family in same bed within 3 years)
- Conflict detection for temporal overlaps
- Bed optimization suggestions (minimize bed count)

**Step 3 — Review & Save**
- Summary of all allocations
- Nutrition estimates: calories, protein, carbs, fat
- Missing-seed warnings for plants referenced but not in inventory
- Export to Calendar (creates all the individual planting events)

### Plan Detail Editor
Once created, plans can be edited with:
- Breakdown by bed showing what's assigned where
- Space utilization per bed (available/used/overbooked)
- Rotation warnings by bed
- Trellis allocations with remaining capacity
- Seed-by-seed view of which beds it's going to
- Nutrition cards (total and per-plant)
- Feasibility checker to catch impossible plans

### Shopping List Generator
Auto-calculates how many seed packets you need to buy, accounting for:
- Germination rates
- Seeds per packet
- Seeds already in inventory
- Variety-specific brand preferences

---

## 4. GARDEN DESIGNER (Visual Bed Editor)

The interactive drag-and-drop tool for actually placing plants in beds.

### Bed Management
- Create/edit/delete beds with full attributes:
  - Dimensions (width × length × height for raised beds)
  - Planning method per bed (mix methods in the same garden)
  - Grid cell size (customizable)
  - Location, sun exposure (full/partial/shade)
  - Soil type, mulch type
  - Permaculture zone (0–5)
  - Season extension: row cover, cold frame, low tunnel, high tunnel, greenhouse (with layer count)
  - Shade cloth settings (factor 30–80%)
  - Notes field
- Bed thumbnail cards showing miniature grid with current plantings

### Visual Grid Editor
- SVG-based interactive grid
- Zoom controls
- Cell coordinate labels (A1, B2, C3…) toggleable
- Multiple overlay layers

### Plant Placement
- **Plant palette** on the left side with available plants (filtered by active plan if set)
- Drag plants directly onto grid cells
- Preview shows the plant's spacing footprint before drop
- Multi-plant drag (hold shift + drag)
- Click-to-place-by-coordinates mode

### Plant Placement Modal
When placing, you can configure:
- Variety selection
- Quantity
- Spacing validation with overbook warnings
- Planting method (individual plants vs. seed density)
- Expected germination rate and survival rate
- Calculated final plant count
- Transplant date (if starting indoors)
- Harvest method (individual head, cut-and-come-again, leaf mass, etc.)

### Managing Planted Items
- Click a cell to see plant details with edit/harvest/delete options
- Drag to move plants to new locations (with collision detection)
- "Remove All By Plant" — clears all cells of same crop in bed
- Shift-click for multi-select batch operations

### Specialized Planning Modes
- **Row-based planner** — for MIGardener beds, shows visual row strips, row schedule modal for succession by row
- **Trellis Manager** — create/edit trellises (fence, arbor, A-frame), assign plants with linear position tracking (start/end inches)
- **Date Filtering** — view what's in the ground on any specific date (single or range mode)

### Future Plantings Overlay
- Toggle to show plants scheduled for future dates
- Semi-transparent green indicators with "FUTURE" badges
- Shows full spacing footprint
- Helps prevent placing current plants where future plants will go
- Integrates with Quick Harvest filter

### Quick Harvest Filter
- Filter future plantings by harvest window (e.g., "show only what harvests in 30 days")
- Auto-enables future plantings overlay when active

### Conflict Detection & Resolution
- **Conflict Audit Modal** shows all spatial/temporal conflicts in a bed
- Duplicate crops (same plant overlapping dates)
- Incompatible companion plants
- Auto-resolve button or manual fix
- Override option for intentional conflicts

### Plant Guilds (Companion Planting Templates)
- Pre-built plant combinations (e.g., Three Sisters)
- Guild selector modal with previews
- Load an entire guild into a bed with one click
- Shows roles (main / companion / trap crop)

### Seed Saving Workflow
- **Set Seed Date Modal** — mark a plant for seed saving, auto-calculates seed maturity date from harvest + days-to-seed
- **Collect Seeds Modal** — when ready, record packet count, seeds per packet, germination rate, notes → creates new "Homegrown" seed inventory entry

### Weather Alert Banner
Frost/heat warnings displayed directly above the grid with severity and temperature.

---

## 5. PROPERTY DESIGNER (Site-Wide Layout)

Zoom out from individual beds to your whole property.

### Property Management
- Name, address, dimensions (width × length in feet)
- Latitude/longitude (auto-geocoded)
- Hardiness zone
- Soil type, slope characteristics
- Frost dates (last spring / first fall) — from property, zone lookup, or zip code
- Acreage (calculated)

### Interactive Map Canvas
- SVG canvas with scaled grid
- Three grid layers: minor (1 ft), major (10 ft), super-major (50 ft)
- Coordinate display while dragging
- Snap-to-grid (1-foot increments)

### Structure Placement
Drag-and-drop placement of:
- **Trees** (fruit, nut, shading) — drawn as circles with canopy diameter
- **Garden beds** (raised or in-ground)
- **Greenhouses, hoop houses, sheds**
- **Compost piles, water collection, apiaries**
- **Paths, fencing, arbors, pergolas**
- **Chicken coops, duck ponds, worm bins**
- **Rain barrels, wells, gates**
- **Landscape elements** (mulch areas, gravel, lawn, meadow)

### Structure Properties
- Rotation (45-degree increments)
- Custom dimensions override
- Shape type (circle for trees, rectangle for structures)
- Cost tracking
- Built date
- Notes

### Tree Nutrition Tracking
- Annual yield estimates by tree type
- Nutritional contribution aggregated
- Tree nutrition card on property

---

## 6. PLANTING CALENDAR

Central scheduling hub for every time-based event.

### Three View Modes
1. **List View** (default) — sortable table of all events chronologically
2. **Calendar Grid View** — traditional month cells with event pills
3. **Timeline View** — horizontal timeline showing event distribution Jan–Dec

### Event Types Supported
- `seed-start` (indoor starting)
- `transplant` (moving seedlings out)
- `direct-seed` (sowing outdoors)
- `germination-check`
- `harvest`
- `mulch` — with type, depth, coverage
- `fertilizing` — with type, amount
- `irrigation` — with duration, method
- `maple-tapping` — with tap count, sap amount, syrup yield

### List View Features
- Crop sidebar (filter events to single plant)
- Planted count and expected harvest count per crop
- Sortable columns: date, plant, variety, bed, event type, status
- Bed filter dropdown
- Search by plant name
- Status labels: planned, started, germinating, transplanted, growing, ready, harvested, completed
- Expandable rows with full details

### Calendar Grid View
- Month layout with color-coded event pills
- Click day for "Day Detail Modal" with quick actions
- Previous/next navigation
- Current date highlighted

### Event Creation
- **Add Crop Modal** — schedule a new planting with plant, variety, date, bed, quantity, succession options
- **Add Garden Event Modal** — non-plant events (mulch, fertilize, irrigate) with event-specific details
- **Add Maple Tapping Modal** — tree selection from placed structures, tap count, collection date series

### Event Detail Modal
Full info with edit/complete/delete actions, plus "Navigate to Designer" jump button.

### Frost Dates Display
Last and first frost dates highlighted on calendar with source indicator (property/zone/zipcode/default).

### Soil Temperature Card
- Current soil temperature by depth (2", 4", 8")
- Temperature trend
- Planting readiness indicators per crop (based on minimum soil temp)
- Mulch-adjusted temperature modeling

---

## 7. INDOOR SEED STARTS

Dedicated propagation tracker for seeds started indoors before moving to beds.

### Seed Start Lifecycle
Status progression: **planned → seeded → germinating → growing → hardening → transplanted → failed**

### Record Details
- Plant, variety, quantity started
- Seeds germinated count and rate (%)
- Days to germinate
- Expected/actual germination dates
- Expected/actual transplant dates
- Container type (cell pack, 6-pack, plug, etc.)
- Cell size
- Light hours per day
- Temperature, humidity
- Location (windowsill, grow-lights, heated-mat, greenhouse, shelf name)
- Destination beds (manual or auto from plan)
- Notes and status
- Sync status indicator (in-sync with plan? mismatch warning?)

### Actions
- **Add new seed start** with full configuration
- **Import from garden plan** — bulk-create starts from plan items that need indoor starting
- **Mark germinated** with count and date
- **Mark ready to transplant** (status → hardening, countdown shown)
- **Move to Garden** → jumps to Designer with context
- **Mark failed** with reason notes
- **Cancel/uncancel** (soft-delete preserves history)

### Seed Quantity Calculator
Accounts for expected germination and survival rates to suggest how many seeds to start for desired final count.

---

## 8. HARVEST TRACKER

Yield logging and analytics.

### Harvest Records
- Date, plant, variety, quantity, unit (lbs, oz, count, bunches, quarts)
- Quality rating (excellent/good/fair/poor)
- Linked to planting event (optional)
- Notes (taste, yield vs expected, etc.)
- Photo attachments

### Log Harvest Modal
- Plant and variety selection
- Harvest date (date picker or "today")
- Quantity and unit
- Quality rating
- Notes

### Statistics
- Total harvests this season
- Total weight/volume harvested
- Heaviest single crop
- Most harvested crop
- Yield trends

### Filtering
- By plant, quality, date range
- Sortable by all columns
- Searchable

---

## 9. SEED INVENTORY (Two-Tab Hub)

### Tab 1 — My Inventory (Personal Seed Collection)
- Plant, variety, brand, quantity, purchase date, expiration date
- Estimated germination rate (%)
- Storage location
- Price paid
- Seeds per packet, seeds used, seeds available
- Notes
- Provenance tracking: Homegrown (from Collect Seeds) vs. Catalog (cloned from global)
- Sync status with catalog

### Variety-Specific Agronomic Overrides
These override the plant database default for that specific variety:
- Days to maturity, germination days
- Plant spacing, row spacing, planting depth
- Germination temperature range
- Soil temp minimum
- Heat/cold/bolt tolerance
- Ideal seasons
- Flavor profile, storage rating

### Actions
- **Add seed** manually
- **Import from catalog** — clone from global seed catalog
- **CSV import** — bulk upload (supports Johnny's Seeds, Baker Creek formats with auto-detection of 14+ crop types like lettuce, tomato, carrot, pepper)
- **Sync from catalog** — update agronomics from master catalog
- Edit/delete/mark expired

### Tab 2 — Seed Catalog (Global Reference)
Pre-built varieties from seed suppliers with full agronomic data:
- Days to maturity, germination days/temp
- Planting depth, spacing
- Season suitability
- Heat/cold tolerance, bolt resistance
- Flavor profile, storage rating
- Planting style (row, broadcast, dense patch, trellis)
- MIGardener-specific: seed density per inch/sqft, germination rate, survival rate, harvest method

Browse/search/filter and one-click "Add to My Inventory."

---

## 10. LIVESTOCK MANAGEMENT

Four categories with dedicated tabs:

### Chickens
- Name, breed, quantity, hatch/purchase date
- Purpose (eggs/meat/dual/pest-control)
- Sex (hen/rooster), status, coop location
- 24+ breeds with production rates in reference database
- **Egg Production logs** — daily counts with eaten/sold/incubated breakdown
- Age-based production adjustments

### Ducks
- Similar to chickens
- Laying frequency, egg color
- Duck egg production logs

### Beehives
- Type (Langstroth, Top Bar, Warre)
- Install date
- Queen marked/clipped status
- Queen color
- Status (active, swarmed, dead)
- Location
- **Hive Inspections** — brood pattern, food stores, temperament, disease signs, queen presence, notes
- **Honey Harvests** — frames harvested, pounds harvested, date

### Other Livestock (Goats, Pigs, Sheep, Cattle)
- Species, breed, tag number
- Birth date, sex, purpose
- Sire/dam lineage
- Status, location, weight
- **Health Records** — vaccinations, deworming, illness, injury, checkups, medication, dosage, veterinarian, cost, next due date

### Livestock Nutrition Dashboard
- Aggregate annual production: eggs, meat, honey, milk
- Total calories, protein, carbs, fat contribution to household nutrition

---

## 11. COMPOST TRACKER

### Pile Management
- Multiple piles with names and locations
- Dimensions (width × length × height)
- Start date, last turned date
- Turn frequency with overdue alerts
- Estimated ready date
- Status lifecycle: building → cooking → curing → ready
- Temperature tracking
- Moisture levels (dry/ideal/wet)

### Ingredient Logging
- 12+ pre-configured materials with carbon:nitrogen ratios
- Green (high nitrogen) vs. Brown (high carbon) categories
- Automatic C:N ratio calculator with ideal-range guidance (25-35:1)
- Amount (volume or weight)
- Date added

### Actions
- Record turns (with alerts if overdue past frequency window)
- Mark pile as ready/completed
- Focus-based navigation from dashboard

---

## 12. PHOTO GALLERY (Garden Journal)

### Gallery Features
- Responsive thumbnail grid
- Lightbox viewer with previous/next navigation
- Categories: garden, harvest, plants, progress, pest, disease, other
- Date-based sorting
- Upload date tracking

### Photo Associations
Photos can be tagged to:
- Specific garden beds
- Specific plants
- Specific planted items
- Livestock
- General garden use

### Actions
- Upload (drag-drop or browse)
- Edit caption, category, association
- Delete with confirmation
- Search by caption/filename
- Filter by category (multi-select), date range

---

## 13. WEATHER & ALERTS

### Current Weather
- City, zip code, zone, current temp, conditions, icon

### Forecast
- 7-day forecast: high/low, precipitation, humidity, wind, UV
- Growing Degree Days (GDD) accumulation
- Cumulative seasonal GDD tracker

### Alert System

**Frost Alerts** (≤ 32°F)
- Severity: watch (frost) / warning (freeze)
- Protection recommendations

**Heat Alerts** (≥ 85°F)
- Advisory (85-89°F) / watch (90-94°F) / warning (95°F+)
- Shade/watering recommendations

**Rain Alerts** (≥ 0.25")
- Expected inches and time window
- Skip-irrigation-day suggestions

### Data Sources
- Open-Meteo API (free weather forecasts)
- Historical soil temperature data
- Mulch-adjusted temperature modeling (8 mulch types with season-specific adjustments)

### Settings
- Zip code / location input
- Alert preferences (show/hide types, severity thresholds)

---

## 14. NUTRITIONAL DASHBOARD

Tracks how much nutrition your homestead actually produces.

### Aggregation
- Combined totals from: garden crops + livestock (eggs/meat/honey/milk) + fruit/nut trees
- Calories, protein, carbs, fat, fiber
- Micronutrients: Vitamin A, C, K, calcium, iron, magnesium, potassium
- % of recommended daily allowance (RDA)

### Drill-down Views
- Per-source breakdown (garden / livestock / trees)
- Per-plant or per-animal nutrition
- Seasonal breakdown by month/quarter
- Year selector with multi-year trends

### USDA FoodData Central Integration
- Search 170,000+ foods
- Import verified nutrition profiles
- Baseline database of 30+ crops pre-loaded
- Admin interface for managing baseline data

### Export
Download nutrition summary as CSV with totals, RDA %, source breakdowns.

---

## 15. CROP ROTATION TRACKING

### Family-Based Rotation
Tracks botanical families to prevent disease and pest buildup:
- Solanaceae (tomato, pepper, eggplant)
- Brassica (cabbage, broccoli, kale)
- Legume (beans, peas)
- Cucurbit (squash, cucumber, melon)
- Allium (onion, garlic, leek)
- Root crops, leafy greens, etc.

### 3-Year Validation
- Bed history tracking (what was planted where, by date)
- Warning if same family planted within 3 years
- Automatic alternative bed suggestions
- Override option for intentional repeats

### Rotation Visualization
- Yellow warnings on Garden Designer
- Shows last occurrence and recommended wait time
- Rotation plan preview by family cycle

---

## 16. SUCCESSION PLANNING

### Succession Features
- Preference scale 0–8 (none → very heavy)
- Automatic scheduling based on crop DTM
- Link events via succession group ID (UUID)
- Row continuity tracking (adjacent segments as one logical row)
- Per-seed succession overrides

### Suitability Analysis
Calculates ideal/good/limited/unsuitable based on:
- Heat/cold tolerance
- DTM vs. your growing season length
- Seasonal preference

### Date-Aware Counters
The sidebar progress shows plants expected in-ground on the viewed date, not full-season totals, computing active successions dynamically.

---

## 17. AUTHENTICATION & USER MANAGEMENT

### User System
- Registration with username/email/password validation (username 3-30 chars, email format, password strength)
- Login with "Remember me" option
- Session management via Flask-Login
- Password hashing (Werkzeug)
- Last login tracking

### User Profile
Location (zip code, city, zone), frost date overrides, preferences

### Admin Panel (admin-only tab)
- User statistics: total, admins, active (30-day), recent registrations
- Search by username/email
- Filter: all / admins / regular / recent
- Sort by created date, username, last login
- **Add/edit/delete users**
- **Reset password** with optional force-reset on next login
- Admin role toggle (prevents removing last admin)
- Cascade deletion warning when removing users with data

---

## 18. GARDEN SNAPSHOT

### Capabilities
- Select any past or future date
- Visual grid showing exactly what was or will be in ground
- Plant cells show: icon, variety, quantity, transplant date, expected harvest
- Sort by bed name, plant, harvest date
- Filter by plant category, status (growing/harvested), bed
- Click bed to expand with full planted items table

---

## 19. SIMULATION TOOLBAR (internal QA / testing utility — not an end-user feature)

An internal QA/testing utility used during development and site-review passes to validate date-aware behavior (dashboard signals, calendars, snapshots, seasonal alerts, year-boundary transitions). It is **not part of the normal end-user experience** and is **hidden outside of development** (`NODE_ENV !== 'development'` returns `null`). It may be removed, disabled, or hidden permanently once site validation is complete.

### Toolbar (floating, bottom-right — development only)
- Real date vs. simulated date display
- Red highlight when simulation is active
- Set specific date (date input)
- Quick presets: Jan 1, Mar 1, Apr 15, Jun 1, Aug 1, Oct 15, Dec 1
- Advance buttons: +1 day, +7 days, +30 days, +365 days
- Clear simulation to return to real date

### Purpose
Lets QA / site-review exercise every date-aware feature without waiting for real time to pass: dashboard signals, planting calendar, Garden Snapshot, frost/heat alerts, and header date display all read from the overridden "current date" while simulation is active.

---

## 20. PLANTING METHODOLOGY SUPPORT (5 Methods)

### Square Foot Gardening (SFG)
- 12"×12" cells (adjustable)
- Fixed 1, 4, 9, or 16 plants per cell by crop
- Compact bed layout

### MIGardener Intensive
- 3" cells (finest resolution)
- Row-based, broadcast, or plant-spacing variants
- Seed density tracking (seeds per inch or per sqft)
- Row continuity via row_group_id
- Thinning tracking (3 seeds → thin to 1)
- 30+ crops documented

### Row Planting
- Traditional rows with customizable spacing
- Trellis-compatible for climbing crops
- Ideal for succession

### Biointensive (Jeavons)
- 6" cells with hexagonal packing (~15% more efficient)
- Double-dug 24" beds
- Maximum yield per square foot

### Trellis / Vertical
- Linear-foot-based allocation
- Position tracking in inches (start/end)
- Overlap detection
- Capacity calculation per trellis

All methods can be mixed within a single user's garden — each bed picks its own method.

---

## 21. SEED SAVING LIFECYCLE

### End-to-End Tracking
1. **Mark for seed**: Toggle `save_for_seed` on a planted item → status becomes "saving-seed"
2. **Seed maturity date**: Auto-calculated (`harvest_date + days_to_seed`, or `transplant + DTM + days_to_seed`)
3. **Extended time in ground**: PlantingEvent expected harvest extended to seed maturity
4. **Collection modal**: When mature, record packets, seeds per packet, germination rate, notes
5. **New inventory entry**: Creates SeedInventory item flagged as `is_homegrown` with `source_planted_item_id` link
6. **Status restoration**: Turning off the toggle restores previous status (harvested → transplanted → growing → planned hierarchy)

---

## 22. CSV IMPORT / EXPORT

### Seed CSV Import
- File upload (browse or drag-drop)
- Auto-detect column mapping
- Preview before import
- Bulk creates inventory records
- Supplier-aware type detection: "Romaine" → lettuce-1, "Beefsteak" → tomato-1
- Supports 14+ crop types
- Error reporting (invalid rows, missing fields)

### Plan Export to Calendar
- Converts GardenPlanItems to PlantingEvents
- Idempotent via export_key (re-exports don't duplicate)
- Temporal conflict detection with override option
- Status updates plan to "exported"

### Nutrition CSV Export
- Totals, RDA %, source breakdown, per-plant data
- Downloadable spreadsheet

### Bed Layout Export
Export individual bed layout for printing or sharing.

---

## 23. CONFLICT DETECTION SYSTEMS

### Spatial Conflicts
- Chebyshev distance (grid-based spacing math)
- Plant-spacing-aware footprint calculation
- Multi-cell plant collision
- Trellis position overlap (linear inches)

### Temporal Conflicts
- Date range overlap (planted → harvest)
- Cross-crop conflict detection
- Succession-aware (ignores intentional overlaps in same group)

### Resolution Tools
- **Conflict Audit Modal** — lists everything with severity
- Auto-resolve (removes old/smaller events)
- Manual trim/delete
- Override flag for intentional overlaps
- Pre-export preview with 409 block

---

## 24. FROST & ZONE MANAGEMENT

### Frost Dates
- Per-property overrides (specific to your site)
- USDA hardiness zone lookup (1a-13b)
- Zone-based average fallbacks
- Zip code resolution via phzmapi.org (primary) + state-based fallback

### Hardiness Zone Detection
- Address geocoding to coordinates
- Zone lookup from coordinates
- Display in header: city, zip, zone

### Soil Temperature
- Historical daily soil temps
- Forecast integration
- 2"/4"/8" depth readings
- Planting readiness per crop (minimum soil temp)
- Mulch modeling:
  - 8 types: none, straw, wood chips, leaves, grass, compost, black plastic, clear plastic
  - Season-specific adjustments (spring delays, summer cools, winter insulates)

---

## 25. MAPLE TAPPING CALCULATOR

A niche-but-cool homestead feature.

### Season Estimation
- Freeze-thaw cycle detection (nights <32°F, days >32°F)
- 7-day forecast scanning via Open-Meteo
- Latitude-based season windows (late Feb to early April typical)
- Confidence levels (high/medium/low)

### Maple Tapping Events
- Tree selection from placed structures
- Tap count per tree
- Collection date series
- Sap amount per collection
- Final syrup yield (grade, amount, notes)
- Sugar content notes (2-2.5% for sugar maple)

---

## 26. DASHBOARD SNOOZE SYSTEM

- Per-signal snoozing for N days
- Hide without deleting the underlying task
- Per-user snooze list (others aren't affected)
- Unique constraint on signal_key per user
- Restore (un-snooze) when needed

---

## 27. EVENT DETAILS POLYMORPHISM

PlantingEvent can represent many activities beyond planting. Each event type stores structured JSON details:

- **Planting** — plant_id, variety, dates, spacing, seed density fields
- **Mulch** — mulch type, depth, coverage
- **Fertilizing** — fertilizer type, amount
- **Irrigation** — duration, method
- **Maple-tapping** — tap count, sap amount, syrup grade

Schema validation via `event_details_validator.py` with 50+ tests.

---

## 28. PERMACULTURE ZONES

Beds can be classified with traditional permaculture zones:
- **Zone 0** — house/indoor
- **Zone 1** — daily access (herbs, salads)
- **Zone 2** — frequent (main veggies)
- **Zone 3** — infrequent (orchard, grain)
- **Zone 4** — minimal (foraging, wood)
- **Zone 5** — wilderness

Used to organize plantings by management intensity.

---

## 29. SEASON EXTENSION TRACKING

Per-bed season extension configuration:
- **Types**: cold frame, row cover, cloche, low tunnel, high tunnel, greenhouse plastic
- **Layer count** (single or double)
- Material notes
- **Shade cloth settings** — installed flag, shade factor (30-80%)
- Affects frost tolerance calculations for plants in that bed
- Supports techniques from Eliot Coleman (Four-Season Harvest, Persephone Period) and Nico Jabour (quick hoops, caterpillar tunnels)

---

## 30. TECHNICAL UNDERPINNINGS (for context)

### Database
- 26 primary data models with cascade-delete relationships
- Soft-delete (cancelled_at) for reversible cancellations
- Indexed foreign keys on heavy-query fields
- 16 documented Flask-Migrate migrations + 51 custom scripts

### API Architecture
- 20 Flask blueprints
- 17 service-layer modules (business logic separated from routes)
- Paired backend/frontend calculators (validated for parity via sync validator)

### Frontend Stack
- React 19 + TypeScript
- @dnd-kit for drag-and-drop
- Tailwind CSS utility styling
- date-fns for date math
- Environment-aware API configuration

### Testing
- ~220+ E2E tests via Playwright across 16+ modules
- Coverage includes: authentication, garden planning, livestock, nutrition, weather, compost, harvests, seeds, calendar, designer, beds

---

## 31. WHAT IT CAN'T DO (Yet)

Notable gaps if you're considering scope:

- **No native mobile app** (responsive web only)
- **No email notifications** (infrastructure isn't wired up)
- **No foraging tracker**
- **No fishing or hunting logs**
- **No solar / energy monitoring**
- **No tool inventory**
- **No meat processing tracker** (livestock exists, processing doesn't)
- **No water usage tracking** (rain barrels exist as structures only)
- **No food preservation / canning logs**
- **No calendar sync with Google Calendar / iCal** (infrastructure ready, not wired)

---

## SUMMARY

This is a **production-grade, multi-user homestead management platform** with roughly:

- **26** data models
- **20** API blueprints
- **17** service modules
- **100+** plant varieties with full agronomic data
- **24+** chicken breeds in reference data
- **205** plant icons, **63** structure icons
- **5** gardening methodologies (mixable per bed)
- **14+** distinct application areas (dashboard, planner, designer, calendar, indoor starts, harvest, seeds, livestock, compost, photos, weather, nutrition, property, admin)
- **200+** distinct user-facing actions
- **~220** end-to-end tests
