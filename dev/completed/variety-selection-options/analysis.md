# Current State Analysis: Variety Support in Garden Designer

**Last Updated**: 2025-11-17
**Status**: Research Complete

## Executive Summary

The Homestead Planner application has **comprehensive variety support in the data model and other features** (Seed Inventory, Planting Calendar) but **lacks variety selection capability in the Garden Designer**. When users drag plants from the palette to the garden grid, they cannot specify which variety to plant.

---

## Current State: Data Model

### Database Support (COMPLETE ✅)

**PlantingEvent Model** (`backend/models.py`, line 60-89):
```python
class PlantingEvent(db.Model):
    variety = db.Column(db.String(100))  # Line 63
```
- Supports variety field
- Used by Planting Calendar feature
- Properly serialized in `to_dict()` method

**PlantedItem Model** (`backend/models.py`, line 34-58):
```python
class PlantedItem(db.Model):
    plant_id = db.Column(db.String(50), nullable=False)
    # NO variety field ❌
```
- **MISSING variety field** - this is the core gap
- Used by Garden Designer for plant placement
- Only stores `plant_id`, not variety

**SeedInventory Model** (`backend/models.py`, line 244-328):
- Stores varieties with extensive agronomic data
- Variety field is required (NOT NULL)
- Has comprehensive variety-specific overrides (days to maturity, spacing, etc.)
- API endpoint exists: `/api/seeds/varieties/<plant_id>` (returns list of varieties)

### Plant Database (COMPLETE ✅)

**Plant Types** (`backend/plant_database.py`):
- Base plant types defined (e.g., `lettuce-1`)
- Multiple lettuce type-specific entries exist:
  - `lettuce-looseleaf-1` (line 82)
  - `lettuce-romaine-1` (line 108)
  - `lettuce-butterhead-1` (line 133)
  - `lettuce-crisphead-1` (line 158)
  - `lettuce-summercrisp-1` (line 183)
- Each has different spacing, days to maturity, etc.

**Implication**: The system treats different lettuce types as separate plant_ids rather than varieties of one plant type.

---

## Current State: Garden Designer

### Component Architecture

**GardenDesigner.tsx** (`frontend/src/components/GardenDesigner.tsx`):
- Uses `@dnd-kit` for drag-and-drop
- Plant selection: Drag from palette → Drop on grid
- Data sent to API (line 347-362):
  ```typescript
  const payload = {
    gardenBedId: selectedBed.id,
    plantId: plant.id,  // Only plant_id, NO variety ❌
    position: { x: gridX, y: gridY },
    quantity: Math.floor(plantsPerSquare),
    status: 'planned',
  };
  ```

**PlantPalette.tsx** (`frontend/src/components/common/PlantPalette.tsx`):
- Sidebar showing draggable plant cards
- Filter by category (vegetable, herb, flower, fruit)
- Search by name
- **NO variety dropdown or selection** ❌

**Backend API** (`backend/app.py`, line 326-366):
```python
@app.route('/api/planted-items', methods=['POST'])
def add_planted_item():
    item = PlantedItem(
        plant_id=data['plantId'],
        garden_bed_id=data['gardenBedId'],
        # NO variety handling ❌
    )
```

---

## Current State: Other Features (FOR REFERENCE)

### Planting Calendar (VARIETY SUPPORT EXISTS ✅)

**AddCropModal** (`frontend/src/components/PlantingCalendar/AddCropModal/index.tsx`, line 28-100):
```typescript
const [variety, setVariety] = useState('');
const [availableVarieties, setAvailableVarieties] = useState<string[]>([]);

// Fetches varieties from seed inventory API
useEffect(() => {
  const fetchVarieties = async () => {
    const response = await fetch(`${API_BASE_URL}/api/seeds/varieties/${selectedPlant}`);
    const varieties = await response.json();
    setAvailableVarieties(varieties);
  };
  fetchVarieties();
}, [selectedPlant]);
```

