# Bed-Plant Compatibility Logic Documentation

**Date**: 2026-01-29
**Status**: ✅ DOCUMENTED & VERIFIED
**Critical**: This is the single source of truth for compatibility logic

---

## Critical Rule: Don't Duplicate Compatibility Logic

**WRONG** ❌:
```typescript
// DON'T create new compatibility maps in UI code
const compatibilityMap = { 'full': ['full'], ... };
const compatible = compatibilityMap[plant.sunRequirement].includes(bed.sunExposure);
```

**RIGHT** ✅:
```typescript
// DO use the existing function
const compatibility = checkBedSunCompatibility(plantId, bed);
if (compatibility === 'compatible') { ... }
```

**Why**: Duplicating logic leads to divergence where "UI says X but logic does Y".

---

## Single Source of Truth

### Function: `checkBedSunCompatibility()`

**Location**: `frontend/src/components/GardenPlanner.tsx` (line ~385)

**Signature**:
```typescript
const checkBedSunCompatibility = (
  plantId: string,
  bed: GardenBed
): 'compatible' | 'incompatible' | 'unknown'
```

**Return Values**:
- `'compatible'`: Bed's sun exposure explicitly matches plant's requirement
- `'incompatible'`: Bed's sun exposure is explicitly incompatible
- `'unknown'`: Can't determine (either plant data missing OR bed has no sunExposure set)

---

## Compatibility Matrix (Authoritative)

| Plant Requirement | Acceptable Bed Exposures | Rationale |
|-------------------|--------------------------|-----------|
| `'full'` | `['full']` only | Full-sun plants need maximum sunlight |
| `'partial'` | `['full', 'partial']` | Part-sun plants tolerate full sun |
| `'shade'` | `['full', 'partial', 'shade']` | Shade-tolerant plants can handle any exposure |

**Implementation**:
```typescript
const compatibilityMap: { [key: string]: string[] } = {
  'full': ['full'],
  'partial': ['full', 'partial'],
  'shade': ['full', 'partial', 'shade']
};
```

---

## Critical Behavior: 'unknown' Treatment

### Current Behavior (Intentional)

**Beds WITHOUT `sunExposure` set are treated as COMPATIBLE (not filtered out)**

**Rationale**:
- Allows flexibility for users who haven't configured beds yet
- Prevents blocking all plantings when configuration incomplete
- "Unknown" is permissive, not restrictive

**Code**:
```typescript
// In checkBedSunCompatibility()
if (!bed.sunExposure) {
  return 'unknown'; // Treated as flexible → NOT filtered out
}

// In getCompatibleBeds()
return gardenBeds.filter(bed => {
  const sunCompatibility = checkBedSunCompatibility(seed.plantId, bed);
  // INCLUDES: 'compatible' and 'unknown'
  // EXCLUDES: 'incompatible' only
  return sunCompatibility !== 'incompatible';
});
```

### User-Visible Impact

**Scenario 1**: No beds have `sunExposure` set
- All beds return `'unknown'`
- All beds pass filter (included)
- User can assign plants to any bed
- **UI shows**: Orange warning panel + message explaining behavior

**Scenario 2**: Mixed configuration (some beds configured, some not)
- Configured beds return `'compatible'` or `'incompatible'`
- Unconfigured beds return `'unknown'` (included)
- Only explicitly incompatible beds are filtered out
- **UI shows**: Orange warning panel listing unconfigured beds

**Scenario 3**: All beds configured, all incompatible
- All beds return `'incompatible'`
- All beds filtered out
- Empty compatible beds list
- **UI shows**: "❌ No compatible beds" with specific exposures

---

## UI Error Messages (Implementation)

### Error Message Logic (Corrected)

**File**: `frontend/src/components/GardenPlanner.tsx` (line ~1721)

**Uses Real Function**:
```typescript
// ✅ CORRECT: Use actual compatibility function
const compatibilityResults = gardenBeds.map(bed => ({
  bed,
  compatibility: checkBedSunCompatibility(seed.plantId, bed)
}));

const compatibleCount = compatibilityResults.filter(r => r.compatibility === 'compatible').length;
const incompatibleCount = compatibilityResults.filter(r => r.compatibility === 'incompatible').length;
const unknownCount = compatibilityResults.filter(r => r.compatibility === 'unknown').length;
```

### Error Messages

#### Message 1: All beds missing sun exposure
```
❌ No beds have sun exposure configured. Beds without sun exposure are treated as
compatible, but you should set sun exposure in Garden Designer to ensure proper
plant placement.
```

**Trigger**: `bedsWithSun.length === 0`
**Clarifies**: Unknown beds are NOT blocking, but configuration recommended

#### Message 2: All configured beds incompatible
```
❌ Tomato requires full sun. Your 2 configured bed(s) have: partial, shade.
(1 bed(s) have no sun exposure set and are treated as compatible)
Add a compatible bed or choose a different plant.
```

**Trigger**: `compatibleCount === 0 && incompatibleCount > 0`
**Shows**:
- Plant name and requirement
- Actual bed exposures
- Count of unconfigured beds (if any)
- Actionable next step

#### Message 3: Fallback (shouldn't happen)
```
❌ No compatible beds available. Tomato requires full sun.
(0 compatible, 3 incompatible, 2 unknown)
```

**Trigger**: Shouldn't happen if logic is consistent
**Shows**: Debug summary of compatibility counts

---

## UI Status Panel (Updated)

### Orange Warning (Missing Sun Exposure)

