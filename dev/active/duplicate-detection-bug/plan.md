# Duplicate Detection Bug Fix - Plan

**Created**: 2025-11-13
**Status**: In Progress
**Priority**: High

## Problem Statement

User is trying to upload `lettuce_varieties_max.csv` (54 varieties) through the Seeds page Import CSV feature. The import fails with a "Check for duplicates" error, but when the user searches for the allegedly duplicate varieties, they don't appear in the search results.

## Hypothesis

The duplicate detection logic is finding varieties that exist in the database, but these varieties are either:
1. Hidden from search results due to filtering logic
2. Not displaying properly due to UI bug
3. Case sensitivity mismatch between search and duplicate detection
4. Global vs. personal variety filtering issue

## Investigation Plan

### Phase 1: Database State Analysis
1. Query the database directly to see what lettuce varieties exist
2. Check the `is_global` flag on existing varieties
3. Count total seeds, global seeds, personal seeds
4. List all varieties that would match CSV entries

### Phase 2: Code Analysis
1. Review duplicate detection logic in `csv_import_service.py`
2. Review search/filter logic in `SeedInventory.tsx`
3. Identify any discrepancies in comparison logic

### Phase 3: Root Cause Identification
1. Determine why duplicate detection sees varieties that search doesn't
2. Check if it's a case sensitivity issue
3. Check if it's a filtering issue
4. Check if it's a display issue

### Phase 4: Fix Implementation
1. If duplicate detection is wrong: Fix the comparison logic
2. If search is wrong: Fix the search/filter logic
3. If display is wrong: Fix the UI rendering
4. If case sensitivity: Normalize both sides

### Phase 5: Testing
1. Test import with the original CSV file
2. Verify search shows expected results
3. Verify import succeeds or shows accurate duplicate count

## Expected Outcomes

- Import either succeeds (if no real duplicates exist)
- OR shows accurate duplicate count with ability to see which ones are duplicates
- Search results match database state
- User can successfully import their lettuce varieties

## Files to Modify

**Backend**:
- `backend/services/csv_import_service.py` - Duplicate detection logic
- `backend/app.py` - Import endpoint

**Frontend**:
- `frontend/src/components/SeedInventory.tsx` - Search/filter logic
- `frontend/src/components/SeedInventory/CSVImportModal.tsx` - Import UI

**Database**:
- May need to check `backend/instance/homestead.db` directly
