# Property Dimensions Auto-Fill - Research Findings

**Research Date**: 2025-11-12
**Question**: Can we automatically get property width and length from address validation?
**Answer**: Yes, partially - possible for U.S./Canada using parcel data APIs

---

## Executive Summary

Property dimensions CAN be automatically retrieved from validated addresses using parcel data APIs like Regrid. However, this feature has important limitations and costs that should be considered before implementation.

**Recommendation**: Implement as opt-in feature (not automatic) to control costs and maintain manual entry as primary method.

---

## Current Implementation Analysis

### Address Validation (Existing)

**Service**: Geocodio (default) or Google Maps Geocoding API
**Configuration**: `GEOCODING_PROVIDER` environment variable
**Endpoint**: `POST /api/properties/validate-address`

**Files**:
- Backend: `backend/app.py` (lines 841-878)
- Service: `backend/services/geocoding_service.py`
- Frontend: `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx` (lines 171-226)

**Current Data Returned**:
- ✅ `formatted_address` - Standardized address string
- ✅ `latitude` - Geographic coordinate
- ✅ `longitude` - Geographic coordinate
- ✅ `zone` - USDA hardiness zone (calculated from lat/long)
- ✅ `accuracy` - Geocoding accuracy metric
- ❌ Property dimensions (width × length) - NOT AVAILABLE
- ❌ Lot size (sq ft or acres) - NOT AVAILABLE
- ❌ Parcel boundaries - NOT AVAILABLE

### Property Model (Existing)

**File**: `backend/models.py` (lines 273-306)

**Current Fields**:
- `width` (Float, required) - Stored in feet, **manually entered**
- `length` (Float, required) - Stored in feet, **manually entered**
- `address` (String, optional)
- `latitude` (Float, optional)
- `longitude` (Float, optional)

---

## API Options Evaluated

### Summary Comparison Table

| API | Cost | Coverage | Has Dimensions | Recommendation |
|-----|------|----------|----------------|----------------|
| **Regrid** | $0.001/req | 100% U.S. | Polygon boundaries | ⭐⭐⭐⭐☆ **BEST** |
| Estated | $179/mo min | U.S. | Polygon boundaries | ⭐⭐⭐☆☆ Too expensive |
| ATTOM | Enterprise | U.S. | Maybe | ⭐⭐⭐☆☆ Overkill |
| Geocodio | Free tier | U.S./Canada | ❌ No | ⭐⭐☆☆☆ Already using |
| Google Maps | Free tier | Global | ❌ No | ⭐⭐☆☆☆ Already using |
| County GIS | Free | County-by-county | Varies | ⭐☆☆☆☆ Not practical |

---

## Option 1: Regrid Parcel API (RECOMMENDED)

