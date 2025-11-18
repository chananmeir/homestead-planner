# ESLint Cleanup - Context & Decisions

**Last Updated**: 2025-11-11

## Files Affected

1. `frontend/src/components/HarvestTracker.tsx`
2. `frontend/src/components/Livestock.tsx`
3. `frontend/src/components/PropertyDesigner.tsx`
4. `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx`
5. `frontend/src/components/SeedInventory.tsx`
6. `frontend/src/components/SeedInventory/AddSeedModal.tsx`
7. `frontend/src/components/SeedInventory/EditSeedModal.tsx`
8. `frontend/src/components/common/forms/FormFileInput.tsx`

## Key Decisions

### Unused Variables
- **PropertyDesigner.tsx**: `showSuccess` and `showError` from useToast are imported but never used. Safe to remove.
- **PropertyFormModal.tsx**: `result` variable captures response but is never used. Safe to remove.
- **FormFileInput.tsx**: `newFiles` and `hasError` are declared but never used. Safe to remove.

### Hook Dependencies

#### HarvestTracker.tsx
- **Issue**: `plants` in dependency array of useMemo is unnecessary because `getPlantName` already has `plants` as a dependency
- **Fix**: Remove `plants` from the dependency array, keep `getPlantName`

#### Livestock.tsx
- **Issue**: Functions `getFilteredAndSortedAnimals` and `getFilteredAndSortedBeehives` are used in useMemo but not in deps
- **Fix**: These functions depend on `searchQuery`, `activeFilters`, `sortBy`, `sortDirection` which are already in the deps. We need to add the functions themselves OR wrap them in useCallback. Best practice: wrap in useCallback.

#### SeedInventory.tsx
- **Issue**: Functions `getPlantInfo` and `getPlantName` used in useMemo but not in deps
- **Fix**: These functions only depend on `plants` which is already in deps. We can either add them to deps or wrap in useCallback. Best practice: wrap in useCallback.

#### AddSeedModal.tsx & EditSeedModal.tsx
- **Issue**: `fetchPlants` function is called in useEffect but not in dependency array
- **Fix**: Wrap `fetchPlants` in useCallback to stabilize its reference, then add to useEffect deps

## React Hooks Best Practices Applied

1. **useCallback for stable references**: Functions that are used as dependencies should be wrapped in useCallback
2. **Complete dependency arrays**: All variables/functions used inside hooks must be in the dependency array
3. **Remove unused code**: Clean up imports and variables that serve no purpose

## Testing Strategy

1. Build verification: `npm run build` must complete with no warnings
2. Manual testing: Verify all affected components still function correctly
3. No regression: Ensure filtering, sorting, and search still work as expected
