# ESLint Warnings Cleanup - Implementation Plan

**Status**: In Progress
**Started**: 2025-11-11
**Last Updated**: 2025-11-11

## Objective

Fix all ESLint warnings and errors across the React frontend, including React Hook dependency issues and unused variable warnings.

## Error Categorization

### Category 1: Simple Unused Variable Removals (3 files)
- **PropertyDesigner.tsx** (Line 42) - Remove unused: showSuccess, showError
- **PropertyFormModal.tsx** (Line 143) - Remove unused: result
- **FormFileInput.tsx** (Lines 65-66) - Remove unused: newFiles, hasError

### Category 2: Hook Dependency Additions - Simple (1 file)
- **HarvestTracker.tsx** (Line 251) - Remove 'plants' from useMemo deps (not needed, getPlantName already depends on plants)

### Category 3: Hook Dependency Additions - Requires useCallback (5 files)
- **Livestock.tsx** (Lines 417-420) - Add getFilteredAndSortedAnimals, getFilteredAndSortedBeehives to useMemo deps
- **SeedInventory.tsx** (Line 330) - Add getPlantInfo, getPlantName to useMemo deps
- **AddSeedModal.tsx** (Line 52) - Add fetchPlants to useEffect deps
- **EditSeedModal.tsx** (Line 67) - Add fetchPlants to useEffect deps

## Implementation Strategy

### Phase 1: Simple Removals
Execute in parallel - remove unused variables that serve no purpose.

### Phase 2: Hook Dependency Fixes
For files requiring useCallback:
1. Wrap the function in useCallback with proper dependencies
2. Add the callback to the hook's dependency array

### Phase 3: Validation
- Run `npm run build` to verify all ESLint warnings are resolved
- Ensure no functionality is broken

## Expected Outcome

- Zero ESLint warnings/errors
- Clean build output
- No functionality changes or regressions
