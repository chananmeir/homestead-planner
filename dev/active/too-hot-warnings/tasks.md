# Too Hot Weather Warnings - Task Checklist

## Phase 1: Discovery & Planning ✅
- [x] Check for existing dev docs
- [x] Analyze season_validator.py "too cold" logic
- [x] Identify heat_tolerance field in plant_database.py
- [x] Document affected plants (21 cool-weather crops)
- [x] Create dev docs (plan.md, context.md, tasks.md)

## Phase 2: Implementation ✅
- [x] Add "too hot" validation to season_validator.py
  - [x] Add check after existing soil temp validation (lines 248-261, 313-326)
  - [x] Get heat_tolerance from plant data
  - [x] Calculate max_acceptable_temp = soil_temp_min + 20
  - [x] Check FUTURE dates: Use avg_soil_temp from historical data (lines 248-261)
  - [x] Check CURRENT dates: Use current_soil_temp from live data (lines 313-326)
  - [x] Generate warning message with proper format
  - [x] Add warning to warnings list
  - [x] Ensure protection_offset does NOT affect "too hot" check

## Phase 3: Validation ✅
- [x] Run Python syntax check on season_validator.py - PASSED
- [x] Verify no import errors - CLEAN
- [x] Verify warning structure matches existing pattern - CONFIRMED
- [x] Check indentation and code style - CORRECT
- [x] Document any issues found - NO ISSUES

## Phase 4: Testing Recommendations 📋
Manual testing scenarios (not automated):
- [ ] Test: Lettuce planted July 15 (summer) → expect "too hot" warning
- [ ] Test: Lettuce planted April 15 (spring) → no warning
- [ ] Test: Tomato planted July 15 (summer) → no warning (warm-weather crop)
- [ ] Test: Radish at exactly 59°F → no warning
- [ ] Test: Radish at 60°F → "too hot" warning
- [ ] Test: With protection_offset=15 → warning should still appear

## Phase 5: Documentation 📝
- [ ] Update context.md with implementation details
- [ ] Update tasks.md with completion status
- [ ] Create final project manager report
- [ ] Document example warning messages
- [ ] Note any deviations from plan

---
**Last Updated**: 2026-01-05

## Notes
- Implementation location: backend/season_validator.py, lines ~298-300 (before return statement)
- Pattern: Mirror existing "too cold" logic exactly
- Key insight: Cool-weather crops (heat_tolerance='low') bolt/fail when soil temp exceeds soil_temp_min + 20°F