**UI Pattern** (line 230-268):
- Dropdown if varieties exist in seed inventory
- Manual text input as fallback
- Optional field (can leave blank)

### Seed Inventory (VARIETY SUPPORT EXISTS ✅)

**AddSeedModal** (`frontend/src/components/SeedInventory/AddSeedModal.tsx`, line 150-155):
```typescript
<FormInput
  label="Variety"
  value={formData.variety}
  onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
  placeholder="e.g., Cherry Tomato, Beefsteak, etc."
/>
```

**UI Pattern**:
- Simple text input
- Required field for seed inventory
- No dropdown (user types freely)

---

## Gaps Identified

### 1. Database Schema Gap (CRITICAL)
- **PlantedItem model lacks `variety` field**
- Would need migration to add column
- Backend API needs to accept variety in payload

### 2. Frontend Garden Designer Gaps
- **No UI for variety selection** during plant placement
- PlantPalette component has no variety dropdown
- No modal/dialog after drag-drop to configure variety
- No variety shown in planted item tooltips/legend

### 3. API Gaps
- `POST /api/planted-items` doesn't accept variety field
- `PUT /api/planted-items/<id>` doesn't allow updating variety

---

## Existing Patterns to Reuse

### UI Pattern from Planting Calendar
✅ **Dropdown + Fallback Input Pattern**:
- Try to fetch varieties from seed inventory API
- If varieties exist → show dropdown
- If no varieties → show text input for manual entry
- Make field optional (user can skip)

### API Pattern from Seed Inventory
✅ **Varieties Endpoint**:
- `GET /api/seeds/varieties/<plant_id>`
- Returns `string[]` of variety names
- Already implemented and working

### Component Pattern
✅ **Modal Dialog Pattern**:
- App uses modal dialogs throughout (BedFormModal, AddSeedModal, etc.)
- Consistent styling with Tailwind CSS
- Loading states, error handling, validation

---

## Technical Constraints

### Database Migration Required
- Adding `variety` column to `planted_item` table
- Should be nullable (optional field)
- Migration script pattern exists in codebase

### Backward Compatibility
- Existing PlantedItem records have no variety
- UI must handle NULL/empty variety gracefully
- Display "No variety" or omit from display

### Plant Database Design Choice
- Current approach: Different lettuce types are separate plant_ids
- Alternative approach: One "Lettuce" plant with varieties
- **Both approaches can coexist**

---

## Key Decision Points

### 1. Where to Add Variety Selection?
- **Option A**: Dropdown on plant palette cards
- **Option B**: Modal after drag-drop
- **Option C**: Inline selector in grid cell after placement
- **Option D**: Configuration panel/sidebar

### 2. When to Show Variety Selector?
- **Always** (even if no varieties in seed inventory)
- **Only if varieties exist** in seed inventory
- **On-demand** (user clicks "configure" button)

### 3. How to Handle Variety Data?
- **Source 1**: Seed inventory varieties (via API)
- **Source 2**: Manual text entry (user types variety name)
- **Source 3**: Plant database entries (different plant_ids)

---

## Files Requiring Changes (Any Option)

### Backend
- `backend/models.py` - Add variety field to PlantedItem
- `backend/app.py` - Update POST/PUT endpoints to accept variety
- `backend/migrations/` - Create migration script for variety column

### Frontend
- `frontend/src/components/GardenDesigner.tsx` - Update payload to send variety
- `frontend/src/types.ts` - Add variety to PlantedItem type
- **Component to add** (varies by option chosen)

---

## Next Steps

This analysis provides foundation for generating implementation options. Each option will differ in:
1. **User Experience** - When/where variety selection happens
2. **Implementation Complexity** - Number of components to create/modify
3. **Consistency with Existing UI** - Match current patterns
4. **Effort Required** - Small/Medium/Large estimation

See `options.md` for detailed implementation options.