### Overview
- **Provider**: Regrid (https://regrid.com/)
- **Formerly**: Loveland Parcel Data
- **Specialization**: Nationwide parcel and property boundary data

### Pricing
- **Free Trial**: 1 week
- **Per-Request**: $0.001 per API call
- **Monthly Examples**:
  - 100 lookups: $0.10/month
  - 1,000 lookups: $1.00/month
  - 10,000 lookups: $10.00/month
- **Bulk Data**: Starts at $80K/year (not relevant for API use)

### Coverage
- **Parcels**: 149+ million
- **U.S. Coverage**: 100%
- **Population**: 99% of U.S. population covered
- **Canada**: Available
- **International**: Not available

### Data Available
- ✅ **Parcel boundaries**: Full GIS polygon with corner coordinates
- ✅ **Lot size**: Square footage and acres
- ⚠️ **Lot dimensions**: Not direct width×length, but calculable from boundaries
- ✅ **Property ownership**: Owner names and transfer dates
- ✅ **Land use/zoning**: Residential, agricultural, commercial, etc.
- ✅ **Tax assessment**: Assessed values and tax data
- ✅ **Legal description**: Lot/block, subdivision info

### Data Format
- GeoJSON (recommended for web apps)
- Shapefile
- GeoPackage
- CSV
- SQL
- Parquet

### API Complexity
**Medium** - Requires geometric processing

**Why Medium**:
- RESTful API is well-documented
- Returns polygon boundaries, not simple dimensions
- Need to parse GeoJSON and calculate width/length
- Geometric calculations required for bounding box

**Example Response** (simplified):
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [-122.4194, 37.7749],
      [-122.4184, 37.7749],
      [-122.4184, 37.7739],
      [-122.4194, 37.7739],
      [-122.4194, 37.7749]
    ]]
  },
  "properties": {
    "parcelnumb": "123-456-789",
    "address": "123 Main St",
    "ll_gisacre": 0.25,
    "ll_gissqft": 10890,
    "owner": "John Smith",
    "zoning": "RES",
    "usedesc": "Single Family Residential"
  }
}
```

### Calculating Dimensions

**From Polygon Boundaries**:

1. **Bounding Box Method** (Simple):
   - Calculate min/max latitude and longitude
   - Width = (max_lon - min_lon) × conversion_factor
   - Length = (max_lat - min_lat) × conversion_factor
   - Pros: Simple, works for all shapes
   - Cons: Overestimates for non-rectangular parcels

2. **Maximum Distance Method** (Accurate):
   - Calculate distances between all pairs of corner points
   - Find longest dimension (length)
   - Find perpendicular longest dimension (width)
   - Pros: More accurate for rectangles
   - Cons: Complex calculation, assumes rectangular orientation

3. **Area-Based Method** (Estimate):
   - Get area from API (already provided)
   - Estimate dimensions assuming rectangle
   - Width = √(area / aspect_ratio)
   - Length = area / width
   - Pros: Simple when area is known
   - Cons: Assumes rectangular shape

**Recommendation**: Use Bounding Box method with caveat note for irregular parcels

### Rate Limits
- Based on subscription tier
- No hard limits on API-based billing
- $0.001 per request automatically charged

### Documentation
- Website: https://regrid.com/
- API Docs: https://regrid.com/api
- Support: Active community and customer support

### Pros
✅ Comprehensive U.S. coverage (100%)
✅ Affordable per-request pricing
✅ Parcel boundaries included
✅ Free trial to test before committing
✅ Well-documented API
✅ Returns lot size (acres/sq ft)
✅ Additional useful data (zoning, land use)

### Cons
⚠️ Returns polygons, not simple width×length
⚠️ Requires geometric calculations
⚠️ Rural properties may not be rectangular
⚠️ No free tier (beyond 1-week trial)
⚠️ U.S./Canada only (no international)

### Recommendation
⭐⭐⭐⭐☆ (4/5) - **Best option for this use case**

**Why**: Balances cost, coverage, and data quality. Affordable for indie/hobby projects with opt-in usage pattern.

---

## Option 2: Estated (ATTOM Acquisition)

### Overview
- **Provider**: Estated (now owned by ATTOM Data Solutions)
- **Website**: https://estated.com/
- **Specialization**: Property data and analytics

### Pricing
- **Free Tier**: None (100 free calls upon registration only)
- **Startup Plan**: $179/month
- **Growth Plan**: Custom pricing
- **Enterprise**: Contact sales

### Coverage
- **Properties**: 155+ million U.S. properties
- **Historical Data**: 40+ years
- **Geographic**: U.S. only

### Data Available
- ✅ Lot size (square footage/acres)
- ✅ Parcel boundary coordinates (corner points)
- ⚠️ Lot dimensions (must be calculated)
- ✅ Property characteristics (150+ data points)
- ✅ Sales history
- ✅ Ownership records
- ✅ Tax assessment
- ✅ Building characteristics

### API Complexity
**Medium** - Similar to Regrid

Returns boundary coordinates that require geometric calculations.

### Pros
✅ Rich property data (150+ fields)
✅ Includes boundary coordinates
✅ Comprehensive historical data
✅ Well-documented API

### Cons
❌ No free tier (only 100 trial calls)
❌ Expensive ($179/month minimum)
❌ Requires geometric calculations
❌ Overkill if only need dimensions

### Recommendation
⭐⭐⭐☆☆ (3/5) - **Too expensive for this specific feature**

**Why**: Good service, but $2,148/year is steep when Regrid offers similar data for $10-100/year with pay-per-use.

---

## Option 3: ATTOM Data Solutions

### Overview
- **Provider**: ATTOM Data Solutions
- **Website**: https://www.attomdata.com/
- **Specialization**: Enterprise property data

### Pricing
- **Free Trial**: 30 days
- **Pricing**: Contact sales (not publicly listed)
- **Estimated**: $500+/month

### Coverage
- **Properties**: 150+ million U.S. properties
- **Data**: Nationwide assessments, tax, valuations

### Data Available
- ✅ Lot size (square footage/acres)
- ⚠️ Lot dimensions (not clearly documented)
- ✅ Property characteristics
- ✅ Sales data
- ✅ Ownership
- ✅ Building permits

### API Complexity
**Medium** - Well-documented REST API

### Pros
✅ 30-day free trial
✅ Comprehensive property data
✅ Trusted enterprise provider
✅ Well-documented

### Cons
❌ Enterprise pricing (likely $500+/month)
❌ Must contact sales
❌ Unclear if provides simple dimensions
❌ Overkill for single feature

### Recommendation
⭐⭐⭐☆☆ (3/5) - **Good but expensive**

**Why**: Excellent for enterprise applications needing comprehensive data, but overkill and likely too expensive for adding dimension auto-fill feature.

---

## Option 4: Geocodio (Current Service)

### Overview
- **Provider**: Geocodio
- **Website**: https://www.geocod.io/
- **Current Use**: Already integrated for address validation

### Pricing
- **Free Tier**: 2,500 requests/day
- **Paid Plans**: Available for higher volume

### Coverage
- U.S. and Canada

### Data Available
- ✅ Geocoding (address → coordinates)
- ✅ Census data appends
- ✅ Electoral districts
- ❌ **Lot dimensions** - NOT AVAILABLE
- ❌ **Lot size** - NOT AVAILABLE
- ❌ **Parcel boundaries** - NOT AVAILABLE

### API Complexity
**Easy** - Already integrated

### Recommendation
⭐⭐☆☆☆ (2/5) for property dimensions

**Why**: Great for geocoding (already using it), but doesn't provide parcel/property dimension data at all.

---

## Option 5: Google Maps APIs

### Overview
- **Provider**: Google
- **Services**: Places API, Geocoding API, Maps JavaScript API

### Pricing
- **Free Tier**: 10,000 requests/month
- **Paid**: $0.005 per request after free tier

### Coverage
- Global

### Data Available
- ✅ Geocoding
- ✅ Place details
- ✅ Street view
- ❌ **Parcel boundaries** - NOT AVAILABLE
- ❌ **Lot dimensions** - NOT AVAILABLE
- ❌ **Lot size** - NOT AVAILABLE

### API Complexity
**Easy** - Similar to Geocodio

### Recommendation
⭐⭐☆☆☆ (2/5) for property dimensions

**Why**: Excellent mapping service, but doesn't provide parcel or property dimension data.

---

## Option 6: County/Municipal GIS APIs

### Overview
- **Provider**: Individual county assessor offices
- **Examples**:
  - Pima County, AZ: https://gisopendata.pima.gov/
  - King County, WA: https://gis-kingcounty.opendata.arcgis.com/
  - Many others via Data.gov

### Pricing
- **Free** (most counties)
- Some charge small fees

### Coverage
- County-by-county basis
- 3,000+ counties in U.S.
- Quality varies widely

### Data Available
- ✅ Parcel boundaries (where available)
- ✅ Lot size (where available)
- ⚠️ Lot dimensions (varies)
- ✅ Tax assessment
- ✅ Ownership

### API Complexity
**Very High** - No standardization

**Challenges**:
- Each county has different API/format
- Some have APIs, others only provide file downloads
- Would need to integrate 3,000+ different sources
- Data formats vary (Shapefile, GeoJSON, CSV, etc.)
- Update frequencies vary
- Some counties have no digital data

### Pros
✅ Authoritative source
✅ Free
✅ Detailed local data

### Cons
❌ Not standardized
❌ Massive integration effort
❌ Many counties lack APIs
❌ Inconsistent coverage
❌ No single point of access

### Recommendation
⭐☆☆☆☆ (1/5) for production app

**Why**: Great for local government apps focused on one county, but impractical for nationwide coverage in an indie app.

---

## Technical Feasibility Analysis

### Implementation Complexity

**Easy** ✅:
- Regrid API integration (RESTful, documented)
- Adding "Get Dimensions" button to UI
- Auto-populating width/length fields

**Medium** ⚠️:
- Geometric calculations (bounding box from polygon)
- Handling irregular parcel shapes
- Error handling for properties not found

**Hard** ❌:
- Supporting 3,000+ county APIs (not recommended)
- Determining actual usable area vs legal boundaries
- International coverage

### Integration Points

**Backend Changes**:
1. **New Service**: `backend/services/parcel_service.py`
   - Class: `ParcelService`
   - Method: `get_parcel_dimensions(latitude, longitude)`
   - Returns: `{ width_ft, length_ft, area_sqft, confidence }`

2. **New Endpoint**: `backend/app.py`
   - Route: `POST /api/properties/get-dimensions`
   - Input: `{ latitude, longitude }`
   - Output: `{ width, length, area, confidence, source }`

3. **Environment Variable**:
   - Add: `REGRID_API_KEY` to `.env`

**Frontend Changes**:
1. **UI Button**: `PropertyFormModal.tsx`
   - Add button after address validation success
   - Text: "Get Property Dimensions from Public Records"
   - Show loading spinner during API call

2. **Auto-Fill Logic**:
   - On success: Populate `width` and `length` fields
   - Show confidence indicator
   - Display source: "Estimated from public parcel data"
   - Always allow user to edit

3. **Error Handling**:
   - Not found: "Property dimensions not available"
   - API error: Graceful fallback to manual entry

### Estimated Implementation Time

| Task | Hours | Notes |
|------|-------|-------|
| Research & Setup | 1-2 | Sign up, API key, test in Postman |
| Backend Service | 2-3 | Regrid API integration, geometry calculations |
| Backend Endpoint | 1 | New route, error handling |
| Frontend Button | 1 | UI component, loading states |
| Frontend Auto-fill | 1 | Populate fields, validation |
| Testing | 2 | Various property types, edge cases |
| Documentation | 0.5 | Environment variable, README updates |
| **Total** | **8.5-10.5** | **Mid-range: 10 hours** |

---

## Challenges & Limitations

### 1. Irregular Property Shapes

**Problem**: Most properties aren't perfect rectangles
- L-shaped lots
- Triangular corner lots
- Pie-shaped cul-de-sac lots
- Irregular rural parcels

**Impact**: Width × length may not accurately represent usable area

**Solution**:
- Calculate bounding box dimensions
- Show caveat: "Dimensions are estimates for irregular parcels"
- Display actual lot size in acres/sqft alongside width×length

### 2. Data Accuracy

**Problem**: Parcel data may not match reality
- Boundaries may include easements
- Setbacks reduce usable area
- Right-of-way portions may be included
- Data may be months/years old

**Solution**:
- Add disclaimer: "Dimensions from public records - verify before use"
- Show confidence level
- Always allow manual override

### 3. Homesteader Context

**Problem**: Homesteaders often have better information
- May have actual survey data
- Know exact usable boundaries
- Understand setbacks and restrictions

**Solution**:
- Make auto-fill optional (button, not automatic)
- Treat as suggestion, not definitive
- Manual entry remains primary method

### 4. API Costs

**Problem**: Per-request pricing adds up
- $0.001 seems cheap but scales with usage
- Free trial only lasts 1 week
- No free tier

**Solution**:
- Opt-in button (not automatic on every address)
- Most users only create 1-5 properties
- Cost is minimal for typical usage ($0.01 per user)

### 5. International Coverage

**Problem**: Regrid only covers U.S. and Canada
- No data for international addresses
- Homesteaders exist worldwide

**Solution**:
- Detect country from address
- Only show button for U.S./Canada addresses
- Always provide manual entry option

### 6. Rectangular Assumption

**Problem**: Width × length assumes rectangular shape
- Many parcels are not rectangular
- Area calculation (width × length) may not match actual area

**Solution**:
- Also display actual area from API
- Note when dimensions are "bounding box" estimates
- Consider showing shape type (rectangular, irregular, etc.)

---

## Recommended Implementation

### Phase 1: Opt-In MVP

**Strategy**: Add as optional convenience feature, not core functionality

#### User Experience Flow

```
1. User enters address: "123 Farm Road, Smalltown, KS"

