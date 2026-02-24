# Duplicate Detection Bug - Tasks

**Last Updated**: 2025-11-13

## Investigation Tasks

- [ ] Query database to find all lettuce varieties
- [ ] Check is_global flag on existing varieties
- [ ] Count total vs global vs personal varieties
- [ ] List varieties from CSV that match database
- [ ] Compare duplicate detection logic vs search logic
- [ ] Identify exact root cause

## Fix Tasks

- [ ] Implement fix for root cause
- [ ] Add better error messages showing which varieties are duplicates
- [ ] Test with user's CSV file
- [ ] Verify search shows all varieties
- [ ] Verify import works correctly

## Testing Tasks

- [ ] Import CSV with duplicates (should show which ones)
- [ ] Import CSV without duplicates (should succeed)
- [ ] Search for varieties before import (should show existing)
- [ ] Search for varieties after import (should show new ones)

## Documentation Tasks

- [ ] Document root cause in context.md
- [ ] Add screenshots to context.md
- [ ] Update plan.md with findings
- [ ] Create comprehensive final report
