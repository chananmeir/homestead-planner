# Testing Plan - Icon Toggle System Removal

**Date**: 2026-01-27
**Status**: Ready for Testing

## Overview

The icon toggle system has been removed. The application now uses simple PNG-first behavior with automatic emoji fallback. This document provides a comprehensive testing plan to verify the changes work correctly.

## Pre-Testing Setup

### Step 1: Clear localStorage

Before testing, clear any old icon preference:

**Option A: Use the cleanup page**
1. Start the frontend server: `cd frontend && npm start`
2. Open in browser: `http://localhost:3000`
3. In a new tab, open: `file:///C:/homesteader/homestead-planner/clear-icon-preference.html`
   - OR copy the file to `frontend/public/` and access via `http://localhost:3000/clear-icon-preference.html`
4. Click "Clear Icon Preference" button
5. Return to main app and refresh

**Option B: Browser console**
1. Open Homestead Planner (http://localhost:3000)
2. Press F12 to open DevTools
3. Go to Console tab
4. Run: `localStorage.removeItem('plantIcon_displayMode')`
5. Refresh the page

### Step 2: Verify Build

```bash
cd frontend
npx tsc --noEmit
```

Expected: No TypeScript errors (warnings are okay)

## Test Plan

### Test 1: Default Behavior (PNG Icons)

**Objective**: Verify icons show as PNG images by default

1. Navigate to Garden Designer tab
2. Open Plant Palette (right sidebar)
3. **Verify**: Plant icons display as PNG images (not emojis)
4. **Verify**: No toggle button (🖼️/📝) in Plant Palette header
5. **Verify**: Only collapse/expand button (▲/▼) is present

**Expected Results**:
- ✅ All plant icons show as PNG images (where PNG files exist)
- ✅ No toggle button present
- ✅ Icons are clear and not placeholder emojis

---

### Test 2: Navigation Persistence

**Objective**: Verify icon display persists across tab navigation

1. While viewing Garden Designer with PNG icons
2. Navigate to Property Designer tab
3. Navigate to Planting Calendar tab
4. Navigate to Seeds tab
5. Navigate back to Garden Designer
6. **Verify**: Icons still show as PNG images
7. **Verify**: No mode switching occurred

**Expected Results**:
- ✅ Icons remain as PNGs throughout navigation
- ✅ No switch to emoji mode
- ✅ Consistent display across all tabs

---

### Test 3: Page Reload Persistence

**Objective**: Verify icon display persists after page refresh

1. While viewing PNG icons in Garden Designer
2. Refresh the browser (F5 or Ctrl+R)
3. Wait for page to reload
4. Navigate to Garden Designer
5. **Verify**: Icons still show as PNG images
6. **Verify**: No localStorage interference

**Expected Results**:
- ✅ Icons show as PNGs after reload
- ✅ Default behavior maintained
- ✅ No mode reset issues

---

### Test 4: Emoji Fallback

**Objective**: Verify emoji fallback works for missing PNG files

1. Open Browser DevTools (F12)
2. Go to Console tab
3. Look for any 404 errors for plant-icons/*.png
4. If found, identify plants without PNG files
5. Find those plants in Plant Palette
6. **Verify**: They display emojis instead of broken images
7. **Verify**: No console errors about failed image loads

**Expected Results**:
- ✅ Plants without PNG files show emojis
- ✅ No broken image icons
- ✅ Graceful fallback behavior

---

### Test 5: Component Coverage

**Objective**: Verify all components show PNG icons correctly

**5.1 Garden Designer**
1. Navigate to Garden Designer
2. Drag a plant from palette onto grid
3. **Verify**: Placed plant shows PNG icon
4. Click on placed plant
5. **Verify**: PlantConfigModal shows PNG icon
6. **Result**: ✅ / ❌

**5.2 Planting Calendar - Succession Wizard**
1. Navigate to Planting Calendar
2. Click "Add Succession Planting"
3. Step through the wizard
4. **Verify**: Plants in wizard show PNG icons
5. **Result**: ✅ / ❌

**5.3 Garden Designer - Row Schedule**
1. Navigate to Garden Designer
2. Create a row with plants
3. Click "View Schedule" on the row
4. **Verify**: RowScheduleModal shows PNG icons
5. **Result**: ✅ / ❌

**5.4 Garden Designer - Guild Selector**
1. Navigate to Garden Designer
2. Click "Add Guild" (if available)
3. **Verify**: Guild plant list shows PNG icons
4. **Result**: ✅ / ❌

**5.5 Garden Designer - Row Variety Modal**
1. Navigate to Garden Designer
2. Open row configuration
3. Select varieties
4. **Verify**: Variety modal shows PNG icons
5. **Result**: ✅ / ❌

---

### Test 6: Visual Consistency

**Objective**: Verify icons look correct and consistent

1. Navigate through all tabs that show plant icons
2. **Verify**: Icon size is consistent
3. **Verify**: Icons are not stretched or distorted
4. **Verify**: Icons are centered properly
5. **Verify**: No visual glitches or flickering

**Expected Results**:
- ✅ Consistent icon sizing across all views
- ✅ Proper aspect ratio maintained
- ✅ No visual artifacts
- ✅ Smooth rendering

---

### Test 7: Performance Check

**Objective**: Verify no performance degradation

1. Open Browser DevTools (F12)
2. Go to Network tab
3. Refresh the page
4. Navigate to Garden Designer
5. Open Plant Palette
6. **Verify**: PNG images load efficiently
7. **Verify**: No excessive network requests
8. Check Console for any warnings

**Expected Results**:
- ✅ Images load quickly
- ✅ No duplicate requests
- ✅ No console warnings or errors
- ✅ Smooth scrolling in Plant Palette

---

## Test Results Summary

| Test | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | Default Behavior | ⬜ Not Tested | PNG icons display by default |
| 2 | Navigation Persistence | ⬜ Not Tested | Icons persist across tabs |
| 3 | Page Reload | ⬜ Not Tested | Icons persist after refresh |
| 4 | Emoji Fallback | ⬜ Not Tested | Fallback for missing PNGs |
| 5.1 | Garden Designer | ⬜ Not Tested | PlantConfigModal |
| 5.2 | Succession Wizard | ⬜ Not Tested | Planting Calendar |
| 5.3 | Row Schedule | ⬜ Not Tested | RowScheduleModal |
| 5.4 | Guild Selector | ⬜ Not Tested | Guild plants |
| 5.5 | Row Variety | ⬜ Not Tested | Variety selection |
| 6 | Visual Consistency | ⬜ Not Tested | No glitches |
| 7 | Performance | ⬜ Not Tested | Efficient loading |

**Legend**: ⬜ Not Tested | ✅ Pass | ❌ Fail | ⚠️ Issue Found

---

## Known Issues (If Any)

*Document any issues found during testing here*

---

## Rollback Plan (If Needed)

If major issues are discovered:

1. **Restore from Git**:
   ```bash
   git checkout HEAD~1 -- frontend/src/contexts/IconPreferenceContext.tsx
   git checkout HEAD~1 -- frontend/src/App.tsx
   git checkout HEAD~1 -- frontend/src/components/common/PlantIcon.tsx
   git checkout HEAD~1 -- frontend/src/components/common/PlantPalette.tsx
   ```

2. **Or revert the commit**:
   ```bash
   git revert HEAD
   ```

---

## Success Criteria

All tests must pass (✅) for the implementation to be considered complete:

- [x] TypeScript compilation passes
- [ ] All 11 manual tests pass
- [ ] No console errors
- [ ] No visual glitches
- [ ] User satisfied with behavior

---

## Post-Testing Actions

Once all tests pass:

1. Mark all tests as ✅ in the table above
2. Move dev docs folder:
   ```bash
   mv dev/active/plant-palette-png-persistence dev/completed/
   ```
3. Delete temporary files:
   - `clear-icon-preference.html`
   - This testing document (or move to dev/completed/)

---

## Additional Notes

### Why This Change Was Made

User feedback: "No toggle - just use the default always"

The toggle system was over-engineered for the user's needs. They wanted simple PNG-first behavior with automatic emoji fallback, which was already the original PlantIcon behavior. The complex context/toggle system added unnecessary complexity.

### What Was Kept

All component fixes remain (these were the real bugs):
- PlantConfigModal using PlantIcon
- RowScheduleModal using PlantIcon
- SuccessionWizard using PlantIcon
- GuildSelector using PlantIcon
- RowVarietyModal using PlantIcon
- Other components using PlantIcon

These components were incorrectly rendering emojis directly instead of using the PlantIcon component.

### Files Modified

- ❌ Deleted: `frontend/src/contexts/IconPreferenceContext.tsx`
- ✏️ Modified: `frontend/src/App.tsx`
- ✏️ Modified: `frontend/src/components/common/PlantIcon.tsx`
- ✏️ Modified: `frontend/src/components/common/PlantPalette.tsx`