2. User clicks "Validate Address"
   → API call to Geocodio/Google
   → Returns: formatted address, lat/long, zone
   → Zone auto-filled in form

3. NEW: Button appears below address field
   → Text: "Get Property Dimensions from Public Records"
   → Icon: 📏 or 🗺️
   → Helper text: "Automatically fill width and length (U.S./Canada only)"

4. User clicks "Get Property Dimensions" (optional)
   → Loading spinner: "Fetching property data..."
   → API call to Regrid with lat/long

5a. SUCCESS PATH:
    → Width field auto-filled: 500 (ft)
    → Length field auto-filled: 800 (ft)
    → Show message: "Property dimensions estimated from public records"
    → Show confidence: "Confidence: High" or "Confidence: Estimated (irregular parcel)"
    → User can edit values

5b. NOT FOUND PATH:
    → Show message: "Property dimensions not available for this address"
    → Helper text: "Please enter dimensions manually"
    → Width/length fields remain empty for manual entry

5c. ERROR PATH:
    → Show message: "Unable to fetch property data"
    → Fallback to manual entry
    → Log error for debugging
```

#### Why Opt-In?

✅ **Cost Control**: Only charges when user explicitly requests
✅ **User Choice**: User knows their property best
✅ **No Blocking**: Property creation works without it
✅ **Clear Value**: User understands what the feature does
✅ **International**: Doesn't confuse international users

#### Backend Implementation

**File**: `backend/services/parcel_service.py` (NEW)

```python
import os
import requests
from typing import Dict, Optional

