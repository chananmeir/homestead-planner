# Garden Season Planner Edit/Continue - Tasks

**Last Updated**: 2026-01-26

## Phase 1: Core Edit Functionality

### Task 1.1: Add Edit Button UI ⬜
**Status**: Pending
**Files**: `frontend/src/components/GardenPlanner.tsx`
- [ ] Add "Edit" button to plan list view (line ~1010, next to "View" button)
- [ ] Add "Edit Plan" button to detail view (line ~1876, next to "Export to Calendar")
- [ ] Style consistently with existing buttons
- [ ] Both buttons call `handleEditPlan(plan)`

### Task 1.2: Add Edit Mode State ⬜
**Status**: Pending
**Files**: `frontend/src/components/GardenPlanner.tsx`
- [ ] Add state: `const [editingPlanId, setEditingPlanId] = useState<number | null>(null)`
- [ ] Add state: `const [editingPlanName, setEditingPlanName] = useState<string>('')` (for banner)

### Task 1.3: Implement reconstructWizardState() Helper ⬜
**Status**: Pending
**Files**: `frontend/src/components/GardenPlanner.tsx`
- [ ] Create function signature:
  ```typescript
  const reconstructWizardState = (
    plan: GardenPlan,
    seedInventory: SeedInventoryItem[]
  ): {
    selectedSeeds: Set<number>;
    manualQuantities: Map<number, number>;
    perSeedSuccession: Map<number, SuccessionPreference>;
    bedAssignments: Map<number, number[]>;
    trellisAssignments: Map<number, number[]>;
    missingSeeds: string[];
  }
  ```
- [ ] Build selectedSeeds Set from plan.items[].seedInventoryId (filter nulls)
- [ ] Build manualQuantities Map: seed_id → item.targetValue
- [ ] Build perSeedSuccession Map: seed_id → inferred succession preference
  - Logic: Compare item.successionCount to plan.successionPreference
  - Map counts: none=1, light=2, moderate=4, heavy=8
  - If item.successionCount differs, mark as override
- [ ] Build bedAssignments Map: seed_id → item.bedsAllocated (parse JSON if string)
- [ ] Build trellisAssignments Map: similar to beds (if trellis data exists)
- [ ] Identify missing seeds: Items where seedInventoryId not found in inventory
- [ ] Return reconstructed state + warnings