**Shows**:
```
☀️ Bed Sun Exposure Configuration

2 of 5 bed(s) missing sun exposure configuration.

⚠️ Current Behavior:
Beds without sun exposure set are treated as compatible with all plants (not
filtered out). This allows flexibility but may result in suboptimal plant placement.

⛔ "No Compatible Beds Available" errors occur when:
• All beds with sun exposure set are incompatible with the plant
• The plant's sun requirement doesn't match any configured bed

[Expandable] View beds needing configuration (2)
  • North Bed (ID: 1)
  • East Bed (ID: 2)

→ Recommended: Go to Garden Designer → Edit each bed → Set sun exposure
```

**Key Points**:
- Explicitly states 'unknown' = compatible
- Explains when "No Compatible Beds" actually occurs
- Lists specific beds needing configuration
- Recommends (but doesn't require) configuration

### Green Success (All Configured)

**Shows**:
```
✅ Bed Sun Exposure: Fully Configured

All 5 bed(s) have sun exposure set. Plants will only show if compatible with
your bed configurations.

[Debug Only] View bed sun exposure details
```

---

## Alternative Behaviors (Not Implemented)

### Option A: Strict Mode (Treat 'unknown' as Incompatible)

**Change**:
```typescript
// Would need to change getCompatibleBeds() to:
return sunCompatibility === 'compatible'; // Exclude both 'incompatible' AND 'unknown'
```

**Impact**:
- Forces users to configure ALL beds before using Season Planner
- More strict, less flexible
- "No Compatible Beds" error for ANY unconfigured bed

**Tradeoff**: Better data quality, but worse UX for new users

### Option B: Prompt on Unknown

**Change**: Show modal asking user to configure beds when 'unknown' detected

**Impact**:
- Interrupts workflow
- More intrusive than current warning panel

**Tradeoff**: Forces action, but annoying for users who want flexibility

---

## Testing Compatibility Logic

### Test 1: Verify Compatibility Matrix

```typescript
// Full-sun plant
expect(checkBedSunCompatibility('tomato-1', { sunExposure: 'full' })).toBe('compatible');
expect(checkBedSunCompatibility('tomato-1', { sunExposure: 'partial' })).toBe('incompatible');
expect(checkBedSunCompatibility('tomato-1', { sunExposure: 'shade' })).toBe('incompatible');

// Partial-sun plant
expect(checkBedSunCompatibility('lettuce-1', { sunExposure: 'full' })).toBe('compatible');
expect(checkBedSunCompatibility('lettuce-1', { sunExposure: 'partial' })).toBe('compatible');
expect(checkBedSunCompatibility('lettuce-1', { sunExposure: 'shade' })).toBe('incompatible');

// Shade plant
expect(checkBedSunCompatibility('fern-1', { sunExposure: 'full' })).toBe('compatible');
expect(checkBedSunCompatibility('fern-1', { sunExposure: 'partial' })).toBe('compatible');
expect(checkBedSunCompatibility('fern-1', { sunExposure: 'shade' })).toBe('compatible');
```

### Test 2: Verify 'unknown' Treatment

```typescript
// Missing sun exposure
expect(checkBedSunCompatibility('tomato-1', { sunExposure: undefined })).toBe('unknown');

// Should be included in getCompatibleBeds()
const beds = [{ id: 1, sunExposure: undefined }];
const seed = { plantId: 'tomato-1' };
expect(getCompatibleBeds(seed, beds)).toHaveLength(1); // Includes 'unknown' bed
```

### Test 3: Verify Error Messages Use Real Function

**Manual Test**:
1. Create 2 beds: one 'full', one 'partial'
2. Select tomato (requires 'full')
3. Error message should show: "Your 2 configured bed(s) have: full, partial"
4. Change both beds to 'shade'
5. Error message should update: "Your 2 configured bed(s) have: shade, shade"

**Verify**: Error message updates reflect actual `checkBedSunCompatibility()` results

---

## Debug Mode Details

### Enable Debug Logging

**File**: `frontend/src/components/GardenPlanner.tsx` (line ~24)
```typescript
const DEBUG_SEASON_PLANNER = true; // Enable
```

### Sample Debug Output

```
[SeasonPlanner] No Compatible Beds Found
  Seed: { id: 123, plantId: 'tomato-1', variety: 'Roma' }
  Plant: { name: 'Tomato', sunRequirement: 'full' }
  Total beds: 3
  Bed compatibility analysis:
    - Bed "North Bed" (ID: 1):
        sunExposure: "NOT SET"
        compatibility: "unknown"
        reason: "No sunExposure set (treated as unknown/compatible)"
    - Bed "South Bed" (ID: 2):
        sunExposure: "partial"
        compatibility: "incompatible"
        reason: "Incompatible: plant needs full, bed has partial"
    - Bed "East Bed" (ID: 3):
        sunExposure: "shade"
        compatibility: "incompatible"
        reason: "Incompatible: plant needs full, bed has shade"
```

**Each bed shows**:
- Actual `sunExposure` value (or "NOT SET")
- Result from `checkBedSunCompatibility()`
- Human-readable reason

---

## Code Review Checklist

When reviewing compatibility-related changes:

- [ ] Does the code call `checkBedSunCompatibility()` instead of reimplementing logic?
- [ ] Are error messages built from actual compatibility results?
- [ ] Is 'unknown' treatment consistent (included, not excluded)?
- [ ] Are comments/docs updated if behavior changes?
- [ ] Does UI messaging match actual logic behavior?

---

## Summary

**Single Source**: `checkBedSunCompatibility()` function
**Compatibility Matrix**: Documented in function comments
**'unknown' Behavior**: Treated as compatible (not filtered out)
**Error Messages**: Use real function results, not duplicate logic
**UI Panel**: Explicitly explains 'unknown' treatment
**Debug Mode**: Shows per-bed compatibility analysis

**This document is authoritative. Update it when logic changes.**
