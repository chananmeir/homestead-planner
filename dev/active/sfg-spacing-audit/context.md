# SFG Spacing Audit - Context

**Last Updated**: 2025-11-17

## Official SFG Rules Reference

These are the authoritative Square Foot Gardening rules provided by the user:

### 16 plants per square foot (3" spacing)
- Carrots
- Radishes

### 8 plants per square foot (3" spacing, vertical/trellis)
- Peas
- Pole beans

### 9 plants per square foot (4" spacing)
- Arugula
- Bush beans
- Lettuce (baby leaf)
- Scallions
- Spinach
- Turnips

### 4 plants per square foot (6" spacing)
- Beets
- Garlic
- Baby kale
- Kohlrabi
- Leaf lettuce
- Leeks
- Shallots
- Onions
- Parsnips
- Parsley
- Swiss chard
- Thyme

### 1 plant per square foot (12" spacing)
- Broccoli
- Brussels sprouts
- Cabbage
- Cauliflower
- Celery
- Cilantro
- Corn
- Cucumbers (on trellis)
- Eggplant
- Full-size kale
- Head lettuce

## Spacing Calculation Formula

For Square Foot Gardening:
- **Plants per square** = (12 / spacing)²
- **Spacing from plants per square** = 12 / √(plants per square)

Examples:
- 16 plants/sqft: spacing = 12/√16 = 12/4 = 3"
- 9 plants/sqft: spacing = 12/√9 = 12/3 = 4"
- 4 plants/sqft: spacing = 12/√4 = 12/2 = 6"
- 1 plant/sqft: spacing = 12/√1 = 12"

Special case for 8 plants/sqft:
- Spacing = 12/√8 = 12/2.83 = 4.24" (round to 4")

## Key Files

### Backend Files
- **plant_database.py** (lines 1-1337)
  - Main source of truth for plant data
  - Each plant has 'spacing' field in inches
  - Contains 60+ plants

- **garden_methods.py** (lines 140-173)
  - SFG_SPACING dictionary maps plant quantities to plant lists
  - Used for UI/calculations
  - Lines 143-173 define the SFG spacing rules

- **audit_sfg_spacing.py**
  - Existing audit script
  - Uses its own SFG_STANDARDS (lines 15-83)
  - NOTE: These standards differ from user's official rules!

- **fix_sfg_spacing.py**
  - Existing fix script
  - SPACING_FIXES dict (lines 9-35) with 24 plant fixes
  - Already applied previously, but based on audit script's standards

### Frontend Files (if any hardcoded values)
- Need to search for hardcoded SFG values

## Current Implementation Details

### How Spacing is Used

1. **plant_database.py**: 'spacing' field stores inches
2. **Calculations**: Backend calculates plants/sqft as (12/spacing)²
3. **UI Display**: Frontend shows spacing and plants per square
4. **PlantingEvent**: Database stores which plants are planted where

### Existing Audit Infrastructure

The codebase already has:
- ✓ Audit script (audit_sfg_spacing.py)
- ✓ Fix script (fix_sfg_spacing.py)
- ✓ Calculation functions
- ✗ BUT: Using different SFG standards than user provided

## Important Decisions

### Decision 1: Source of Truth
**Decision**: User's provided official SFG rules are the authoritative source, NOT the audit script's SFG_STANDARDS.

**Rationale**: The audit script uses mixed sources and ranges, while the user provided clear, official rules.

### Decision 2: Rounding for 8 plants/sqft
**Decision**: Use 4" spacing for 8 plants/sqft (peas, pole beans)

**Rationale**:
- Exact spacing = 4.24"
- 4" is practical for gardeners
- Results in ~9 plants/sqft which is close enough and standard

### Decision 3: Lettuce Varieties
**Decision**: Different lettuce types have different spacing:
- Baby leaf / Looseleaf: 4" (9/sqft) - matches "baby leaf" rule
- Romaine / Leaf lettuce: 6" (4/sqft) - matches "leaf lettuce" rule
- Head lettuce / Crisphead: 12" (1/sqft) - matches "head lettuce" rule
- Butterhead / Summer Crisp: 8" is between head and leaf, keep as-is

**Rationale**: Lettuce spacing depends on harvest size/type.

### Decision 4: Cilantro Use Case
**Decision**: Cilantro at 12" (1/sqft) for full plants, OR 4" (9/sqft) for micro-greens

**Rationale**: The official rule says 1/sqft. Current value is 6" which is wrong. Should be 12".

## Files Modified (Track Changes)

### plant_database.py - 8 plants updated
- Line 212: arugula-1 spacing: 6" → 4" (now 9/sqft) ✓
- Line 289: beet-1 spacing: 4" → 6" (now 4/sqft) ✓
- Line 468: bean-pole-1 spacing: 6" → 4" (now 9/sqft, ~8/sqft target) ✓
- Line 493: pea-1 spacing: 2" → 4" (now 9/sqft, ~8/sqft target) ✓
- Line 749: onion-1 spacing: 4" → 6" (now 4/sqft) ✓
- Line 774: garlic-1 spacing: 4" → 6" (now 4/sqft) ✓
- Line 799: leek-1 spacing: 4" → 6" (now 4/sqft) ✓
- Line 901: cilantro-1 spacing: 6" → 12" (now 1/sqft) ✓

### garden_methods.py - SFG_SPACING dictionary reorganized
- Lines 143-174: Complete reorganization to match official SFG rules
- Added new category: 8 plants/sqft for pea and bean-pole
- Moved cilantro from 16/sqft to 1/sqft
- Moved arugula from 4/sqft to 9/sqft
- Moved beet, garlic, leek, onion from 9/sqft to 4/sqft
- Removed basil, parsley from 1/sqft (not in official 1/sqft list)
- Removed dill, oregano, thyme from 16/sqft (thyme is 4/sqft)

### frontend - No changes needed
- GardenDesigner.tsx uses plant.spacing from API
- No hardcoded spacing values found
- Changes automatically propagate from backend

## Migration Notes

Database migration determined to be NOT NEEDED:
- PlantingEvent model stores plant_id reference, not spacing values
- Spacing is calculated dynamically from plant_database.py
- All calculations will use new values immediately
- No existing data needs to be updated