### Task 1.4: Implement handleEditPlan() ⬜
**Status**: Pending
**Files**: `frontend/src/components/GardenPlanner.tsx`
- [ ] Create function:
  ```typescript
  const handleEditPlan = async (plan: GardenPlan) => {
    setLoading(true);
    try {
      // 1. Fetch full plan details (includes items)
      const response = await fetch(`${API_BASE_URL}/api/garden-plans/${plan.id}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load plan');
      const fullPlan = await response.json();

      // 2. Reconstruct wizard state
      const reconstructed = reconstructWizardState(fullPlan, seedInventory);

      // 3. Show warning if seeds missing
      if (reconstructed.missingSeeds.length > 0) {
        setError(`Warning: ${reconstructed.missingSeeds.length} seed(s) no longer in inventory`);
      }

      // 4. Populate wizard state
      setSelectedSeeds(reconstructed.selectedSeeds);
      setManualQuantities(reconstructed.manualQuantities);
      setPerSeedSuccession(reconstructed.perSeedSuccession);
      setBedAssignments(reconstructed.bedAssignments);
      setTrellisAssignments(reconstructed.trellisAssignments);
      setPlanName(fullPlan.name);

      // 5. Set edit mode
      setEditingPlanId(fullPlan.id);
      setEditingPlanName(fullPlan.name);

      // 6. Switch to wizard
      setView('create');
      setStep(1);

      // 7. Trigger recalculation
      await handleCalculatePlan(); // Or call calculate logic directly
    } catch (err) {
      setError('Failed to load plan for editing');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  ```

### Task 1.5: Modify handleSavePlan() for Edit Mode ⬜
**Status**: Pending
**Files**: `frontend/src/components/GardenPlanner.tsx`
- [ ] Find handleSavePlan function (line ~721)
- [ ] Add conditional logic at start:
  ```typescript
  const isEditMode = editingPlanId !== null;
  const url = isEditMode
    ? `${API_BASE_URL}/api/garden-plans/${editingPlanId}`
    : `${API_BASE_URL}/api/garden-plans`;
  const method = isEditMode ? 'PUT' : 'POST';
  ```
- [ ] Update fetch call to use dynamic url and method
- [ ] After successful save:
  ```typescript
  if (isEditMode) {
    // Update plan in plans array
    setPlans(prev => prev.map(p => p.id === editingPlanId ? response.data : p));
  } else {
    // Add new plan to plans array
    setPlans(prev => [response.data, ...prev]);
  }
  ```
- [ ] Clear edit mode: `setEditingPlanId(null); setEditingPlanName('');`

### Task 1.6: Add Edit Mode Visual Indicator ⬜
**Status**: Pending
**Files**: `frontend/src/components/GardenPlanner.tsx`
- [ ] In wizard view (after step indicator, before step content)
- [ ] Add conditional banner:
  ```tsx
  {editingPlanId && (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-yellow-900">📝 Editing Plan:</span>
          <span className="ml-2 text-yellow-800">{editingPlanName}</span>
        </div>
        <button
          onClick={handleCancelEdit}
          className="text-sm text-yellow-700 hover:text-yellow-900 underline"
        >
          Cancel Edit
        </button>
      </div>
    </div>
  )}
  ```

### Task 1.7: Implement Cancel Edit ⬜
**Status**: Pending
**Files**: `frontend/src/components/GardenPlanner.tsx`
- [ ] Create handleCancelEdit function:
  ```typescript
  const handleCancelEdit = () => {
    if (confirm('Discard all changes to this plan?')) {
      resetWizard();
      setEditingPlanId(null);
      setEditingPlanName('');
      setView('list');
    }
  }
  ```

## Phase 2: UX Enhancements

### Task 2.1: Add Duplicate Plan Feature ⬜
**Status**: Pending
**Files**: `frontend/src/components/GardenPlanner.tsx`
- [ ] Add "Duplicate" button to detail view
- [ ] Create handleDuplicatePlan():
  - Same as handleEditPlan but DON'T set editingPlanId
  - Pre-fill planName as `${plan.name} (Copy)`
  - Will create new plan on save (POST)

### Task 2.2: Warn on Editing Exported Plans ⬜
**Status**: Pending
**Files**: `frontend/src/components/GardenPlanner.tsx`
- [ ] In handleEditPlan, check if plan has any exported items:
  ```typescript
  const hasExportedItems = fullPlan.items.some(item => item.status === 'exported');
  if (hasExportedItems) {
    setError('⚠️ This plan was exported to calendar. Editing may create conflicts.');
  }
  ```
- [ ] Add info banner in wizard when editing exported plan

### Task 2.3: Missing Seeds Warning UI ⬜
**Status**: Pending
**Files**: `frontend/src/components/GardenPlanner.tsx`
- [ ] When reconstructed.missingSeeds.length > 0:
- [ ] Show prominent warning in Step 1:
  ```tsx
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
    <h4 className="font-semibold text-red-900 mb-2">⚠️ Missing Seeds</h4>
    <p className="text-sm text-red-700 mb-2">
      The following seeds from this plan are no longer in your inventory:
    </p>
    <ul className="list-disc list-inside text-sm text-red-700">
      {missingSeeds.map(seed => <li key={seed}>{seed}</li>)}
    </ul>
    <p className="text-sm text-red-700 mt-2">
      You can continue editing but must remove these items or re-add the seeds before saving.
    </p>
  </div>
  ```

### Task 2.4: Improve Save Button Text ⬜
**Status**: Pending
**Files**: `frontend/src/components/GardenPlanner.tsx`
- [ ] Change save button text based on mode:
  ```tsx
  {editingPlanId ? 'Update Plan' : 'Save Plan'}
  ```

## Phase 3: Testing & Validation

### Task 3.1: Manual Testing - Basic Edit Flow ⬜
**Status**: Pending
- [ ] Create a test plan with 3 seeds
- [ ] Save the plan
- [ ] Click "Edit" from list view
- [ ] Verify all 3 seeds are checked
- [ ] Verify quantities match
- [ ] Modify quantity of one seed
- [ ] Save
- [ ] Verify plan was updated (not new plan created)
- [ ] Verify quantity changed in detail view

### Task 3.2: Manual Testing - Add Crops ⬜
**Status**: Pending
- [ ] Edit existing plan
- [ ] Add 2 new seeds
- [ ] Save
- [ ] Verify plan now has 5 crops total

### Task 3.3: Manual Testing - Remove Crops ⬜
**Status**: Pending
- [ ] Edit existing plan
- [ ] Uncheck 2 seeds
- [ ] Save
- [ ] Verify plan now has 3 crops

### Task 3.4: Manual Testing - Cancel Edit ⬜
**Status**: Pending
- [ ] Edit existing plan
- [ ] Make several changes
- [ ] Click "Cancel Edit"
- [ ] Confirm discard
- [ ] Verify returned to list view
- [ ] Verify original plan unchanged

### Task 3.5: Manual Testing - Duplicate Plan ⬜
**Status**: Pending
- [ ] View plan detail
- [ ] Click "Duplicate"
- [ ] Verify wizard opens with data pre-filled
- [ ] Verify plan name is "[Original] (Copy)"
- [ ] Modify something
- [ ] Save
- [ ] Verify TWO plans exist (original + new)

### Task 3.6: Edge Case Testing - Missing Seeds ⬜
**Status**: Pending
- [ ] Create plan with seed A, B, C
- [ ] Delete seed B from inventory
- [ ] Try to edit plan
- [ ] Verify warning shown about missing seed B
- [ ] Verify seed A and C are still checkable
- [ ] Try to save without fixing → should show validation error

### Task 3.7: Build Validation ⬜
**Status**: Pending
- [ ] Run TypeScript compiler: `cd frontend && npm run build`
- [ ] Verify no TS errors
- [ ] Verify no console warnings in browser

## Phase 4: Documentation & Cleanup

### Task 4.1: Update Context Docs ⬜
**Status**: Pending
- [ ] Add implementation notes to context.md
- [ ] Document any decisions made during implementation
- [ ] Note any deviations from original plan

### Task 4.2: Update Plan with Completion Status ⬜
**Status**: Pending
- [ ] Mark plan.md as completed
- [ ] Add completion date
- [ ] List any follow-up work identified

### Task 4.3: Code Review Checklist ⬜
**Status**: Pending
- [ ] Verify all fetch calls use `${API_BASE_URL}` (not hardcoded URLs)
- [ ] Verify TypeScript types are correct
- [ ] Verify error handling exists for all API calls
- [ ] Verify loading states are shown during async operations
- [ ] Verify no console.log statements left in code
- [ ] Verify consistent code style with existing component

---

## Summary
- **Total Tasks**: 22
- **Completed**: 0
- **In Progress**: 0
- **Pending**: 22

**Last Updated**: 2026-01-26
