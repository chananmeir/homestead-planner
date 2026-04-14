# USDA API Integration - Quick Start Guide

**5-Minute Setup for Nutritional Data Import**

---

## Step 1: Get Your Free USDA API Key (2 minutes)

1. Visit: https://fdc.nal.usda.gov/api-key-signup.html
2. Fill out the short form:
   - **Name:** Your name
   - **Email:** Your email address
   - **Organization:** "Personal" or leave blank
   - **Intended Use:** "Garden nutrition tracking"
3. Click "Submit"
4. Check your email for the API key (arrives instantly)

**✅ No credit card required - completely free!**

---

## Step 2: Add API Key to Backend (1 minute)

1. Navigate to `backend/` directory
2. Create `.env` file (if it doesn't exist):
   ```bash
   cp .env.example .env
   ```
3. Open `.env` file in a text editor
4. Find the line: `USDA_API_KEY=your_usda_api_key_here`
5. Replace with your actual key:
   ```
   USDA_API_KEY=AbCdEf1234567890
   ```
6. Save the file

---

## Step 3: Restart Backend (30 seconds)

```bash
cd backend
python app.py
```

Wait for: `[OK] Registered 16 blueprints`

---

## Step 4: Test the Integration (1 minute)

**Option A: Run Test Script**
```bash
cd backend
python test_usda_integration.py
```

Should see:
```
[OK] USDA API key found: AbCdEf12...
[OK] Search successful!
[OK] Retrieved food details!
[OK] Mapping successful!
[OK] All Tests Passed!
```

**Option B: Use the UI**
1. Login to frontend as admin
2. Navigate to "🥬 Nutrition Data" tab
3. Click "🔍 Search USDA Database"
4. Search for "tomato raw"
5. You should see results!

---

## Step 5: Import Data (30 seconds)

**Option A: Bulk Import (Recommended)**
```bash
cd backend
python bulk_import_usda_crops.py
```

This imports 36 additional crops automatically.

**Option B: Search & Import via UI**
1. In "Nutrition Data" tab, click "🔍 Search USDA Database"
2. Search for food (e.g., "broccoli raw")
3. Click "Import" on desired result
4. Fill in source_id (e.g., "broccoli")
5. Add yield estimate (optional, e.g., 1.5 lbs/plant)
6. Click "Import"

---

## Troubleshooting

### Error: "USDA_API_KEY not set"
- **Fix:** Make sure `.env` file is in `backend/` directory
- **Fix:** Restart backend after adding key

### Error: "Invalid USDA API key" (403)
- **Fix:** Double-check key was copied correctly (no spaces)
- **Fix:** Try generating a new key

### Error: "Rate limit exceeded" (429)
- **Cause:** More than 1,000 requests in 1 hour
- **Fix:** Wait 1 hour, then try again

### No results found when searching
- **Tip:** Include "raw" in search (e.g., "carrot raw")
- **Tip:** Be specific (e.g., "kale raw" not just "kale")
- **Tip:** Try different terms (e.g., "bell pepper" vs "pepper")

---

## What You Can Do Now

✅ Search 170,000+ foods in USDA database
✅ Import nutritional data with one click
✅ Add custom yield estimates
✅ Create global (all users) or personal data
✅ Delete user-specific entries
✅ View complete nutrition panel (15 nutrients)

---

## Next Steps

1. **Import Your Crops:** Search and import all crops you plan to grow
2. **Add Yields:** Update yield estimates based on your experience
3. **Use Garden Planner:** See nutrition estimates in "Season Planner" tab
4. **Track Progress:** Monitor nutritional output as you plan your garden

---

## Resources

- **USDA FoodData Central:** https://fdc.nal.usda.gov/
- **API Documentation:** https://fdc.nal.usda.gov/api-guide.html
- **Get API Key:** https://fdc.nal.usda.gov/api-key-signup.html

---

## Rate Limits

- **Free Tier:** 1,000 requests/hour
- **Safety Buffer:** App uses 900/hour limit
- **Typical Usage:** 1-2 searches = 2-3 requests
- **Bulk Import:** 36 requests (safe)

---

**Questions?**
- Check `PHASE2_USDA_INTEGRATION_SUMMARY.md` for detailed documentation
- Run `python test_usda_integration.py` to diagnose issues

---

**Last Updated:** 2026-01-25
