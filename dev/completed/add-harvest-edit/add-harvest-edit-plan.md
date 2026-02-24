# Add Harvest Edit Functionality - Implementation Plan

**Task ID**: add-harvest-edit
**Created**: 2025-11-11
**Status**: Completed
**Completed**: 2025-11-11
**Last Updated**: 2025-11-11

## Objective

Add PUT endpoint to Flask backend and implement EditHarvestModal component in the frontend to enable users to edit existing harvest records.

## Current State

- Harvests API has POST (create) and DELETE endpoints
- Missing: PUT endpoint for updating existing harvests
- Frontend HarvestTracker.tsx shows Delete button only
- LogHarvestModal exists for creating new harvests

## Implementation Steps

### Phase 1: Backend Implementation

1. **Add PUT endpoint to `backend/app.py`**
   - Location: Around line 598 (after DELETE endpoint)
   - Pattern: Follow existing harvest routes structure
   - Method: `@app.route('/api/harvests/<int:record_id>', methods=['PUT'])`
   - Features:
     - Query harvest by ID
     - Return 404 if not found
     - Update all editable fields from request JSON
     - Use parse_iso_date() for date handling
     - Commit and return success message

### Phase 2: Frontend Implementation

2. **Create EditHarvestModal component**
   - File: `frontend/src/components/HarvestTracker/EditHarvestModal.tsx`
   - Based on: LogHarvestModal.tsx structure
   - Key differences:
     - Add `harvestData` prop for pre-population
     - Pre-fill form fields with existing data
     - Use PUT instead of POST
     - Include harvest ID in API URL
     - Change modal title to "Edit Harvest"

3. **Update HarvestTracker.tsx**
   - Import EditHarvestModal
   - Add state for edit modal and selected harvest
   - Add Edit button/icon to table row (next to Delete)
   - Wire up handleEdit function
   - Render EditHarvestModal with selected harvest

### Phase 3: Testing

4. **Validate implementation**
   - TypeScript compilation check
   - Python syntax check
   - Manual testing of edit functionality

## Success Criteria

- [x] PUT endpoint added to backend (lines 598-631 in app.py)
- [x] EditHarvestModal component created
- [x] Edit button added to HarvestTracker table
- [x] TypeScript compiles without errors
- [x] Python syntax is valid
- [x] All files properly integrated

## Implementation Summary

### Backend Changes
- Modified `/api/harvests/<int:record_id>` endpoint to support both PUT and DELETE methods
- Consolidated delete_harvest function into harvest_record function
- Added field-by-field update logic with conditional checks
- Uses datetime.fromisoformat for date parsing

### Frontend Changes
- Created EditHarvestModal.tsx with pre-population logic
- Added Edit button with pencil icon to HarvestTracker table
- Implemented handleEditClick function
- Added state management for edit modal and selected harvest
- Used useEffect to update form when harvestData changes

### Validation Results
- Backend: Python syntax check passed
- Frontend: TypeScript compilation passed with no errors

## Files Modified

### Backend
- `backend/app.py` - Add PUT endpoint

### Frontend
- `frontend/src/components/HarvestTracker/EditHarvestModal.tsx` - NEW
- `frontend/src/components/HarvestTracker.tsx` - Add Edit functionality

### Documentation
- `dev/active/add-harvest-edit/` - Dev docs

## Technical Notes

- Use `parse_iso_date()` for date handling (handles JS 'Z' suffix)
- Follow existing Flask patterns for PUT endpoints
- Reuse LogHarvestModal structure for consistency
- Maintain table layout consistency
