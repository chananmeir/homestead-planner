# Clickable Date Suggestion Feature

## What Was Implemented

Made the suggested waiting period in cold danger warnings clickable, so users can instantly jump to the safe planting date.

## Example

**Before** (plain text):
```
⚠️ Historical data shows dangerous cold ahead! February 13 typically
reaches 10.3°F, which is 21.7°F below this plant's survival threshold (32°F).
Seedlings that germinate around Jan 19 will likely be killed by this cold snap.
Consider waiting 36 more days or using season extension (row covers, cold frames).
```

**After** (clickable):
```
⚠️ Historical data shows dangerous cold ahead! February 13 typically
reaches 10.3°F, which is 21.7°F below this plant's survival threshold (32°F).
Seedlings that germinate around Jan 19 will likely be killed by this cold snap.
Consider [waiting 36 more days] or using season extension (row covers, cold frames).
         ^^^^^^^^^^^^^^^^^^^
         CLICKABLE LINK
```

## How It Works

1. **User tries to plant on Jan 9** → Warning shows: "waiting 36 more days"
2. **User clicks "waiting 36 more days"** → Date automatically changes to Feb 14 (Jan 9 + 36 days)
3. **Validation re-runs** → No more warnings (safe to plant!)

## Technical Implementation

### Files Modified:

1. **frontend/src/components/common/WarningDisplay.tsx**
   - Added `currentPlantingDate` prop
   - Added `renderWarningMessage()` function that:
     - Parses warning text for "waiting X more days" pattern
     - Calculates suggested date (current date + X days)
     - Renders clickable button for that text
   - Button updates date filter via `onChangeDateClick` callback

2. **frontend/src/components/GardenDesigner/PlantConfigModal.tsx**
   - Passed `currentPlantingDate={plantingDate}` to WarningDisplay
   - Already had `onDateChange` callback wired up

3. **frontend/src/components/GardenDesigner.tsx**
   - Already had `onDateChange` callback implemented (lines 3028-3032)
   - Updates `dateFilter` state and URL when date changes

## User Experience

1. User sees warning about planting too early
2. Clicks underlined "waiting 36 more days" text
3. Date picker instantly jumps to Feb 14, 2026
4. Warning disappears (or shows new validation for new date)
5. User can proceed with planting

## Styling

- Clickable text is **bold** and **underlined**
- Hover effect changes to blue color
- Tooltip shows full date when hovering: "Change planting date to Feb 14, 2026"
- Integrates seamlessly with existing warning UI

## Edge Cases Handled

- If no `onDateChange` callback provided → Shows plain text (no link)
- If no `currentPlantingDate` provided → Shows plain text
- If warning doesn't contain "waiting X more days" → Shows plain text
- Multiple warnings → Each warning parsed independently

## Browser Compatibility

Works in all modern browsers (uses standard JavaScript Date API and CSS hover effects).
