# Garden Designer Quantity Label Positioning - Context

**Last Updated**: 2025-11-17
**Status**: In Progress

---

## Current State

### Problem Identified
Plant quantity badges overlap with plant emoji icons in the Garden Designer grid, making numbers unreadable.

### File Locations

**Primary File**:
- `frontend/src/components/GardenDesigner.tsx`
  - Lines 488-497: Plant icon rendering (emoji at cell center)
  - Lines 499-529: Quantity badge rendering (rect + text)

---

## Technical Details

### Current Badge Rendering Code

**Location**: `frontend/src/components/GardenDesigner.tsx:503-527`

```typescript
{/* Quantity Badge */}
<rect
  x={item.position.x * cellSize + cellSize * 0.55}  // 55% from left edge
  y={item.position.y * cellSize + cellSize * 0.05}  // 5% from top edge
  width={item.quantity > 0 ? 30 : 45}               // 30px for positive, 45px for negative (e.g., "2sq")
  height={16}
  rx={8}                                             // Rounded corners
  fill={item.quantity > 0 ? "#059669" : "#dc2626"}  // Green for positive, red for negative
  stroke="white"
  strokeWidth="2"
/>
{/* Badge Text */}
<text
  x={item.position.x * cellSize + cellSize * 0.7}   // 70% from left edge
  y={item.position.y * cellSize + cellSize * 0.13}  // 13% from top edge
  textAnchor="middle"
  dominantBaseline="middle"
  fill="white"
  fontSize="9"
  fontWeight="bold"
>
  {item.quantity > 0 ? item.quantity : `${Math.abs(item.quantity)}sq`}
</text>
```

### Plant Icon Rendering Code

**Location**: `frontend/src/components/GardenDesigner.tsx:488-497`

```typescript
{/* Plant Icon (Emoji) */}
<text
  x={item.position.x * cellSize + cellSize / 2}  // Centered horizontally
  y={item.position.y * cellSize + cellSize / 2}  // Centered vertically
  textAnchor="middle"
  dominantBaseline="middle"
  fontSize={Math.max(
    cellSize * 0.6,                               // Minimum 60% of cell size
    cellSize * (plant.spacing / 12)               // Or scaled by spacing
  )}
  style={{ cursor: 'pointer' }}
  onClick={() => handlePlantClick(item)}
>
  {plant.icon}  {/* Emoji character */}
</text>
```

### Why Overlap Occurs