class ParcelService:
    def __init__(self):
        self.api_key = os.getenv('REGRID_API_KEY')
        self.base_url = 'https://app.regrid.com/api/v1'

    def get_parcel_dimensions(self, latitude: float, longitude: float) -> Dict:
        """
        Fetch parcel dimensions from Regrid API.

        Args:
            latitude: Property latitude
            longitude: Property longitude

        Returns:
            {
                'width_ft': float,
                'length_ft': float,
                'area_sqft': float,
                'area_acres': float,
                'confidence': 'high' | 'medium' | 'low',
                'shape_type': 'rectangular' | 'irregular',
                'source': 'Regrid'
            }
        """
        if not self.api_key:
            raise ValueError("REGRID_API_KEY not configured")

        # Call Regrid API
        headers = {'Authorization': f'Bearer {self.api_key}'}
        response = requests.get(
            f'{self.base_url}/parcels',
            params={'lat': latitude, 'lon': longitude},
            headers=headers,
            timeout=10
        )

        if response.status_code == 404:
            return None  # Parcel not found

        response.raise_for_status()
        data = response.json()

        # Extract parcel boundary
        geometry = data['geometry']['coordinates'][0]  # Polygon exterior ring

        # Calculate bounding box dimensions
        lons = [point[0] for point in geometry]
        lats = [point[1] for point in geometry]

        min_lon, max_lon = min(lons), max(lons)
        min_lat, max_lat = min(lats), max(lats)

        # Convert to feet (approximate)
        # 1 degree latitude ≈ 364,000 feet
        # 1 degree longitude ≈ 288,200 feet (at 40° latitude)
        width_ft = (max_lon - min_lon) * 288200
        length_ft = (max_lat - min_lat) * 364000

        # Get area from API
        area_sqft = data['properties'].get('ll_gissqft', 0)
        area_acres = data['properties'].get('ll_gisacre', 0)

        # Determine confidence based on shape
        shape_regularity = self._assess_shape_regularity(geometry)

        return {
            'width_ft': round(width_ft, 1),
            'length_ft': round(length_ft, 1),
            'area_sqft': area_sqft,
            'area_acres': round(area_acres, 2),
            'confidence': shape_regularity['confidence'],
            'shape_type': shape_regularity['type'],
            'source': 'Regrid Parcel Data'
        }

    def _assess_shape_regularity(self, geometry):
        """
        Assess if parcel is rectangular or irregular.
        Returns confidence and shape type.
        """
        # Simple heuristic: check if polygon has 4-5 points (rectangular)
        num_points = len(geometry)

        if num_points <= 5:  # Rectangle (4 corners + closing point)
            return {'confidence': 'high', 'type': 'rectangular'}
        elif num_points <= 8:
            return {'confidence': 'medium', 'type': 'mostly_rectangular'}
        else:
            return {'confidence': 'low', 'type': 'irregular'}
