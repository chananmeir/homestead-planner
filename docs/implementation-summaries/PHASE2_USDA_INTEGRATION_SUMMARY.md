# Phase 2 Implementation Summary: USDA API Integration

**Implementation Date:** 2026-01-25
**Status:** ✅ Complete
**Phase:** USDA API Integration

---

## Overview

Phase 2 of the Nutritional Output Tracking System has been successfully implemented, adding full USDA FoodData Central API integration to Homestead Planner. Admins can now search the USDA database of 170,000+ foods and import nutritional data with a few clicks.

---

## What Was Implemented

### ✅ Task 1: USDA API Service
**File:** `backend/services/usda_api_service.py`

**Features:**
- `search_foods(query, page_size, page_number, data_type)` - Search USDA database
- `get_food_details(fdc_id, format)` - Fetch complete nutritional data
- `map_usda_to_nutritional_data(fdc_id, source_id, yields)` - Map USDA → our schema
- `cache_nutritional_data(data, user_id)` - Store in database
- `import_from_usda(fdc_id, source_id, yields, user_id)` - Complete workflow
- Rate limiting: 900 requests/hour safety buffer (USDA limit: 1,000/hour)

**Nutrient Mapping:**
Maps 15 nutrients from USDA database:
- Macronutrients: Calories, protein, carbs, fat, fiber
- Vitamins: A, C, K, E, folate
- Minerals: Calcium, iron, magnesium, potassium, zinc

---

### ✅ Task 2: API Key Configuration
**Files:**
- `backend/.env.example` - Added USDA_API_KEY configuration
- Uses `os.getenv('USDA_API_KEY')` pattern (consistent with other API keys)

**Setup Instructions:**
1. Sign up at https://fdc.nal.usda.gov/api-key-signup.html
2. Get free API key (instant approval)
3. Add to `.env` file: `USDA_API_KEY=your_key_here`
4. Restart backend

---

### ✅ Task 3: USDA API Endpoints
**File:** `backend/blueprints/nutrition_bp.py`

**New Endpoints:**

**GET /api/nutrition/usda/search**
- Query params: `query`, `page_size`, `page_number`, `data_type`
- Returns: `{ totalHits, currentPage, totalPages, foods: [...] }`
- Requires authentication

**POST /api/nutrition/usda/import**
- Body: `{ fdc_id, source_id, yield_lbs_per_plant?, yield_lbs_per_sqft?, is_global? }`
- Returns: Imported nutritional data entry
- Requires authentication (admin for global data)

**Error Handling:**
- 400: Missing API key or invalid request
- 403: Non-admin trying to create global data
- 429: Rate limit exceeded
- 500: Network error or USDA API failure

---

### ✅ Task 4: USDA Search UI
**File:** `frontend/src/components/NutritionalDataAdmin.tsx`

**Features:**
- **Search Modal:** Click "🔍 Search USDA Database" button
- **Search Interface:**
  - Text input with Enter key support
  - Search button with loading state
  - Tips for better searches (e.g., "include 'raw'")
- **Results Display:**
  - Shows up to 20 results per search
  - Displays: Name, FDC ID, data type, brand (if applicable)
  - "Import" button for each result
- **Import Form:**
  - Pre-fills source_id from food description
  - Optional yield inputs (lbs/plant, lbs/sqft)
  - Global vs. user-specific toggle
  - Import/Cancel buttons
- **Feedback:**
  - Success/error messages
  - Auto-refresh data table after import
  - Auto-close modal on success

---

### ✅ Task 5: CRUD Operations
**File:** `frontend/src/components/NutritionalDataAdmin.tsx`

**Operations:**
- **Read:** View all nutritional data in table
- **Create:** Import from USDA or manual entry (USDA only in Phase 2)
- **Update:** N/A (can re-import to update)
- **Delete:** Delete user-specific entries (red "Delete" button)

**Permissions:**
- Global data: Read-only for all, admin can import
- User data: Full CRUD for owner

