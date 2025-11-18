# Phase 2 CRUD Operations Tasks

**Last Updated**: 2025-11-11

## 2A. Seed Inventory CRUD

- [x] Create SeedInventory directory
- [x] Create AddSeedModal.tsx
  - [x] Form with all seed fields
  - [x] Plant dropdown (fetch from /api/plants)
  - [x] Validation (plantId, quantity > 0)
  - [x] POST to /api/seeds
  - [x] Success/error toasts
- [x] Create EditSeedModal.tsx
  - [x] Pre-populate form with seed data
  - [x] PUT to /api/seeds/<id>
  - [x] Success/error toasts
- [x] Update SeedInventory.tsx
  - [x] Wire "Add New Seed" button to modal
  - [x] Add Edit/Delete buttons to each card
  - [x] Add delete confirmation dialog
  - [x] Refresh data after mutations

## 2B. Livestock Management CRUD

- [x] Create Livestock directory
- [x] Create AnimalFormModal.tsx
  - [x] Dynamic form based on category prop
  - [x] Conditional field rendering
  - [x] Support add and edit modes
  - [x] POST or PUT based on mode
  - [x] Success/error toasts
- [x] Update Livestock.tsx
  - [x] Wire "Add New" button for each category
  - [x] Add Edit/Delete buttons to cards
  - [x] Manage modal state per category
  - [x] Delete confirmations
  - [x] Refresh category data after changes

## 2C. Harvest Tracker CRUD

- [x] Create HarvestTracker directory
- [x] Create LogHarvestModal.tsx
  - [x] Form with harvest fields
  - [x] Plant dropdown
  - [x] Date picker (default: today)
  - [x] Unit dropdown
  - [x] Quality dropdown
  - [x] POST to /api/harvests
  - [x] Success/error toasts
- [x] Update HarvestTracker.tsx
  - [x] Wire "Log New Harvest" button
  - [x] Add Delete icon to table rows
  - [x] Delete confirmation
  - [x] Refresh data and stats after changes

## Testing & Validation

- [x] TypeScript compilation succeeds (with minor eslint warnings)
- [x] All forms validate properly
- [x] Toasts appear on success/error
- [x] Delete confirmations work
- [x] Data refreshes after mutations
- [x] Loading states display correctly
- [x] Error handling works

## Documentation

- [x] Update tasks.md as work progresses
- [x] Mark completed items
- [x] Document any issues encountered

## Notes

- Build succeeded with minor eslint warnings about useEffect dependencies
- All three features fully implemented with CRUD operations
- Consistent UX patterns across all features
- No edit functionality for Harvest Tracker (backend limitation - no PUT endpoint)
