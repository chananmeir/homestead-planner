# Plant Icon Navigation Bug Fix - Implementation Summary

## Date: 2026-01-27

## Problem
Plant icons showed correctly as PNGs on initial Garden Designer load, but when users navigated to Property Designer and back to Garden Designer, the icons reverted to emojis.

## Root Cause
PlantIconSVG component had insufficient state management on remount:
1. When GardenDesigner unmounted/remounted during tab navigation, PlantIconSVG components were recreated
2. Component only tracked `useImage` state (try PNG vs use emoji)
3. No tracking of whether image successfully loaded
4. React may have reused some state or browser cache interfered with image loading
5. On remount, image would fail and trigger fallback to emoji

## Solution Implemented

### Phase 1: Add Key Props to Force Proper Remounting ✅

Added unique `key` props to all PlantIconSVG usages to force React to create completely fresh component instances on remount:

**Files Modified:**
1. **`frontend/src/components/GardenDesigner.tsx`** (line 3414)
   - Added: `key={`${item.plantId}-${plantX}-${plantY}`}`

2. **`frontend/src/components/GardenDesigner/GuildPreview.tsx`** (line 175)
   - Added: `key={`guild-${plant.id}-${idx}-${i}`}`

3. **`frontend/src/components/GardenDesigner/PlacementPreview.tsx`** (line 65)
   - Added: `key={`preview-${plantId}-${centerX}-${centerY}`}`

**Why this works:** React uses the `key` prop to track component identity. When GardenDesigner remounts, the unique keys ensure React treats each instance as completely new, bypassing any stale state issues.

### Phase 2: Improve PlantIconSVG State Tracking ✅

Enhanced PlantIconSVG component to mirror the state management pattern from the DOM-based PlantIcon component:

**File Modified:** `frontend/src/components/common/PlantIcon.tsx` (lines 95-140)

**Changes Made:**
1. **Added `imageLoaded` state variable** - Tracks whether image has successfully loaded
2. **Added `handleImageLoad` handler** - Sets `imageLoaded = true` on successful load
3. **Added `handleImageError` handler** - Logs errors and sets `useImage = false`
4. **Added console logging** - For debugging image load/mount lifecycle
5. **Added opacity transition** - Image fades in when loaded (opacity: 0 → 1)
6. **Added emoji placeholder** - Shows while image is loading
7. **Reset both states on plantId change** - `setUseImage(true)` and `setImageLoaded(false)`

**Code Pattern:**
```typescript
const [useImage, setUseImage] = useState(true);
const [imageLoaded, setImageLoaded] = useState(false);

useEffect(() => {
  console.log(`[PlantIconSVG] Mounting/Resetting: ${plantId}, useImage=true`);
  setUseImage(true);
  setImageLoaded(false);
}, [plantId]);

const handleImageLoad = () => {
  console.log(`[PlantIconSVG] Successfully loaded: ${imagePath}`);
  setImageLoaded(true);
};

const handleImageError = () => {
  console.warn(`[PlantIconSVG] Failed to load: ${imagePath}`);
  setUseImage(false);
};
```

## Testing Required

### 1. TypeScript Build Check ✅
```bash
cd frontend
npx tsc --noEmit
```
**Status:** PASSED - No TypeScript errors

### 2. Navigation Persistence Test (REQUIRED)
1. Start application
2. Navigate to Garden Designer tab
3. **Verify**: Icons show as PNGs in Plant Palette
4. **Verify**: Icons show as PNGs on grid (if any plants placed)
5. Navigate to Property Designer tab
6. Navigate back to Garden Designer tab
7. **CRITICAL VERIFY**: Icons STILL show as PNGs (not emojis!)
8. Repeat steps 5-7 multiple times
9. **Verify**: Icons remain PNGs consistently

### 3. Browser Console Debugging
Watch for these log messages:
- `[PlantIconSVG] Mounting/Resetting: {plantId}, useImage=true` - On tab switch
- `[PlantIconSVG] Successfully loaded: /plant-icons/{plantId}.png` - On successful load
- `[PlantIconSVG] Failed to load: /plant-icons/{plantId}.png` - On errors (shouldn't happen if PNGs exist)

### 4. Visual Verification
- No flickering during navigation
- Smooth fade-in of PNG images
- Emoji placeholder visible only during initial load
- No broken image icons

## Expected Behavior After Fix

### Navigation Flow
1. Load Garden Designer → Icons show as PNGs
2. Switch to Property Designer → (GardenDesigner unmounts)
3. Switch back to Garden Designer → (GardenDesigner remounts with fresh instances)
4. Icons STILL show as PNGs (no reversion to emojis)

### Component Lifecycle
- Each PlantIconSVG gets unique key based on position
- On remount, React creates completely fresh component instances
- Each instance starts with clean state: `useImage=true`, `imageLoaded=false`
- Image loads successfully, sets `imageLoaded=true`
- PNG becomes visible, emoji placeholder hidden

## Why These Fixes Work Together

1. **Key props** ensure React creates fresh component instances on remount
2. **ImageLoaded tracking** provides proper state management during load lifecycle
3. **Console logging** enables debugging of mount/load sequence
4. **Opacity transition** provides visual feedback that image is loading
5. **Emoji placeholder** prevents blank space during load

## Previous Work (Already Complete)

### Toggle System Removal ✅
- Deleted `IconPreferenceContext.tsx`
- Removed toggle button from PlantPalette
- Simplified PlantIcon to always try PNG first
- Result: Icons show correctly on initial load

## Files Modified Summary

### Phase 1: Key Props (3 files)
1. `frontend/src/components/GardenDesigner.tsx`
2. `frontend/src/components/GardenDesigner/GuildPreview.tsx`
3. `frontend/src/components/GardenDesigner/PlacementPreview.tsx`

### Phase 2: State Tracking (1 file)
1. `frontend/src/components/common/PlantIcon.tsx`

## Success Criteria

- ✅ TypeScript build passes (0 errors)
- ⏳ Icons show as PNGs on initial Garden Designer load
- ⏳ Icons remain PNGs when navigating between tabs
- ⏳ No emoji reversion on remount
- ⏳ Console shows proper mount/load sequence
- ⏳ No visual flickering or glitches
- ⏳ User confirms consistent PNG display

## Next Steps

1. **Test navigation persistence** - Primary test to verify bug is fixed
2. **Clear browser cache** - Hard refresh (Ctrl+Shift+R) before testing
3. **Check browser console** - Verify proper logging sequence
4. **User acceptance testing** - Confirm icons stay as PNGs consistently
5. **Remove console logs** - After verification, can remove debug logging if desired

## Notes

- The bug only manifested on tab navigation, not initial load
- Key props are essential for proper remount behavior
- ImageLoaded state prevents premature rendering
- Console logs can be removed after verification
- This fix mirrors the pattern already working in DOM-based PlantIcon component