```

**File**: `backend/app.py` (MODIFY)

```python
from services.parcel_service import ParcelService

# ... existing code ...

@app.route('/api/properties/get-dimensions', methods=['POST'])
def get_property_dimensions():
    """
    Fetch property dimensions from parcel data API.

    Request body:
    {
        "latitude": 37.7749,
        "longitude": -122.4194
    }

    Response:
    {
        "width": 500.0,
        "length": 800.0,
        "area_sqft": 400000,
        "area_acres": 9.18,
        "confidence": "high",
        "shape_type": "rectangular",
        "source": "Regrid Parcel Data"
    }
    """
    try:
        data = request.get_json()
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if not latitude or not longitude:
            return jsonify({'error': 'Latitude and longitude required'}), 400

        parcel_service = ParcelService()
        dimensions = parcel_service.get_parcel_dimensions(latitude, longitude)

        if not dimensions:
            return jsonify({'error': 'Property dimensions not found'}), 404

        return jsonify(dimensions), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 500
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timed out'}), 504
    except Exception as e:
        app.logger.error(f"Error fetching dimensions: {e}")
        return jsonify({'error': 'Failed to fetch property dimensions'}), 500
```

#### Frontend Implementation

**File**: `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx` (MODIFY)

Add after address validation success:

```typescript
const [dimensionsLoading, setDimensionsLoading] = useState(false);
const [dimensionsError, setDimensionsError] = useState<string | null>(null);

