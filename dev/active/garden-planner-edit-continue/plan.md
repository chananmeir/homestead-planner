# Garden Season Planner - Edit and Continue Saved Plans

**Status**: Active
**Started**: 2026-01-26
**Last Updated**: 2026-01-26

## Objective

Enable users to edit existing saved garden plans and continue adding more crops to them. Currently, plans can be saved but there's no way to load them back into the wizard for editing or to add more crops.

## Current State Analysis

### What Exists
1. **Backend API** (`garden_planner_bp.py`):
   - ✅ GET `/api/garden-plans/<id>` - Returns full plan with all items
   - ✅ PUT `/api/garden-plans/<id>` - Updates plan (replaces all items)
   - ✅ POST `/api/garden-plans` - Creates new plan
   - ✅ Data model includes all necessary fields for restoration

2. **Data Completeness**:
   - ✅ GardenPlan stores: strategy, succession_preference, year, season
   - ✅ GardenPlanItem stores: seed_inventory_id, quantities, succession settings, bed allocations
   - ✅ Full round-trip data is preserved in database

3. **Frontend** (`GardenPlanner.tsx`):
   - ✅ List view displays saved plans
   - ✅ Detail view shows plan summary (read-only)
   - ✅ Create wizard with 2 steps (seed selection + review/save)
   - ✅ Complex state: selectedSeeds, manualQuantities, perSeedSuccession, bedAssignments, etc.

### What's Missing
1. **Backend**: None - all necessary endpoints exist
2. **Frontend**:
   - ❌ No "Edit" button on plan list or detail views
   - ❌ No logic to restore wizard state from loaded plan
   - ❌ No way to reconstruct manualQuantities, perSeedSuccession, bedAssignments from saved data
   - ❌ No differentiation between "creating new plan" vs "editing existing plan"

## Implementation Plan

### Phase 1: Frontend - Load Plan into Wizard (Primary Work)

**Goal**: Add "Edit" functionality to load a saved plan back into the wizard state.

#### Step 1.1: Add Edit Button UI
- **File**: `frontend/src/components/GardenPlanner.tsx`
- Add "Edit" button to plan list view (alongside existing "View" button)
- Add "Edit Plan" button to detail view (alongside "Export to Calendar")
- Both buttons should trigger the same `handleEditPlan()` function

#### Step 1.2: Implement Plan Loading Logic
- **File**: `frontend/src/components/GardenPlanner.tsx`
- Create `handleEditPlan(plan: GardenPlan)` function that:
  1. Sets `view` to 'create' (wizard mode)
  2. Sets `step` to 1 (start at seed selection)
  3. Populates wizard state from plan data:
     - Extract `selectedSeeds` from plan.items (seed_inventory_id)
     - Reconstruct `manualQuantities` Map from plan.items (seed_id -> targetValue)
     - Reconstruct `perSeedSuccession` Map from plan.items (seed_id -> succession preference)
     - Reconstruct `bedAssignments` Map from plan.items (seed_id -> bedsAllocated)
     - Set `planName` to plan.name
     - Store plan.id for update mode
  4. Trigger recalculation to populate `calculatedPlan`

#### Step 1.3: Add Edit Mode Tracking
- Add state: `editingPlanId: number | null`
- When `editingPlanId` is set, wizard is in "edit mode"
- Show indicator in wizard: "Editing: [Plan Name]" banner
- Modify save logic to use PUT instead of POST when editing

#### Step 1.4: Update Save Logic
- **File**: `frontend/src/components/GardenPlanner.tsx`
- Modify `handleSavePlan()` to detect edit mode:
  ```typescript
  if (editingPlanId) {
    // PUT /api/garden-plans/<id> - Update existing plan
  } else {
    // POST /api/garden-plans - Create new plan
  }
  ```
- After save, clear `editingPlanId` and return to list view

#### Step 1.5: Add Cancel Edit Option
- Add "Cancel" button in wizard when in edit mode
- Confirmation dialog: "Discard changes to this plan?"
- Returns to list view and clears wizard state

### Phase 2: State Reconstruction Utilities (Supporting Code)

#### Step 2.1: Helper Functions
- **File**: `frontend/src/components/GardenPlanner.tsx`
- Create `reconstructWizardState(plan: GardenPlan, seedInventory: SeedInventoryItem[])`
  - Returns object with all wizard state maps
  - Handles missing seed inventory items gracefully
  - Validates data integrity (e.g., seeds still exist in inventory)

#### Step 2.2: Seed Inventory Matching
- Match plan.items to seedInventory by seed_inventory_id
- Handle case where seed no longer exists:
  - Show warning: "Some seeds in this plan are no longer in your inventory"
  - Option to proceed anyway (read-only) or remove missing seeds

### Phase 3: UX Enhancements (Polish)

#### Step 3.1: Visual Indicators
- Show "EDITING" badge in wizard header
- Display original plan name prominently
- Show "last saved" timestamp

#### Step 3.2: Duplicate Plan Feature
- Add "Duplicate" button to detail view
- Loads plan into wizard like "Edit" but creates new plan
- Pre-fills name as "[Original Name] (Copy)"

#### Step 3.3: Warning for Exported Plans
- If plan.items include status='exported', show warning:
  - "This plan has already been exported to calendar. Editing may create conflicts."
  - Offer to duplicate instead of edit

## Technical Considerations

### Data Mapping Challenges
1. **Seed Inventory Lookup**: Plan items store `seed_inventory_id`, but wizard uses seed objects
   - Solution: Load full seed inventory, build lookup map by ID
2. **Missing Seeds**: Seed may have been deleted since plan was created
   - Solution: Show warning, allow viewing but prevent saving until resolved
3. **Manual Quantities**: Not explicitly stored, must be inferred from targetValue
   - Solution: Assume any targetValue is a manual quantity if seed is checked
4. **Per-Seed Succession**: Stored in GardenPlanItem but not in a separate field
   - Solution: Need to determine if succession differs from plan-level default
   - Challenge: Original global default at plan creation time is lost
   - Pragmatic solution: Treat each item's succession settings as per-seed override

### Update Strategy
- Use PUT endpoint with full item replacement (existing behavior)
- Backend deletes old items and creates new ones (lines 154-179 in garden_planner_bp.py)
- Maintains consistency with create flow

### Edge Cases
1. User edits plan, then navigates away without saving
   - Add browser `beforeunload` warning if wizard state is dirty
2. Plan was created with old strategy defaults, now edited
   - Accept new strategy values from wizard, don't try to preserve original
3. Bed allocations reference deleted beds
   - Validate bed IDs still exist, show warning if not

## Files to Modify

### Frontend
- `frontend/src/components/GardenPlanner.tsx` - Primary changes
  - Add Edit button UI (2 locations)
  - Add handleEditPlan() function
  - Add reconstructWizardState() helper
  - Modify handleSavePlan() for edit mode
  - Add editingPlanId state
  - Add cancel/discard confirmation

### Backend
- No changes needed - existing PUT endpoint handles updates

## Success Criteria

1. ✅ User can click "Edit" on a saved plan
2. ✅ Wizard opens with all original selections restored
3. ✅ User can modify quantities, succession, bed assignments
4. ✅ User can add more seeds to the plan
5. ✅ User can remove seeds from the plan
6. ✅ Saving updates the original plan (not create new)
7. ✅ User can cancel edit and return to list
8. ✅ Edit mode is clearly indicated in UI

## Future Enhancements (Out of Scope)
- Version history for plans
- Compare current plan to original (diff view)
- Partial saves (autosave as draft)
- Collaborative editing
- Plan templates

---

**Last Updated**: 2026-01-26
