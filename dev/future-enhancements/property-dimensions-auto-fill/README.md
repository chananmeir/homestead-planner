# Property Dimensions Auto-Fill - Future Enhancement

## Status

📋 **FUTURE ENHANCEMENT** - Researched, Not Prioritized
**Created**: 2025-11-12
**Priority**: Low-Medium
**Estimated Effort**: 8-10 hours

---

## Overview

Automatically retrieve property dimensions (width × length) from address validation using parcel data APIs.

## Quick Summary

**Question**: Can we automatically get property width and length after validating an address?

**Answer**: Yes, for U.S./Canadian properties using Regrid Parcel API.

**Cost**: $0.001 per lookup ($1 per 1,000 properties)

**Recommendation**: Implement as opt-in feature with "Get Property Dimensions" button

---

## Why This Is Deferred

✅ **Researched thoroughly** - All technical details documented
⏸️ **Not critical** - Manual entry works fine for users
💰 **Small cost** - But adds complexity
🌍 **Limited coverage** - U.S./Canada only
🏗️ **Estimates only** - Many properties aren't rectangular

**Decision**: Save for Phase 2 after core features are stable

---

## Files in This Directory

1. **README.md** (this file) - Quick overview
2. **research-findings.md** - Complete feasibility research
3. **implementation-guide.md** - Step-by-step implementation plan

---

## When to Revisit

Consider implementing when:
- [ ] Users specifically request this feature
- [ ] Budget allows for API costs ($10-20/month)
- [ ] Core property management features are complete
- [ ] Development bandwidth available (8-10 hours)

---

## Quick Facts

| Aspect | Details |
|--------|---------|
| **Best API** | Regrid Parcel API |
| **Coverage** | 149M+ U.S. properties (100%) |
| **Cost** | $0.001 per request |
| **Data Format** | Polygon boundaries (GeoJSON) |
| **Dimensions** | Calculated from bounding box |
| **Accuracy** | Estimates for irregular parcels |
| **Implementation** | 8-10 hours |

---

## Current State

**What Works Now**:
- Address validation (Geocodio/Google Maps)
- Returns: formatted address, lat/long, USDA zone
- Manual width/length entry

**What This Would Add**:
- "Get Property Dimensions" button after validation
- Auto-populate width/length from public records
- Show confidence level and source
- User can always override

---

## Next Steps (When Ready to Implement)

1. Read `implementation-guide.md` for detailed plan
2. Sign up for Regrid API (free 1-week trial)
3. Test API with sample addresses
4. Implement backend parcel service
5. Add frontend button and auto-fill logic
6. Test with various property types
7. Deploy with `REGRID_API_KEY` environment variable

---

**Reference**: See `research-findings.md` for complete analysis

**Last Updated**: 2025-11-12