const handleGetDimensions = async () => {
  if (!formData.latitude || !formData.longitude) {
    showError('Please validate address first');
    return;
  }

  setDimensionsLoading(true);
  setDimensionsError(null);

  try {
    const response = await fetch(`${API_BASE_URL}/api/properties/get-dimensions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: formData.latitude,
        longitude: formData.longitude
      })
    });

    if (response.status === 404) {
      setDimensionsError('Property dimensions not available for this address');
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch dimensions');
    }

    const data = await response.json();

    // Auto-fill width and length
    handleChange('width', data.width_ft);
    handleChange('length', data.length_ft);

    // Show success message with confidence
    showSuccess(
      `Property dimensions auto-filled! (${data.confidence} confidence, ${data.shape_type} parcel)`
    );

  } catch (error) {
    console.error('Error fetching dimensions:', error);
    setDimensionsError('Unable to fetch property data. Please enter manually.');
  } finally {
    setDimensionsLoading(false);
  }
};
```

UI Addition (after address validation section):

```tsx
{addressValidation.validated && (
  <div className="mt-2">
    <button
      type="button"
      onClick={handleGetDimensions}
      disabled={dimensionsLoading}
      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
    >
      {dimensionsLoading ? (
        <>
          <span className="animate-spin">⏳</span>
          <span>Fetching property dimensions...</span>
        </>
      ) : (
        <>
          <span>📏</span>
          <span>Get Property Dimensions from Public Records</span>
        </>
      )}
    </button>

    {dimensionsError && (
      <p className="text-xs text-gray-500 mt-1">{dimensionsError}</p>
    )}

    <p className="text-xs text-gray-500 mt-1">
      U.S. and Canada only. Dimensions are estimates - you can edit them.
    </p>
  </div>
)}
```

#### Environment Configuration

**File**: `backend/.env` (ADD)

```bash
# Regrid API Configuration (optional)
# Sign up at https://regrid.com/
# Free 1-week trial, then $0.001 per request
REGRID_API_KEY=your_api_key_here
```

**File**: `backend/.env.example` (UPDATE)

```bash
# ... existing variables ...

# Optional: Regrid API for property dimensions lookup
# Leave blank to disable automatic property dimension fetching
# REGRID_API_KEY=
```

---

## Cost Projection

### Realistic Usage Scenarios

**Scenario 1: Hobby Homesteader (1 user)**
- Creates: 1 property
- API Calls: 1
- Monthly Cost: $0.001
- Annual Cost: $0.001

**Scenario 2: Small Community (100 users)**
- Creates: 2 properties each (average)
- API Calls: 200
- Monthly Cost: $0.20 (if all in one month)
- Annual Cost: $0.20 (one-time setup)

**Scenario 3: Growing App (1,000 users)**
- Creates: 2 properties each (average)
- API Calls: 2,000
- Monthly Cost: $2 (if all in one month)
- Annual Cost: $2-5 (spread over year)

**Scenario 4: Popular App (10,000 users)**
- Creates: 2-3 properties each (average)
- API Calls: 25,000
- Monthly Cost: $25 (if all in one month)
- Annual Cost: $25-50 (spread over year)

### Cost Comparison

| Service | 100 Calls | 1,000 Calls | 10,000 Calls |
|---------|-----------|-------------|--------------|
| **Regrid** | $0.10 | $1.00 | $10.00 |
| Estated | $179.00 | $179.00 | $179.00 |
| ATTOM | ~$500.00 | ~$500.00 | ~$500.00 |
| County APIs | Free | Free | Free* |

*Requires massive integration effort - not practical

### Budget Recommendations

- **$0 Budget**: Skip this feature, keep manual entry
- **< $10/month**: Implement with Regrid, sufficient for most indie apps
- **$10-50/month**: Regrid is perfect
- **$100+/month**: Consider Estated or ATTOM for additional data beyond dimensions

---

## Alternative Approaches

### Option A: Manual Entry Only (Current)

**Pros**:
- ✅ Free
- ✅ Works for all properties worldwide
- ✅ User knows their property best
- ✅ No API dependencies

**Cons**:
- ⏱️ Takes user time to look up dimensions
- 📊 User may not know exact dimensions
- 🌍 Requires user to have survey data or county records

**Verdict**: Keep as fallback/default

---

### Option B: Link to County Assessor

Instead of API integration, provide helpful links:

```
"Don't know your property dimensions?
Find your parcel on your county assessor's website:
[Link to local GIS based on state/county from address]"
```

**Pros**:
- ✅ Free
- ✅ No API integration
- ✅ Points user to authoritative source

**Cons**:
- ⏱️ Requires user to navigate another website
- 🔗 Links may break as counties update websites
- 📍 User must manually find their parcel

**Verdict**: Could complement API approach

---

### Option C: Crowdsourced Data

Allow users to share property dimensions:

**Implementation**:
- After user enters dimensions, offer: "Help others! Share this property's dimensions?"
- Store: address hash → dimensions (anonymized)
- Future users validating same address get suggested dimensions

**Pros**:
- ✅ Free
- ✅ Builds community dataset
- ✅ Improves over time

**Cons**:
- ❌ Privacy concerns
- ❌ Data accuracy issues
- ❌ Slow cold start (no data initially)
- ❌ Potential for abuse

**Verdict**: Interesting but complex, defer to much later

---

## Decision Matrix

### Implement Now?

**YES if**:
- [ ] Budget allows $10-50/month for API costs
- [ ] Primarily serving U.S./Canadian users
- [ ] Users frequently don't know property dimensions
- [ ] Development bandwidth available (10 hours)

**NO if**:
- [x] Strictly $0 budget
- [ ] Primarily international user base
- [x] Users typically know their dimensions (homesteaders often do)
- [x] Higher priority features waiting

**CURRENT DECISION**: **NO - Defer to future**

---

## When to Revisit

### Triggers to Reconsider

1. **User Requests**: 10+ users request this feature
2. **Budget Available**: Monthly hosting budget allows $10-20 for APIs
3. **Core Complete**: All critical features implemented and stable
4. **Geographic Data**: If adding other location-based features (weather, etc.)
5. **Professional Version**: If creating paid tier, this could be a premium feature

### Success Metrics (If Implemented)

Track these to evaluate ROI:
- **Usage Rate**: % of users who click "Get Dimensions" button
- **Success Rate**: % of attempts that find dimensions
- **Edit Rate**: % of auto-filled dimensions users manually edit
- **Cost**: Actual monthly API costs
- **Feedback**: User satisfaction with auto-filled vs manual entry

---

## Conclusion

**Is it possible?** Yes, absolutely.

**Is it practical?** Yes, with Regrid API and opt-in approach.

**Should we do it now?** No, defer to future when budget and bandwidth allow.

**What's the path forward?** Document thoroughly (done!), revisit in 3-6 months.

---

**Research Completed**: 2025-11-12
**Next Review**: 2025-Q2 or when budget/priorities shift
**Status**: Documented for future implementation