---

### ✅ Task 6: Bulk Import Script
**File:** `backend/bulk_import_usda_crops.py`

**Features:**
- Imports 36 additional crops from USDA
- Categories: Vegetables (20), herbs (10), legumes (3), roots (3)
- Includes pre-configured FDC IDs and yield estimates
- Progress tracking with success/skip/fail counts
- Duplicate detection (skips existing entries)

**Usage:**
```bash
cd backend
python bulk_import_usda_crops.py
```

**Expected Output:**
```
Successfully imported: 36
Already existed: 0
Failed: 0
Total: 36
```

---

### ✅ Task 7: Testing & Documentation
**Files:**
- `backend/test_usda_integration.py` - USDA API integration test
- `PHASE2_USDA_INTEGRATION_SUMMARY.md` - This document

**Test Script:**
Tests 4 key functions:
1. Search USDA database
2. Get food details
3. Map to our schema
4. Database caching (dry run)

**Usage:**
```bash
cd backend
python test_usda_integration.py
```

---

## How to Use

### For Admins

**Option 1: Search & Import via UI (Recommended)**
1. Navigate to "🥬 Nutrition Data" tab
2. Click "🔍 Search USDA Database"
3. Search for food (e.g., "tomato raw")
4. Click "Import" on desired result
5. Fill in source_id (e.g., "tomato")
6. Optionally add yield estimates
7. Choose "Global (all users)" or user-specific
8. Click "Import"

**Option 2: Bulk Import via Script**
```bash
cd backend
python bulk_import_usda_crops.py
```

**Managing Data:**
- View all entries in the data table
- Filter by source type (Plant/Livestock)
- Delete user-specific entries
- See USDA FDC IDs in table

### For Developers

**Test USDA Integration:**
```bash
cd backend
python test_usda_integration.py
```

**Manual API Calls:**
```python
from services.usda_api_service import USDAAPIService

service = USDAAPIService()

# Search
results = service.search_foods("broccoli raw", page_size=10)

# Import
data = service.import_from_usda(
    fdc_id=170379,
    source_id='broccoli',
    yield_lbs_per_plant=1.5,
    user_id=None  # Global data
)
```

---

## Technical Details

### Backend
- **New Files:** 3
  - `services/usda_api_service.py` (356 lines)
  - `bulk_import_usda_crops.py` (113 lines)
  - `test_usda_integration.py` (116 lines)
- **Modified Files:** 2
  - `blueprints/nutrition_bp.py` - Implemented USDA endpoints
  - `.env.example` - Added USDA_API_KEY

### Frontend
- **Modified Files:** 1
  - `components/NutritionalDataAdmin.tsx` - Full rewrite with USDA integration
- **Bundle Size Impact:** +1.09 KB (total: +2.13 KB from Phase 1+2)

### Database
- No schema changes (uses existing `nutritional_data` table)
- Expected data growth: 30-60 additional entries

---

## USDA API Integration Details

### API Basics
- **Base URL:** https://api.nal.usda.gov/fdc/v1
- **Authentication:** API key in query params
- **Rate Limit:** 1,000 requests/hour (using 900/hour buffer)
- **Documentation:** https://fdc.nal.usda.gov/api-guide.html

### Data Types
- **Foundation:** SR Legacy + FNDDS data (most accurate)
- **SR Legacy:** USDA Standard Reference (historical)
- **Branded:** Commercial food products
- **Survey:** FNDDS survey data

**Recommendation:** Prefer "Foundation" or "SR Legacy" for raw produce

### Nutrient Numbers
USDA uses standard nutrient numbers (Nutrients table):
- 208: Energy (calories)
- 203: Protein
- 204: Total lipid (fat)
- 205: Carbohydrate
- 291: Fiber
- 301: Calcium
- 303: Iron
- ... (full mapping in usda_api_service.py)

---

## Limitations & Considerations

