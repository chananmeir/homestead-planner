# ESLint Cleanup - Task Checklist

**Last Updated**: 2025-11-11

## Tasks

- [ ] Fix HarvestTracker.tsx - Remove 'plants' from useMemo deps (line 251)
- [ ] Fix Livestock.tsx - Wrap functions in useCallback and add to useMemo deps (lines 417-420)
- [ ] Fix PropertyDesigner.tsx - Remove unused showSuccess, showError (line 42)
- [ ] Fix PropertyFormModal.tsx - Remove unused result variable (line 143)
- [ ] Fix SeedInventory.tsx - Wrap functions in useCallback and add to useMemo deps (line 330)
- [ ] Fix AddSeedModal.tsx - Wrap fetchPlants in useCallback and add to useEffect deps (line 52)
- [ ] Fix EditSeedModal.tsx - Wrap fetchPlants in useCallback and add to useEffect deps (line 67)
- [ ] Fix FormFileInput.tsx - Remove unused newFiles, hasError variables (lines 65-66)
- [ ] Run build verification - npm run build with no warnings
- [ ] Update documentation with completion status

## Progress Notes

Starting implementation...
