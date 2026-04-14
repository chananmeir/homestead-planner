# Garden Season Planner Edit/Continue - Context

**Last Updated**: 2026-01-26

## Key Files

### Backend
- `backend/blueprints/garden_planner_bp.py` - API endpoints (lines 109-190: GET/PUT/DELETE plan)
  - GET `/api/garden-plans/<id>` returns full plan with items
  - PUT `/api/garden-plans/<id>` updates plan (replaces all items)
  - Data format matches frontend requirements
- `backend/models.py` - Data models
  - GardenPlan (lines 1092-1131): Plan metadata
  - GardenPlanItem (lines 1133-1210): Individual crop items
  - Both have complete to_dict() methods
- `backend/services/garden_planner_service.py` - Business logic
  - calculate_plant_quantities() - Used by wizard
  - No changes needed for edit feature

### Frontend
- `frontend/src/components/GardenPlanner.tsx` - Main component (~1900 lines)
  - Lines 20-65: State declarations (all wizard state here)
  - Lines 721-770: handleSavePlan() - Creates new plan (POST)
  - Lines 990-1017: List view - Shows saved plans
  - Lines 1867-1899: Detail view - Read-only plan display
  - Lines 1019-1866: Create wizard (2 steps)
- `frontend/src/types.ts` - TypeScript types
  - GardenPlan, GardenPlanItem interfaces
  - Match backend model exactly

## Important State Variables

### Wizard State (must be reconstructed for edit)
1. `selectedSeeds: Set<number>` - Seed inventory IDs that are checked
2. `manualQuantities: Map<number, number>` - seed_id -> quantity override
3. `perSeedSuccession: Map<number, SuccessionPreference>` - seed_id -> succession override
4. `bedAssignments: Map<number, number[]>` - seed_id -> array of bed IDs
5. `trellisAssignments: Map<number, number[]>` - seed_id -> array of trellis IDs
6. `planName: string` - Plan name for save
7. `calculatedPlan: CalculatePlanResponse | null` - Result from backend calculation

### New State Needed for Edit
- `editingPlanId: number | null` - Set when editing existing plan
- Flag distinguishes between create (POST) and update (PUT) modes

## Data Flow

### Current Create Flow
1. User checks seeds in Step 1 → `selectedSeeds` updated
2. User enters manual quantities → `manualQuantities` updated
3. User sets per-seed succession → `perSeedSuccession` updated
4. User clicks "Calculate Plan" → Calls POST `/api/garden-plans/calculate`
   - Sends: selectedSeeds, manualQuantities, perSeedSuccession
   - Returns: Calculated plan with quantities, dates, space
5. Step 2: User assigns beds → `bedAssignments` updated
6. User enters plan name → `planName` updated
7. User clicks "Save" → Calls POST `/api/garden-plans`
   - Sends: Plan metadata + items with bed assignments
   - Backend persists to database

### Proposed Edit Flow
1. User clicks "Edit" on saved plan
2. Load plan from backend: GET `/api/garden-plans/<id>`
3. **Reconstruct wizard state from plan data**:
   - `selectedSeeds` ← Extract seed_inventory_ids from plan.items
   - `manualQuantities` ← Map seed_id to item.targetValue
   - `perSeedSuccession` ← Infer from item succession settings
   - `bedAssignments` ← Map seed_id to item.bedsAllocated
   - `planName` ← plan.name
   - `editingPlanId` ← plan.id
4. Trigger calculation to populate `calculatedPlan`
5. User modifies quantities/succession/beds (normal wizard flow)
6. User clicks "Save" → Calls PUT `/api/garden-plans/<id>`
   - Same payload format as POST
   - Backend replaces all items

## Key Decisions

### Decision 1: Edit vs. Duplicate
**Decision**: Implement both
- "Edit" button modifies original plan (PUT)
- "Duplicate" button creates new plan (POST) with pre-filled data
- Rationale: Users may want to iterate on a plan or create variations

### Decision 2: Handle Missing Seed Inventory Items
**Decision**: Show warning but allow viewing
- If plan references seed_inventory_id that no longer exists:
  - Display warning: "Some seeds in this plan are no longer in inventory"
  - Show plant_id and variety from plan item (fallback data)
  - Disable save until user removes missing items or re-adds seeds
- Rationale: Plans shouldn't become unusable if seeds are consumed/deleted

### Decision 3: Reconstruct Per-Seed Succession Settings
**Challenge**: Plan stores global succession_preference and per-item succession_count, but not explicit per-seed overrides
**Decision**: Treat all items as if they had per-seed overrides
- Compare item.succession_count to what global default would produce
- If different, assume it was a manual override
- Pragmatic compromise since original context is lost
- Alternative considered: Ignore per-seed overrides, just use global (rejected - loses user's custom settings)

### Decision 4: Wizard Start Point
**Decision**: Always start edit mode at Step 1 (seed selection)
- Gives user full control to add/remove/modify anything
- Consistent with create flow
- Alternative considered: Jump to Step 2 (review) - rejected because user may want to add more seeds

### Decision 5: Exported Plans Warning
**Decision**: Warn but allow editing
- Show banner: "This plan was already exported to calendar. Editing may create duplicate events."
- User can proceed anyway
- Don't prevent editing (user knows their use case best)
- Future enhancement: Offer to sync edits back to calendar

## Known Limitations

1. **Succession Inference**: Can't perfectly reconstruct per-seed succession overrides vs. what was global default at creation time
   - Acceptable: User can adjust if needed during edit

2. **Missing Seeds**: If seed inventory item was deleted, can't fully edit plan
   - Acceptable: Show warning, user must resolve

3. **No Version History**: Editing overwrites original
   - Future enhancement: Add revision history

4. **No Diff View**: Can't see what changed from original
   - Future enhancement: Show before/after comparison

## Testing Scenarios

1. **Basic Edit**: Create plan → Save → Edit → Modify quantity → Save → Verify changes
2. **Add Crops**: Create plan with 3 crops → Edit → Add 2 more → Save → Verify 5 crops
3. **Remove Crops**: Create plan with 5 crops → Edit → Uncheck 2 → Save → Verify 3 crops
4. **Missing Seed**: Create plan → Delete seed from inventory → Edit plan → Verify warning shown
5. **Cancel Edit**: Create plan → Edit → Make changes → Cancel → Verify original unchanged
6. **Edit Exported Plan**: Create plan → Export to calendar → Edit → Verify warning shown
7. **Duplicate Plan**: Create plan → Duplicate → Modify → Save → Verify 2 separate plans exist

## Integration Points

### With Seed Inventory
- Plans reference `seed_inventory.id` (not just plant_id)
- If seed is deleted, plan becomes partially un-editable
- Consider: Add "soft delete" to seed inventory (future enhancement)

### With Garden Beds
- Plans store bed allocations by bed.id
- If bed is deleted, allocation becomes invalid
- Current behavior: Backend will likely reject or ignore invalid bed IDs
- Enhancement: Validate bed IDs on load, show warning

### With Planting Calendar
- Plans can be exported to calendar (creates PlantingEvents)
- Editing exported plan doesn't update calendar automatically
- User must re-export or manually update calendar
- Future: Add "Update Calendar" option when editing exported plan

## Performance Considerations

- Loading plan: Single GET request (~100-500ms)
- Reconstructing wizard state: In-memory operations (~10ms)
- No pagination needed (plans have <50 items typically)
- No significant performance concerns

---

**Last Updated**: 2026-01-26
