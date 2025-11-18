# SFG Spacing Audit - Tasks

**Last Updated**: 2025-11-17

## Discrepancies Found: 9 plants need fixing

| Status | Plant ID | Current | Expected | Fix Required |
|--------|----------|---------|----------|--------------|
| [ ] | arugula-1 | 6" (4/sqft) | 4" (9/sqft) | Change spacing 6→4 |
| [ ] | beet-1 | 4" (9/sqft) | 6" (4/sqft) | Change spacing 4→6 |
| [ ] | bean-pole-1 | 6" (4/sqft) | 4" (8/sqft) | Change spacing 6→4 |
| [ ] | pea-1 | 2" (36/sqft) | 4" (8/sqft) | Change spacing 2→4 |
| [ ] | onion-1 | 4" (9/sqft) | 6" (4/sqft) | Change spacing 4→6 |
| [ ] | garlic-1 | 4" (9/sqft) | 6" (4/sqft) | Change spacing 4→6 |
| [ ] | leek-1 | 4" (9/sqft) | 6" (4/sqft) | Change spacing 4→6 |
| [ ] | cilantro-1 | 6" (4/sqft) | 12" (1/sqft) | Change spacing 6→12 |
| [ ] | mint-1 | 8" (2/sqft) | ?? | VERIFY: Not in official SFG rules |

## Tasks

### Phase 1: Discovery ✓ COMPLETE
- [x] Check for existing dev docs
- [x] Read existing audit and fix scripts
- [x] Read plant_database.py
- [x] Read garden_methods.py
- [x] Compare current values against official SFG rules
- [x] Create comprehensive discrepancy list
- [x] Create dev docs (plan.md, context.md, tasks.md)

### Phase 2: Fix Backend Files ✓ COMPLETE

#### Task 1: Update plant_database.py ✓ COMPLETE
- [x] Fix arugula-1 spacing (line 212): 6 → 4 ✓
- [x] Fix beet-1 spacing (line 289): 4 → 6 ✓
- [x] Fix bean-pole-1 spacing (line 468): 6 → 4 ✓
- [x] Fix pea-1 spacing (line 493): 2 → 4 ✓
- [x] Fix onion-1 spacing (line 749): 4 → 6 ✓
- [x] Fix garlic-1 spacing (line 774): 4 → 6 ✓
- [x] Fix leek-1 spacing (line 799): 4 → 6 ✓
- [x] Fix cilantro-1 spacing (line 901): 6 → 12 ✓
- [x] Verify mint-1 (line 1051): Not in official rules, left at 8"

#### Task 2: Update garden_methods.py SFG_SPACING ✓ COMPLETE
- [x] Read current SFG_SPACING dictionary (lines 143-173)
- [x] Reorganized plant assignments to match official rules
- [x] Added new category for 8/sqft (pea, bean-pole)
- [x] Moved plants to correct quantity categories
- [x] Ensured consistency with plant_database.py

#### Task 3: Verify frontend has no hardcoded spacing ✓ COMPLETE
- [x] Searched frontend for hardcoded SFG values
- [x] Confirmed frontend uses plant.spacing from backend API
- [x] No hardcoded values found - no fixes needed

### Phase 3: Database Migration ✓ NOT NEEDED

- [x] Determined database migration is NOT needed
- Rationale: PlantingEvent uses plant_id reference, not stored spacing values
- The spacing is calculated dynamically from plant_database.py

### Phase 4: Validation ✓ COMPLETE

- [x] Verified all 8 discrepancies are fixed
- [x] Ran comprehensive validation against official SFG rules
- [x] All plants now match expected plants/sqft values
- [x] Python syntax check: PASSED
- [x] Frontend uses API values: CONFIRMED

### Phase 5: Documentation ✓ COMPLETE

- [x] Updated context.md with all changes made
- [x] Updated tasks.md completion status
- [x] Add validation results to plan.md
- [x] Create final summary report

## Notes

### Note on Onions
User's official rules say "Onions" = 4/sqft (6" spacing). Current value is 4" (9/sqft).
This is a discrepancy that needs fixing.

### Note on Mint
Mint is not in the user's official SFG rules. The current value of 8" (2/sqft) seems wrong.
Need to research correct SFG spacing for mint or leave as-is with a note.

### Note on Scallions and Turnips
User's rules mention:
- Scallions: 9/sqft (4" spacing)
- Turnips: 9/sqft (4" spacing)

Need to check if these plants exist in the database and verify their spacing.