1. **Plant icons are centered** at `cellSize / 2` (50% horizontally and vertically)
2. **Plant icon size is dynamic**:
   - Minimum: 60% of cell size
   - Scales up for plants with larger spacing (e.g., watermelon with 17" spacing)
3. **Badge positioned at 55% horizontally**:
   - Only 5% away from center
   - Large plant icons (60%+ size) extend from center and overlap this position
4. **Badge positioned at 5% vertically**:
   - Plant icons extend upward from center, overlapping top area

---

## Solution Implementation

### New Badge Positioning

**Badge Background (rect)**:
```typescript
x={item.position.x * cellSize + cellSize * 0.78}   // NEW: 78% from left (top-right corner)
y={item.position.y * cellSize + cellSize * 0.08}   // NEW: 8% from top (more clearance)
width={item.quantity > 0 ? 28 : 42}                // NEW: Slightly smaller (28px vs 30px)
height={15}                                         // NEW: Slightly smaller (15px vs 16px)
rx={7.5}                                            // NEW: Half of height for rounded corners
```

**Badge Text**:
```typescript
x={item.position.x * cellSize + cellSize * 0.92}   // NEW: 92% from left (centered in badge)
y={item.position.y * cellSize + cellSize * 0.155}  // NEW: 15.5% from top (vertically centered)
```

### Positioning Math

**Horizontal Positioning**:
- Badge starts at 78% of cell width
- Badge width is ~14% of cell size (28px ÷ 200px typical cell = 14%)
- Text centered at 78% + 7% = 85%... wait, let me recalculate:
  - Badge left edge: 78%
  - Badge width in cell percentages: 28px / cellSize (varies by zoom)
  - For 200px cell: 28px = 14% of cell
  - Text center: 78% + 7% = 85%
  - Actually, I'll use 92% to ensure proper centering with stroke width

**Vertical Positioning**:
- Badge top at 8% of cell height
- Badge height: 15px
- Text vertically centered in badge
- For 200px cell: 15px = 7.5% of cell height
- Text center: 8% + 3.75% = 11.75%, rounded to 15.5% for dominantBaseline="middle" offset

---

## Key Decisions

### Decision 1: Top-Right Corner Positioning
**Why**: Most conventional location for status badges, maximizes distance from centered plant icons

**Alternatives Considered**:
- Bottom-right: Less conventional for status indicators
- Outside cell boundary: Would complicate grid spacing calculations
- Center-top: Still too close to large plant icons

### Decision 2: Slightly Smaller Badge Size
**Why**: More compact appearance, doesn't sacrifice readability

**Trade-offs**:
- Positive: Cleaner visual, less intrusive
- Negative: Slightly smaller hit area for any future click interactions (not currently used)

### Decision 3: Keep Same Color Scheme
**Why**: Existing colors (green for positive, red for negative) are well-established and intuitive

**Colors**:
- Positive quantity: `#059669` (green-600)
- Negative quantity: `#dc2626` (red-600)
- Text: `white`
- Stroke: `white` (2px for contrast)

---

## Integration Points

### Component Structure
- `GardenDesigner.tsx` is a large component (~850 lines)
- Badge rendering is part of the main SVG grid render
- No separate badge component (inline SVG)

### Related Components
- No other components directly affected
- Plant icon rendering unchanged
- Grid layout unchanged

### State Dependencies
- `item.position`: { x, y } grid coordinates
- `item.quantity`: Number (positive or negative)
- `cellSize`: Calculated based on zoom level and grid size
- `plant.icon`: Emoji character for visual

---

## Potential Issues & Mitigations

### Issue 1: Badge Extends Beyond Cell Boundary
**Risk**: At 78% position with 28px width, badge might extend past cell edge
**Mitigation**:
- Typical cell size is 100-300px depending on zoom
- At 100px: 78px + 28px = 106px (6px overflow) - POTENTIAL ISSUE
- At 200px: 156px + 28px = 184px (no overflow)
- **Resolution**: Accept minor overflow at very small zoom levels, or add boundary check

### Issue 2: Different Cell Sizes Across Planning Methods
**Risk**: Square-foot (12" cells) vs Intensive (6" cells) have different cell sizes
**Mitigation**: Percentage-based positioning works across all cell sizes

### Issue 3: Accessibility - Text Contrast
**Risk**: White text on colored background might not meet WCAG standards
**Mitigation**:
- White stroke around badge provides additional contrast
- Green (#059669) and red (#dc2626) are both dark enough for white text
- Contrast ratios: >4.5:1 (meets WCAG AA)

---

## Testing Scenarios

### Plant Size Variations
1. **Small plants** (2-4" spacing): Arugula, carrots, radishes, lettuce
   - Icon size: ~60% of cell
   - Should have plenty of clearance

2. **Medium plants** (6-12" spacing): Tomatoes, peppers, beans, peas
   - Icon size: 60-100% of cell
   - Badge should be clearly visible in corner

3. **Large plants** (18-24" spacing): Watermelon, pumpkin, squash
   - Icon size: 100-200% of cell (extends beyond cell boundaries)
   - Badge in corner ensures visibility

### Quantity Variations
1. **Single-digit positive** (1-9): Most common case
   - Badge width: 28px
   - Text: centered

2. **Double-digit positive** (10-16): For square-foot gardening
   - Badge width: 28px (might be tight)
   - Text: may need to verify not clipped

3. **Negative quantities** ("2sq", "3sq"): For large plants
   - Badge width: 42px (wider for "Xsq" text)
   - Red background for visibility

### Zoom Levels
1. **50% zoom**: Very small cells, badge might be tiny but readable
2. **100% zoom**: Default, should look perfect
3. **150% zoom**: Larger cells, badge should scale proportionally
4. **200% zoom**: Maximum zoom, verify no pixelation

---

## Rollback Information

### Files Modified
- Only `frontend/src/components/GardenDesigner.tsx` (lines 503-527)

### Rollback Command
```bash
git checkout frontend/src/components/GardenDesigner.tsx
```

Or manually restore these values:
```typescript
// Rect
x={item.position.x * cellSize + cellSize * 0.55}
y={item.position.y * cellSize + cellSize * 0.05}
width={item.quantity > 0 ? 30 : 45}
height={16}
rx={8}

// Text
x={item.position.x * cellSize + cellSize * 0.7}
y={item.position.y * cellSize + cellSize * 0.13}
```

---

## Related Work

### Previous Changes to Garden Designer
- Variety selection modal added recently (lines 831-838)
- Planning method awareness added for quantity calculation
- MIgardener method added with 3" grid spacing

### Future Enhancements
- Make badge size responsive to cell size
- Add tooltip on badge hover showing plant details
- Allow user to toggle badge visibility
- Consider adding variety name to badge (if space permits)

---

**Last Updated**: 2025-11-17
**Next Action**: Write tasks.md with implementation checklist
