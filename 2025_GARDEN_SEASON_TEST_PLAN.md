# 2025 Garden Season Simulation — Test Plan

## Context

We're designing a realistic 2025 garden season for a **Zone 6a** homestead, then using it to drive Playwright tests through the entire app. One user (`sitetest`) lives through the whole year — indoor starts in February, transplants in May, harvests through summer, seed saving in fall. Every feature gets exercised the way a real gardener would use it.

**Zone 6a key dates:**
- Last frost: **April 25**
- First frost: **October 20**
- Growing season: ~180 days

---

## The Property

- **Name**: Test Homestead 2025
- **Size**: 100' x 100'
- **Structures**: Chicken coop, beehive stand, compost area
- **Trellis**: One 10' post-and-wire trellis along the south side of Bed 5

---

## The 5 Garden Beds

### Bed 1: SFG Bed (Square Foot Gardening)
- **Size**: 4' x 8' (32 squares, 12" grid)
- **Method**: `square-foot`
- **Goal**: Every square planted all season. When early crops finish, succession/relay crops fill the space.

**Spring (Apr 1 – May)**
| Squares | Crop | Per Square | Total | Plant Date | Done By |
|---------|------|-----------|-------|------------|---------|
| 4 | Radish (Cherry Belle) | 16 | 64 | Apr 1 (direct) | May 10 |
| 4 | Lettuce (Butterhead) | 4 | 16 | Apr 1 (direct) | Jun 1 |
| 4 | Spinach (Bloomsdale) | 9 | 36 | Apr 1 (direct) | May 30 |
| 4 | Carrots (Nantes) | 16 | 64 | Apr 1 (direct) | Jul 1 |

**Warm Season (May 1 – replaces spring crops as they finish)**
| Squares | Crop | Per Square | Total | Plant Date | Done By |
|---------|------|-----------|-------|------------|---------|
| 4 | Tomato (Brandywine) | 1 | 4 | May 1 (transplant) | Sep 30 |
| 4 | Pepper (Bell) | 1 | 4 | May 1 (transplant) | Sep 30 |
| 4 | Basil (Genovese) | 4 | 16 | May 15 (transplant) | Sep 30 |
| 4 → radish squares | Bush Beans (Provider) | 9 | 36 | May 15 (direct, replaces radish) | Aug 15 |

**Summer Relay (Jun 15 – fills lettuce/spinach squares)**
| Squares | Crop | Per Square | Total | Plant Date | Done By |
|---------|------|-----------|-------|------------|---------|
| 4 → lettuce squares | Lettuce #2 (Butterhead) | 4 | 16 | Jun 15 (direct) | Aug 15 |
| 4 → spinach squares | Bush Beans #2 (Provider) | 9 | 36 | Jun 15 (direct) | Sep 15 |

**Fall Relay (Aug 15 – fills bean/carrot squares)**
| Squares | Crop | Per Square | Total | Plant Date | Done By |
|---------|------|-----------|-------|------------|---------|
| 4 → bean squares | Lettuce #3 (Butterhead) | 4 | 16 | Aug 15 (direct) | Oct 15 |
| 4 → carrot squares | Radish #2 (Cherry Belle) | 16 | 64 | Aug 15 (direct) | Sep 30 |

### Bed 2: Row Bed (Traditional Row)
- **Size**: 4' x 12'
- **Method**: `row`
- **Goal**: Relay plant rows when spring crops finish.

**Spring (Apr 1)**
| Row | Crop | Spacing | Total | Plant Date | Done By |
|-----|------|---------|-------|------------|---------|
| 1 | Peas (Sugar Snap) | 3" | 48 | Apr 1 (direct) | Jun 30 |
| 2 | Onions (Yellow Sweet) | 4" | 36 | Apr 1 (sets) | Aug 1 |
| 3 | Green Beans (Blue Lake) | 6" | 24 | May 15 (direct) | Aug 30 |
| 4 | Sweet Corn (Golden Bantam) | 12" | 12 | May 15 (direct) | Aug 20 |

**Fall Relay (Jul 1 – pea row cleared)**
| Row | Crop | Spacing | Total | Plant Date | Done By |
|-----|------|---------|-------|------------|---------|
| 1 → pea row | Fall Beans (Blue Lake #2) | 6" | 24 | Jul 1 (direct) | Sep 30 |
| 4 → corn row | Fall Peas (Sugar Snap #2) | 3" | 48 | Aug 25 (direct) | Oct 20 |

### Bed 3: Intensive Bed (Biointensive)
- **Size**: 4' x 8'
- **Method**: `intensive`
- **Goal**: Cut-and-come-again greens stay all season. Roots relay into fall crops.

**Spring (Apr 1 – Apr 15)**
| Crop | Spacing | Total | Plant Date | Done By |
|------|---------|-------|------------|---------|
| Kale (Lacinato) | 12" | 8 | Apr 15 (transplant) | Oct 20 (stays all season) |
| Swiss Chard (Rainbow) | 10" | 10 | Apr 15 (direct) | Oct 20 (stays all season) |
| Beets (Detroit Dark Red) | 4" | 32 | Apr 1 (direct) | Jul 1 |

**Fall Relay (Jul 15 – beet space cleared)**
| Crop | Spacing | Total | Plant Date | Done By |
|------|---------|-------|------------|---------|
| Turnips (Purple Top) | 4" | 32 | Jul 15 (direct) | Oct 20 |
| Beets #2 (Detroit Dark Red) | 4" | 16 | Aug 1 (direct) | Oct 20 |

### Bed 4: MIGardener Bed (Seed Density)
- **Size**: 4' x 8'
- **Method**: `migardener`
- **Goal**: Continuous salad greens. Resow every 3 weeks.

| Crop | Style | Total | Plant Date | Done By |
|------|-------|-------|------------|---------|
| Lettuce Mix (broadcast) | seed-density | ~200 seeds | Apr 1 | Jun 1 |
| Arugula (broadcast) | seed-density | ~150 seeds | Apr 1 | Jun 1 |
| Cilantro (broadcast) | seed-density | ~100 seeds | Apr 15 | Jun 30 |
| Lettuce #2 (broadcast) | seed-density | ~200 seeds | Jun 15 (relay) | Aug 15 |
| Arugula #2 (broadcast) | seed-density | ~150 seeds | Jun 15 (relay) | Aug 15 |
| Lettuce #3 (broadcast) | seed-density | ~200 seeds | Aug 15 (relay) | Oct 15 |
| Spinach (broadcast) | seed-density | ~150 seeds | Sep 1 (fall) | Oct 20 |

### Bed 5: Trellis Bed (Vertical)
- **Size**: 4' x 8' with 10' trellis
- **Method**: `square-foot` (bed) + `trellis_linear` (trellis plants)
- **Goal**: Trellis stays full. Ground level relays from spring to fall.

**Spring Ground (Apr 1)**
| Crop | Location | Total | Plant Date | Done By |
|------|----------|-------|------------|---------|
| Lettuce (Romaine) | Ground, 4 sq | 16 | Apr 1 (direct) | Jun 1 |

**Warm Season (May 15)**
| Crop | Location | Total | Plant Date | Done By |
|------|----------|-------|------------|---------|
| Cucumber (Marketmore) | Trellis | 4 | May 15 (transplant) | Sep 15 |
| Pole Beans (Kentucky Wonder) | Trellis | 8 | May 15 (direct) | Sep 30 |
| Squash (Butternut) | Ground, 4 sq | 2 | May 15 (transplant) | Oct 1 |

**Summer Relay (Jun 15 – lettuce squares cleared)**
| Crop | Location | Total | Plant Date | Done By |
|------|----------|-------|------------|---------|
| Bush Beans (Provider) | Ground, 4 sq | 36 | Jun 15 (direct, replaces lettuce) | Sep 1 |

---

## Livestock

| Animal | Breed | Count | Start Date |
|--------|-------|-------|------------|
| Chickens | Rhode Island Red | 6 hens | Mar 1 (already laying) |
| Beehive | Langstroth | 1 hive | Apr 1 (installed) |

**Egg production**: ~4-5 eggs/day starting March
**Hive inspections**: Monthly (Apr, May, Jun, Jul, Aug)
**Honey harvest**: Late Jul (~10 lbs)

---

## Compost

- **Pile 1**: Started Mar 15
  - Green: grass clippings (5 cu ft), food scraps (3 cu ft)
  - Brown: dried leaves (10 cu ft), straw (5 cu ft)
  - Turned: monthly (Apr 15, May 15, Jun 15)
  - Ready: ~Jul 15

---

## Indoor Seed Starts

| Crop | Start Date | Weeks Indoor | Transplant Date |
|------|-----------|-------------|-----------------|
| Tomato (Brandywine) | Feb 25 | 8 weeks | May 1 |
| Pepper (Bell) | Feb 25 | 10 weeks | May 1 |
| Basil (Genovese) | Mar 25 | 6 weeks | May 15 |
| Kale (Lacinato) | Mar 1 | 6 weeks | Apr 15 |
| Cucumber (Marketmore) | Apr 1 | 4 weeks | May 15 |
| Squash (Butternut) | Apr 1 | 4 weeks | May 15 |

---

## Seed Saving

| Crop | Mark Date | Maturity Date | Collect Date |
|------|-----------|---------------|--------------|
| Tomato (Brandywine) | Aug 15 | Sep 15 | Sep 20 |

---

## Season Timeline (Test Simulation Steps)

Each step = one "day" in the test. Beds are always full — when one crop finishes, the relay crop goes in immediately.

| Step | Date | Actions | Bed Status |
|------|------|---------|------------|
| 1 | Jan 15 | Create property, beds, garden plan. Add all spring crops. Add seed inventory. | Setup only |
| 2 | Feb 25 | Indoor start: tomatoes, peppers | Indoor |
| 3 | Mar 1 | Indoor start: kale. Add 6 chickens. Start compost pile. | Indoor, Livestock, Compost |
| 4 | Mar 25 | Indoor start: basil, cucumber, squash | Indoor |
| 5 | Apr 1 | Direct sow all spring crops. Install beehive. Export plan to calendar. Upload first photo. | **All 5 beds fully planted** |
| 6 | Apr 15 | Transplant kale + chard to Bed 3. Hive inspection. Turn compost. Log first eggs. | Bed 3 transplants in |
| 7 | May 1 | **Last frost.** Transplant tomatoes + peppers → Bed 1 (warm season squares). | Bed 1: 32/32 squares full |
| 8 | May 10 | Harvest radishes (Bed 1). **Relay:** sow bush beans in radish squares. | Bed 1: radish→beans, still full |
| 9 | May 15 | Transplant basil, cucumbers, squash. Direct sow corn, beans, pole beans. | Bed 1,2,5 warm season complete |
| 10 | May 30 | Harvest spinach (Bed 1). **Relay:** sow beans #2 in spinach squares. | Bed 1: spinach→beans, still full |
| 11 | Jun 1 | Harvest: lettuce (Bed 1,4,5), peas (Bed 2), arugula (Bed 4). Log harvests. Photo. Hive inspection. | Multiple harvests logged |
| 12 | Jun 15 | **Relay:** lettuce→lettuce #2 (Bed 1). lettuce/arugula→lettuce #2+arugula #2 (Bed 4). lettuce→bush beans (Bed 5). Turn compost. | Beds 1,4,5 relayed, still full |
| 13 | Jul 1 | Harvest beets (Bed 3), peas done (Bed 2). **Relay:** pea row→fall beans (Bed 2). beets→turnips (Bed 3). Honey harvest 10 lbs. Hive inspection. | Beds 2,3 relayed |
| 14 | Jul 15 | Compost ready. Harvest carrots (Bed 1). **Relay:** carrot squares→fall radish (Bed 1). | Bed 1: carrot→radish |
| 15 | Aug 1 | Major harvest: tomatoes, peppers, cucumbers, corn. **Relay:** beet area→fall beets #2 (Bed 3). Hive inspection. | All beds producing |
| 16 | Aug 15 | Harvest beans (Bed 1). **Relay:** bean squares→lettuce #3 (Bed 1). MIGardener relay: lettuce #3 + fall spinach (Bed 4). Mark tomato for seed saving. | Beds 1,4 fall relay |
| 17 | Aug 25 | **Relay:** corn row→fall peas (Bed 2). | Bed 2 fall relay |
| 18 | Sep 1 | Harvest fall lettuce, arugula (Bed 4). | Bed 4 |
| 19 | Sep 15 | Collect tomato seeds. Harvest fall radish, lettuce #3. Final hive inspection. | Seed saving complete |
| 20 | Oct 1 | Final harvests: squash, kale, chard, turnips, fall beets, fall peas, fall beans. | Season winding down |
| 21 | Oct 20 | **First frost.** Garden snapshot: only kale + chard still active. Check nutrition dashboard totals. | Season complete |

**Running throughout all steps:**
- Egg production: logged at every step from Step 6 onward
- Photos: Steps 5, 11, 15
- Compost: turned at Steps 6, 12; ready at Step 14

---

## What This Tests (App Features Exercised)

| Feature | Steps | Why It Matters |
|---------|-------|---------------|
| Property Designer | 1 | Create property + trellis structure |
| Garden bed CRUD (all 5 methods) | 1 | One bed per method: SFG, row, intensive, MIGardener, trellis |
| Garden Season Planner | 1, 8, 12-17 | Plan spring + relay crops, beds always full |
| Export to Calendar | 5 | Push plan into planting events |
| Indoor Seed Starts → Transplant | 2-9 | 6 crops started indoors, transplanted into beds |
| Direct sowing | 5, 8, 9 | Cool + warm season direct sow |
| Relay/succession planting | 8,10,12-17 | **12 relay plantings** — every cleared square gets replanted |
| Trellis planting | 1, 9 | Cucumbers + pole beans on trellis |
| Harvest tracking | 8-20 | Continuous harvests from May through October |
| Seed saving lifecycle | 16, 19 | Mark tomato → wait → collect seeds |
| Livestock + egg production | 3, 6-21 | 6 chickens, eggs logged weekly |
| Beehive + inspections + honey | 5, 6, 11, 13, 15, 19 | 5 inspections + 1 honey harvest |
| Compost pile lifecycle | 3, 6, 12, 14 | Build → turn → turn → ready |
| Photo gallery | 5, 11, 15 | Photos at key milestones |
| Garden snapshot | 11, 21 | Point-in-time: what's in ground on Jun 1 vs Oct 20 |
| Nutrition dashboard | 21 | Final totals: garden + eggs + honey |
| Bed utilization | Every step | **Verify no empty beds** — the core test |
| Nutrition dashboard | 17 |
| Garden snapshot (point-in-time) | 9, 17 |
| Future plantings overlay | 5 |
| Quick harvest filter | 9 |
| Plant Guilds | 1 (if we want to test inserting a guild) |
| Admin panel | (already tested) |

---

## Summary

- **5 beds**, one per planting method, all full all season
- **12 relay plantings** — when a crop finishes, the next one goes in immediately
- **6 indoor starts** transplanted into beds
- **30+ crops** across cool season, warm season, and fall
- **21 simulation steps** from January to October
- **Livestock**: 6 chickens (eggs weekly) + 1 beehive (5 inspections, 1 honey harvest)
- **Compost**: 1 pile through full lifecycle
- **Seed saving**: 1 tomato variety, full mark → collect cycle
- **Every app feature** exercised through realistic gardener actions
