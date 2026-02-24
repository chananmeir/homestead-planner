# Add Harvest Edit Functionality - Context

**Last Updated**: 2025-11-11

## Key Files

### Backend
- **`backend/app.py`** (lines 577-604)
  - Existing harvest routes: GET, POST, DELETE
  - Need to add PUT endpoint at line ~598
  - Pattern: `/api/harvests/<int:record_id>`

### Frontend
- **`frontend/src/components/HarvestTracker.tsx`**
  - Main component managing harvest display
  - Lines 189-221: Table rendering with delete button
  - Need to add Edit button at line ~210

- **`frontend/src/components/HarvestTracker/LogHarvestModal.tsx`**
  - Template for EditHarvestModal
  - Form structure to replicate
  - API call pattern to follow

### Models
- **`backend/models.py`** (lines 222-242)
  - HarvestRecord model definition
  - Fields: id, plant_id, planted_item_id, harvest_date, quantity, unit, notes, quality

## API Structure

### Existing Endpoints
- **GET** `/api/harvests` - Get all harvests
- **POST** `/api/harvests` - Create new harvest
- **DELETE** `/api/harvests/<int:record_id>` - Delete harvest

### New Endpoint
- **PUT** `/api/harvests/<int:record_id>` - Update harvest

### Request Body (PUT)
```json
{
  "plantId": "tomato",
  "harvestDate": "2025-11-11",
  "quantity": 5.5,
  "unit": "lbs",
  "quality": "excellent",
  "notes": "Great harvest"
}
```

### Response (Success)
```json
{
  "message": "Harvest updated successfully",
  "id": 1
}
```

## UI Design

### Edit Button Location
- Table Actions column (line ~210 in HarvestTracker.tsx)
- Place BEFORE delete button
- Use edit icon (pencil)
- Same styling as delete button

### Modal Structure
- Title: "Edit Harvest"
- Same form fields as LogHarvestModal
- Pre-populate with existing data
- Submit button text: "Update Harvest"

## Important Patterns

### Date Handling
```python
# Backend - Use parse_iso_date helper
if 'harvestDate' in data:
    harvest.harvest_date = parse_iso_date(data['harvestDate'])
```

### Frontend State Management
```typescript
const [editModalOpen, setEditModalOpen] = useState(false);
const [selectedHarvest, setSelectedHarvest] = useState<HarvestRecord | null>(null);
```

### API Call Pattern
```typescript
const response = await fetch(`http://localhost:5000/api/harvests/${harvestData.id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

## Design Decisions

1. **Why separate EditHarvestModal?**
   - Cleaner separation of concerns
   - Different props and behavior
   - Easier to maintain

2. **Why pre-populate form?**
   - Better UX - user sees current values
   - Partial edits supported
   - Consistent with other edit modals in codebase

3. **Field update strategy**
   - Update only if field present in request
   - Allows partial updates
   - Matches existing patterns in app.py

## Testing Notes

- Test with different harvest records
- Verify date format handling
- Check form validation
- Test cancel functionality
- Ensure data refreshes after update