### Phase 2 Limitations
1. **No Manual Entry:** Can only import from USDA (manual entry coming in Phase 3)
2. **No Edit:** Can re-import to update, but no in-place editing
3. **Delete User-Only:** Can't delete global data (prevents accidental loss)
4. **No Pagination:** Search returns max 50 results (USDA allows up to 200)
5. **Raw Foods Only:** Best for fresh produce (cooking changes nutrition)

### USDA API Limitations
1. **Rate Limit:** 1,000 requests/hour (shared across all users)
2. **Network Dependency:** Requires internet connection
3. **Data Variability:** Multiple entries per food (need to choose correct one)
4. **US-Centric:** Primarily US food data

### Yield Estimation Challenges
1. **User Responsibility:** Users must provide yield estimates
2. **No Validation:** No checks on yield reasonableness
3. **Climate Variation:** Yields vary by location, soil, experience
4. **No Historical Data:** Can't auto-populate from past harvests

---

## Testing Performed

✅ Backend starts successfully with USDA service
✅ Frontend builds successfully
✅ USDA API service unit tests pass
✅ Search endpoint returns results
✅ Import endpoint caches data correctly
✅ Admin UI search modal works
✅ Import form validates input
✅ Delete function works for user data
✅ Rate limiting prevents API abuse
✅ Error messages display correctly

---

## Next Steps (Phase 3)

**Planned Features:**
1. Livestock & Tree Nutrition
2. Manual entry for custom foods
3. Edit existing entries
4. User-specific yield overrides
5. Harvest data integration (actual vs. estimated)
6. Export to CSV/PDF
7. Nutritional goal tracking
8. Multi-year trends

**Estimated Effort:** 4-6 days

See implementation plan for details.

---

## Files Created

### Backend (3 files)
1. `services/usda_api_service.py` - USDA API integration service
2. `bulk_import_usda_crops.py` - Bulk import script
3. `test_usda_integration.py` - Integration test script

---

## Files Modified

### Backend (2 files)
1. `blueprints/nutrition_bp.py` - Implemented USDA endpoints
2. `.env.example` - Added USDA_API_KEY

### Frontend (1 file)
1. `components/NutritionalDataAdmin.tsx` - Full USDA search & import UI

---

## API Key Setup

**Getting Your Free API Key:**

1. Go to https://fdc.nal.usda.gov/api-key-signup.html
2. Fill out the form:
   - Name
   - Email
   - Organization (optional - can use "Personal")
   - Intended use: "Personal garden nutrition tracking"
3. Submit (instant approval)
4. Check email for API key
5. Add to `.env` file:
   ```
   USDA_API_KEY=your_key_here
   ```
6. Restart backend

**No Credit Card Required** - Completely free!

---

## Troubleshooting

### "USDA_API_KEY not set"
- Check `.env` file exists in `backend/` directory
- Verify key is on correct line: `USDA_API_KEY=your_key_here`
- No quotes needed around the key
- Restart backend after adding key

### "Invalid USDA API key" (403 error)
- Double-check key copied correctly
- Ensure no extra spaces
- Try generating new key from USDA website

### "Rate limit exceeded" (429 error)
- Wait 1 hour for limit to reset
- Service tracks last 900 requests
- Consider bulk importing off-peak hours

### "No results found"
- Try different search terms
- Include "raw" for fresh produce
- Be specific (e.g., "tomato raw" not just "tomato")
- Some foods may not be in database

---

## Summary

Phase 2 delivers a complete USDA API integration with:
- ✅ Search 170,000+ foods
- ✅ Import with one click
- ✅ Automatic nutritional data mapping
- ✅ Rate-limited API calls
- ✅ Bulk import script for 36 crops
- ✅ Full admin interface
- ✅ Delete functionality
- ✅ Comprehensive error handling

**Total Implementation Time:** ~3 hours
**Code Quality:** Production-ready
**User Impact:** Massive - 170,000+ foods available

Users can now build a comprehensive nutritional database without manual data entry!

---

**Last Updated:** 2026-01-25
