# MIGardener Planting Configuration Reference

**Complete Reference for Homestead Planner**
**Last Updated**: 2026-01-18

---

## Overview

This document provides a comprehensive reference for all MIGardener planting configurations in the Homestead Planner application, organized by planting style with complete spacing parameters, seed density calculations, and critical growing constraints based on Luke Marion's high-intensity gardening method.

---

## Table of Contents

1. [Planting Styles Overview](#planting-styles-overview)
2. [Broadcasting Styles](#broadcasting-styles)
3. [Row-Based Styles](#row-based-styles)
4. [Plant-Spacing Styles](#plant-spacing-styles)
5. [Backend Spacing Overrides](#backend-spacing-overrides)
6. [Calculation Logic](#calculation-logic)
7. [Important Rules & Constraints](#important-rules--constraints)

---

## Planting Styles Overview

| Style | Use Case | Examples | Key Features |
|-------|----------|----------|--------------|
| **broadcast** | Dense leaf crops | Spinach | No rows; dense seed sowing; self-thinning |
| **row_based** | Leafy/dense crops | Arugula, Lettuce | Defined rows; seed-per-inch density; continuous harvest |
| **plant_spacing** | Individual plants | Most vegetables; herbs; fruits | Discrete spacing; single or multi-seed spots; thinning optional |

---

## Broadcasting Styles

Dense spreading with no defined rows.

### Spinach (`spinach-1`)

- **Planting Style**: broadcast
- **Seed Density**: 50 seeds/sq ft (~1 tsp eyeballed)
- **Row Spacing**: None (dense patch coverage)
- **Germination Rate**: 80%
- **Survival Rate**: 30%
- **Final Spacing**: 1 inch (self-thinning)
- **Harvest Method**: cut_and_come_again
- **Maturity**: 40 days from seed
- **Expected Count**: ~1,000 seeds per 4×8 bed
- **Notes**: Dense patch method for baby leaf harvest; self-thinning to final 1" spacing

---

## Row-Based Styles

Defined rows with in-row seed density.

### Arugula (`arugula-1`)

- **Planting Style**: row_based
- **Seed Density Per Inch**: 1 seed/inch
- **Row Spacing**: 4 inches
- **Germination Rate**: 90%
- **Survival Rate**: 30%
- **Final Spacing**: 0.75 inches
- **Harvest Method**: cut_and_come_again
- **Maturity**: 35 days from seed
- **Expected Count**: ~1,152 seeds in 4×8 bed
- **Notes**: Realistic seeding density; self-thinning emerges from dense seeding

### Lettuce (`lettuce-1`)

- **Planting Style**: row_based
- **Seed Density Per Inch**: 1 seed/inch
- **Row Spacing**: 4 inches
- **Germination Rate**: 85%
- **Survival Rate**: 25%
- **Final Spacing**: 1 inch
- **Harvest Method**: cut_and_come_again
- **Maturity**: 45 days from seed
- **Expected Count**: ~1,000 seeds in 4×8 bed
- **Notes**: Realistic seeding density; cut outer leaves continuously

---

## Plant-Spacing Styles

Individual spots with single or multi-seed placement.

### Tubers & Root Crops

#### Potato (`potato-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 whole seed potato
- **Plants Kept Per Spot**: 1 (no thinning - let all stems grow)
- **Final Spacing**: 9 inches in-row
- **Row Spacing**: 20 inches (7 rows per 12' bed)
- **Germination Rate**: 90%
- **Survival Rate**: 95%
- **Harvest Method**: individual_root
- **Maturity**: 90 days from seed
- **Critical Notes**:
  - One whole seed potato produces 3-4 plants
  - Luke Marion method: "Potatoes don't mind being crowded"
  - Tight spacing INCREASES total bed yield
  - Hill soil as plants grow
  - Multiple stems per seed potato create heavy foliage coverage

#### Beet (`beet-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 2 seeds per spot
- **Plants Kept Per Spot**: 1 best beet after thinning
- **Final Spacing**: 4 inches (3-4" range; use 3" for high-density small beets)
- **Germination Rate**: 75%
- **Survival Rate**: 95%
- **Harvest Method**: individual_head
- **Maturity**: 55 days from seed
- **Notes**: Beet "seeds" are multi-germ clusters (2-4 seedlings each); unreliable germination requires insurance planting

---

### Bean Family

#### Bush Bean (`bean-bush-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 3 seeds per spot
- **Plants Kept Per Spot**: 1 healthiest plant
- **Final Spacing**: 6 inches
- **Germination Rate**: 85%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 55 days from seed
- **Notes**: Direct sow after soil 60°F; avoid high nitrogen

#### Pole Bean (`bean-pole-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 3 seeds per spot
- **Plants Kept Per Spot**: 1 healthiest plant
- **Final Spacing**: 6 inches
- **Germination Rate**: 85%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 65 days from seed
- **Notes**: Requires trellis support; same spacing as bush varieties

---

### Nightshade Family

#### Pepper (`pepper-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 transplant
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 18 inches minimum
- **Germination Rate**: 85%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 70 days from seed
- **Luke Marion's Rule**: "Never space less than 18 inches apart"
- **Rationale**: Large root systems need ~1 sq ft soil minimum; 12" spacing = competition and reduced fruit
- **Notes**: 18" = center-to-center spacing (not edge spacing); wait for warm nights >50°F

#### Eggplant (`eggplant-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 transplant
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 15 inches (standard; 12-18" range possible)
- **Germination Rate**: 85%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 75 days from seed
- **Notes**: Slight crowding (12-15") increases total bed yield; transplant only; needs 5+ hours full sun

---

### Cucumber Family

#### Cucumber - Bush (`cucumber-bush-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 3 seeds per hill
- **Plants Kept Per Spot**: 1 strongest
- **Final Spacing**: 12 inches
- **Germination Rate**: 85%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 55 days from seed
- **Notes**: Compact, minimal vining; direct sow at 65°F

#### Cucumber - Vining Trellised (`cucumber-vining-trellised-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 3 seeds per hill
- **Plants Kept Per Spot**: 1 strongest
- **Final Spacing**: 18 inches minimum
- **Germination Rate**: 85%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 60 days from seed
- **Notes**: Vertical growth + airflow allows tighter spacing (18" vs 36" for ground)

#### Cucumber - Vining Ground (`cucumber-vining-ground-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 3 seeds per hill
- **Plants Kept Per Spot**: 1 strongest
- **Final Spacing**: 36 inches (3 ft) MINIMUM - NON-NEGOTIABLE
- **Germination Rate**: 85%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 60 days from seed
- **Luke Marion Quote**: "If you're growing in the ground, do not give them any less than 3 feet"
- **Rationale**: Airflow critical for powdery mildew prevention

---

### Melons & Large Crops

#### Watermelon (`watermelon-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 3 seeds per hill
- **Plants Kept Per Spot**: 1 strongest
- **Final Spacing**: 60 inches (5 ft) NON-NEGOTIABLE
- **Germination Rate**: 80%
- **Survival Rate**: 95%
- **Harvest Method**: individual_head
- **Maturity**: 80 days from seed
- **Luke Marion Quote**: "Watermelon is a garden hog"
- **Area Requirement**: 25 sq ft minimum per plant
- **Notes**: Vines spread aggressively; massive root system

#### Okra (`okra-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 seed/plant
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 10 inches
- **Germination Rate**: 75%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 60 days from seed
- **Notes**: Tall (4-5 ft), spindly; minimal horizontal spread; heat-loving (75°F soil minimum)

---

### Grains & Block Crops

#### Corn - Sweet Corn (`corn-1`)

- **Planting Style**: plant_spacing (requires BLOCK-BASED minimum 4×4 ft)
- **Seeds Per Spot**: 1 seed per spot at 6" spacing OR over-seed at 2-3" then thin
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 6 inches
- **Germination Rate**: 80%
- **Survival Rate**: 95%
- **Harvest Method**: individual_head
- **Maturity**: 85 days from seed
- **CRITICAL CONSTRAINTS**:
  - MINIMUM viable block: 4×4 ft (16 sq ft)
  - Wind pollination required - smaller blocks fail
  - Sun: MINIMUM 7 hours (ideal 8-10+); <7 hrs = INVALID
  - Soil: 12-14" depth minimum, loose (shallow roots prone to lodging)
  - Temperature: Min soil 60°F (<50°F causes seed rot)
  - Nutrition: Very high nitrogen (grass crop); plant height determines ear size
- **Notes**: Direct sow after soil 60°F

#### Sunflower - Single-Headed Giant (`sunflower-single-headed-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 seed or thin to 1
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 15 inches (12-18" typical range)
- **Germination Rate**: 85%
- **Survival Rate**: 95%
- **Harvest Method**: individual_head
- **Maturity**: 80 days from seed
- **Notes**:
  - Giant varieties: 10-18 ft tall with dinner-plate heads
  - Massive root system and thick stalk
  - One flower per plant, then dies (annual)
  - Needs space to avoid lodging (falling over)
  - Deep taproot - does not transplant well
  - Luke: "Never tighter than 1-1.5 ft"

#### Peanut (`peanut-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 2 seeds per hole
- **Plants Kept Per Spot**: 1 strongest
- **Final Spacing**: 18 inches minimum
- **Germination Rate**: 75%
- **Survival Rate**: 95%
- **Harvest Method**: individual_root
- **Maturity**: 130 days from seed
- **CRITICAL GROWTH HABIT**:
  - Stems grow up, then fall onto soil
  - Flowers form along stems
  - MUST touch soil to form peanuts
  - NEVER trellis or lift off ground
  - Requires 120-150 days
  - Wide spacing essential for stem sprawl

---

### Brassicas

#### Broccoli (`broccoli-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 start/plug (transplant, not seed)
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 12 inches (10-12" range)
- **Germination Rate**: 90%
- **Survival Rate**: 95%
- **Harvest Method**: individual_head
- **Maturity**: 70 days from transplant
- **Notes**: Use starts, not direct seed; cold-hardy, flavor improves after frost; compact planting zone (stomp soil) to reduce clubroot risk

---

### Root Vegetables & Leafy Discretes

#### Swiss Chard (`swiss-chard-1`)

- **Planting Style**: plant_spacing (NOT row-based dense seeding)
- **Seeds Per Spot**: 1 plant (or thin to 1)
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 9 inches (8-10" range)
- **Germination Rate**: 80%
- **Survival Rate**: 95%
- **Harvest Method**: cut_and_come_again
- **Maturity**: 55 days from seed
- **Luke Marion's Quote**: "You want to space your plants out about every 8 to 10 inches"
- **Notes**: Discrete individual plants, NOT row-based continuous seeding; cut outer leaves first

#### Celery (`celery-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 start/plug (TRANSPLANTS ONLY, not direct seed)
- **Plants Kept Per Spot**: 1 (pinch off extra seedlings from plug at root level)
- **Final Spacing**: 12 inches
- **Germination Rate**: 90%
- **Survival Rate**: 95%
- **Harvest Method**: individual_head
- **Maturity**: 100 days from transplant
- **Critical Notes**:
  - Seeds are tiny → use transplants only
  - Often 2-3 seedlings per cell → pinch extras at root level
  - Plant at soil level
  - Blanching: mound soil when plant doubles in size (reduces bitterness, whitens stalks)
  - High water needs

---

### Perennial & Long-Cycle Crops

#### Asparagus (`asparagus-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 rhizome/crown
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 8 inches (7-8" range)
- **Germination Rate**: 90%
- **Survival Rate**: 95%
- **Harvest Method**: perennial_cutback
- **Maturity**: 730 days (2+ years before first harvest allowed)
- **CRITICAL PLANTING RULES**:
  - Crown must be at soil line (NOT buried deeper)
  - Minimum soil depth: 12" (deep root system for overwinter)
  - Mulch: Apply 1" leaf mulch to suppress weeds
  - pH: 6.5-7.5 (neutral)
  - Long-lived perennial: 20-30+ years
- **Harvest Rules**: Year 1 = NO harvest; Year 2 = minimal/ideally none; Year 3+ = can harvest (max ~2 rounds per season)

#### Artichoke (`artichoke-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 plant (transplant or crown division)
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 36 inches
- **Germination Rate**: 75%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 365 days (first year establishment)
- **Notes**: Large perennial; harvest flower buds before opening; 2.5-3 ft wide mature size

#### Ginger (`ginger-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 ginger piece (plant FLAT, not vertical)
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 24 inches (18-24" footprint range)
- **Germination Rate**: 90%
- **Survival Rate**: 95%
- **Harvest Method**: partial_harvest
- **Maturity**: 240 days (8+ months to full maturity)
- **UNIQUE GROWTH HABIT**:
  - Spreads SIDEWAYS, not down
  - Plant FLAT in wide/shallow hole (~1.5" deep)
  - Cover with ~1" soil
  - Needs wide space - narrow pots stunt growth
  - Diameter matters more than depth (18-24" minimum width)
  - Partial harvest: break off fingers as needed
  - Sprouts in 3-4 weeks

#### Grape (`grape-1`)

- **Planting Style**: plant_spacing (PLACEHOLDER - should be 'trellis_linear')
- **Seeds Per Spot**: 1 vine (bare-root or cutting)
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 60 inches (5 linear feet per plant along trellis)
- **Germination Rate**: 90%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 1095 days (3 years to first harvest)
- **CRITICAL NOTES**:
  - LINEAR ALLOCATION MODEL - each vine allocated 5 feet of trellis
  - Plant spacing: 5 feet between plants ALONG the trellis
  - One vine NEVER fills more than 5 linear feet
  - NOT compatible with: row-based placement, grid placement
  - ONLY compatible with: trellis zone placement
  - Full production by year 5

#### Fig Tree (`fig-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 tree (bare-root or potted)
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 66 inches (5-6 ft range)
- **Germination Rate**: 90%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 730 days (2 years to first fruit)
- **WIDE-CANOPY CHARACTERISTICS**:
  - Very wide canopy (large leaves, dense foliage)
  - 1 tree per 25-36 sq ft minimum
  - Poor airflow = disease risk
  - CAN BE WALL-ADJACENT: Plant next to south-facing wall for microclimate benefit
  - Still needs 3+ ft lateral clearance for canopy spread

#### Goji Berry (`goji-berry-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 plant (bare-root or potted)
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 30 inches (2-3 ft range)
- **Germination Rate**: 85%
- **Survival Rate**: 95%
- **Harvest Method**: continuous_picking
- **Maturity**: 730 days (2 years to first significant fruit)
- **SPRAWLING CHARACTERISTICS**:
  - Plant footprint: 24-26" diameter
  - Area per plant: 4-9 sq ft minimum
  - Growth habit: TALL, FLOPPY, WIDE
  - Produces fruit along entire stem
  - Sun requirement: 6+ hours minimum, ideally 10-11 hours

#### Shallot - From Sets (`shallot-from-sets`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 set
- **Plants Kept Per Spot**: 1 set (divides into cluster)
- **Final Spacing**: 10 inches (8-10" range)
- **Germination Rate**: 90%
- **Survival Rate**: 95%
- **Harvest Method**: individual_root
- **Maturity**: 90 days (~3 months: fall → overwinter → spring harvest)
- **CLUSTER BULB FORMATION**:
  - Each set divides into 4-8 bulbs (like garlic head)
  - Needs 8-10" spacing for cluster airflow
  - Plant depth: bulb below surface, tip barely poking out

#### Shallot - From Seed (`shallot-from-seed`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 seed (or thin to 1)
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 3 inches (2-3" range)
- **Germination Rate**: 75%
- **Survival Rate**: 90%
- **Harvest Method**: individual_root
- **Maturity**: 100 days (spring → summer harvest)
- **SINGLE BULB PRODUCTION**:
  - Spring direct sow
  - Each seed → single small bulb (becomes a "set")
  - Tight spacing 2-3" (small single bulb output)

---

### Herbs

#### Basil (`basil-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 plant (transplant or seed)
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 8 inches (6-10" range; backend uses 8" standard)
- **Row Spacing**: 12 inches
- **Germination Rate**: 80%
- **Survival Rate**: 95%
- **Harvest Method**: cut_and_come_again
- **Maturity**: 60 days from seed
- **Notes**:
  - Tighter (6") for upright varieties
  - Standard (8") for general planting
  - Wider (10") for bushy varieties
  - Very frost sensitive
  - Pinch flowers for bushy growth
  - Needs air circulation - don't crowd

#### Bee Balm (`bee-balm-1`)

- **Planting Style**: plant_spacing
- **Seeds Per Spot**: 1 plant (transplant preferred)
- **Plants Kept Per Spot**: 1
- **Final Spacing**: 24 inches
- **Germination Rate**: 70%
- **Survival Rate**: 95%
- **Harvest Method**: perennial_cutback
- **Maturity**: 365 days (first year establishment)
- **Notes**: Spreads over time (mint family); attracts pollinators

---

## Backend Spacing Overrides

The backend (`backend/migardener_spacing.py`) implements these overrides for dynamic spacing calculations:

```python
MIGARDENER_SPACING_OVERRIDES = {
    # Leafy Greens - Row-based for cut-and-come-again harvest
    'lettuce-1': (4, 1),          # 4" row spacing, 1" seed spacing - 1 seed/inch density (updated from None, 4)
    'arugula-1': (4, 1),          # 4" row spacing, 1" seed spacing - 1 seed/inch density (updated from None, 2)
    'spinach-1': (None, 4),       # 4" plant spacing (intensive/broadcast)
    'kale-1': (None, 8),          # 8" plant spacing
    'chard-1': (None, 9),         # 9" plant spacing
    'mustard-1': (None, 3),       # 3" plant spacing
    'bok-choy-1': (8, 6),         # Needs row spacing for head formation

    # Brassicas - Heading Types
    'cabbage-1': (18, 12),        # 18" rows, 12" in-row
    'broccoli-1': (18, 12),       # 18" rows, 12" in-row
    'cauliflower-1': (18, 12),    # 18" rows, 12" in-row
    'brussels-sprouts-1': (24, 18),  # 24" rows, 18" in-row

    # Root Vegetables & Tubers
    'radish-1': (4, 1),           # 4" rows, 1" in-row (36/sqft)
    'carrot-1': (6, 2),           # 6" rows, 2" in-row
    'beet-1': (12, 3),            # 12" rows, 3" in-row (updated from reference: 4")
    'turnip-1': (8, 3),           # 8" rows, 3" in-row
    'parsnip-1': (12, 3),         # 12" rows, 3" in-row
    'onion-1': (4, 4),            # 4" rows, 4" in-row
    'scallion-1': (4, 2),         # 4" rows, 2" in-row
    'potato-1': (24, 12),         # 24" rows, 12" in-row (updated from reference: 20" rows, 9" in-row)

    # Legumes
    'pea-1': (60, 1.5),           # 60" rows, 1.5" in-row
    'bean-1': (18, 5.5),          # 18" rows, 5.5" in-row (legacy)
    'bean-bush-1': (18, 6),       # 18" rows, 6" in-row (from reference)
    'bean-pole-1': (18, 6),       # 18" rows, 6" in-row (from reference)

    # Nightshade Family
    'pepper-1': (21, 18),         # 21" rows, 18" in-row (Luke Marion: never < 18")
    'eggplant-1': (18, 15),       # 18" rows, 15" in-row

    # Cucumber Family
    'cucumber-bush-1': (18, 12),         # 18" rows, 12" in-row
    'cucumber-vining-trellised-1': (24, 18),  # 24" rows, 18" in-row minimum
    'cucumber-vining-ground-1': (48, 36),     # 48" rows, 36" in-row MINIMUM

    # Melons & Large Crops
    'watermelon-1': (72, 60),     # 72" rows, 60" in-row (5 ft non-negotiable)
    'okra-1': (18, 10),           # 18" rows, 10" in-row

    # Grains & Block Crops
    'corn-1': (12, 6),            # 12" rows, 6" in-row (4×4 ft minimum block)
    'sunflower-single-headed-1': (18, 15),  # 18" rows, 15" in-row
    'peanut-1': (24, 18),         # 24" rows, 18" in-row minimum

    # Leafy Discretes
    'swiss-chard-1': (12, 9),     # 12" rows, 9" in-row (8-10" range)
    'celery-1': (18, 12),         # 18" rows, 12" in-row (transplants only)

    # Perennial & Long-Cycle Crops
    'asparagus-1': (12, 8),       # 12" rows, 8" in-row (7-8" range)
    'artichoke-1': (48, 36),      # 48" rows, 36" in-row (large perennial)
    'ginger-1': (30, 24),         # 30" rows, 24" in-row (18-24" range)
    'grape-1': (72, 60),          # 72" rows, 60" in-row (5 ft linear trellis)
    'fig-1': (78, 66),            # 78" rows, 66" in-row (5-6 ft wide canopy)
    'goji-berry-1': (36, 30),     # 36" rows, 30" in-row (2-3 ft range)

    # Shallots
    'shallot-from-sets': (12, 10),  # 12" rows, 10" in-row (8-10" range)
    'shallot-from-seed': (6, 3),    # 6" rows, 3" in-row (2-3" range)

    # Herbs
    'cilantro-1': (4, 2),         # 4" rows, 2" in-row
    'basil-1': (12, 8),           # 12" rows, 8" in-row (updated from reference)
    'parsley-1': (8, 4),          # 8" rows, 4" in-row
    'dill-1': (12, 6),            # 12" rows, 6" in-row
    'bee-balm-1': (30, 24),       # 30" rows, 24" in-row (spreads over time)
}

# Fallback Multiplier
MIGARDENER_DEFAULT_MULTIPLIER = 0.25  # 4:1 density increase
```

**Format**: `(row_spacing_inches, plant_spacing_inches)`
- `None` for row spacing = intensive (no row restrictions)
- Numbers = specific row and plant spacing requirements

**Total Crops Covered**: 48 crops (30 from reference document + 18 additional traditional crops)

---

## Calculation Logic

### Seed Count Calculation (Row-Based)

```
seedCount = uiSegmentLength (inches) × seedDensityPerInch

Example: 24" segment × 1 seed/inch = 24 seeds
```

### Seed Count Calculation (Broadcast)

```
seedCount = (gridCellArea (sq in) / 144) × seedDensityPerSqFt

Example: 9 sq in cell ÷ 144 × 50 seeds/sqft = 3.1 seeds
```

### Expected Final Plant Count

```
expectedFinalCount = seedCount × germinationRate × survivalRate

Example: 24 seeds × 90% × 30% = 6.5 plants (approximate)
```

### Intensive Crop Row Calculation

```
For crops with null rowSpacing (intensive):
rows = bedWidth (feet) × 12 ÷ 3

Example: 4' bed width = 48" ÷ 3 = 16 display rows
```

---

## Important Rules & Constraints

### Multi-Seed Spots
- **Beans, beets, cucumbers**: Typically plant 2-3 seeds per hole and thin to 1
- **Insurance planting**: Accounts for variable germination

### Success Rates
- **Total success** = seedCount × germinationRate × survivalRate
- Example: 100 seeds × 85% germ × 30% survival = ~26 final plants

### No Row Restriction Crops
- **Crops**: Spinach
- **Method**: Use intensive grid placement with 3" default grid size

### Row-Based Dense Crops
- **Crops**: Lettuce, Arugula
- **Method**: Enforce true 4" row spacing with 1 seed per inch; UI may render rows densely but rows are agronomically real

### Thinning Requirements
- **Thinning required**: Beans, beets, cucumbers, peanuts, shallots (from seed)
- **No thinning**: Potatoes, most transplants, single-seed crops

### Transplants vs. Direct Seed
- **Transplants required**: Broccoli, celery, pepper, eggplant
- **Direct seed**: Most others (check specific crop notes)

### Block-Based Minimum
- **Corn**: Requires 4×4 ft minimum block for wind pollination success

### Perennial Constraints
- **Asparagus**: No harvest Year 1-2; limited Year 3+
- **Grapes**: 3 years to first harvest; full production year 5
- **Fig**: 2 years to first fruit
- **Goji**: 2 years to significant fruit

### Critical Spacing Rules
- **Pepper**: NEVER less than 18" (Luke Marion rule)
- **Cucumber (ground)**: NEVER less than 36" (airflow for disease prevention)
- **Watermelon**: 60" (5 ft) non-negotiable - "garden hog"
- **Potatoes**: Crowding encouraged for yield (9" in-row, 20" rows)

---

## Quick Reference: Seeds Per 4×8 Bed

| Crop | Planting Style | Expected Seed Count |
|------|----------------|---------------------|
| Spinach | broadcast | ~1,000 seeds |
| Lettuce | row_based | ~1,000 seeds |
| Arugula | row_based | ~1,152 seeds |
| Bush Beans | plant_spacing | ~100 spots (300 seeds before thinning) |
| Beets | plant_spacing | ~200 spots (400 seeds before thinning) |
| Peppers | plant_spacing | ~21 transplants (18" spacing) |
| Watermelon | plant_spacing | 1-2 plants (5 ft spacing) |

---

**Document Version**: 1.0
**Data Source**: `frontend/src/data/plantDatabase.ts`, `backend/migardener_spacing.py`
**Total Crops Documented**: 50+
**Last Verified**: 2026-01-18
