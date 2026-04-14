# Breed Selection Guide - How to Get Accurate Production Estimates

## Overview

The breed dropdown in the "Add Chicken/Duck/Goat" form now shows all available breeds with their production rates, making it easy to get accurate egg and milk production estimates.

---

## How It Works

### ✅ What You See

When adding animals, you'll see a **dropdown menu** with breeds like:

**Chickens:**
- Leghorn (320 eggs/yr)
- Rhode Island Red (250 eggs/yr)
- Silkie (120 eggs/yr)
- etc.

**Ducks:**
- Khaki Campbell (300 eggs/yr)
- Pekin (150 eggs/yr)
- etc.

**Goats:**
- Alpine (2,200 lbs milk/yr)
- Nigerian Dwarf (600 lbs milk/yr)
- etc.

### 📊 Production Calculation

When you select a breed, the system automatically uses that breed's production rate when calculating your nutrition dashboard.

**Example:**
- If you add **10 Leghorn chickens** → System calculates 3,200 eggs/year (10 × 320)
- If you add **10 Rhode Island Red chickens** → System calculates 2,500 eggs/year (10 × 250)

---

## Age-Based Adjustments

The system also adjusts production based on the **Hatch Date** or **Birth Date** you enter:

### Chickens & Ducks

| Age | Production Rate |
|-----|----------------|
| Before laying start (e.g., < 18 weeks) | 0% |
| Ramping up (first 8 weeks of laying) | 50% → 100% |
| Year 1 (peak) | 100% |
| Year 2 | 85% |
| Year 3 | 70% |
| Year 4 | 50% |
| Year 5+ | 30% |

### Goats

| Age/Status | Production Rate |
|------------|----------------|
| Too young (< 10 months) | 0% |
| First lactation | 70% |
| Peak years (2-5) | 100% |
| Year 6 | 85% |
| Year 7+ | 70% |
| Males | 0% |

**Example:**
- 10 Leghorn chickens, 40 weeks old (peak): 10 × 320 × 1.0 = **3,200 eggs/year**
- 10 Leghorn chickens, 2.5 years old: 10 × 320 × 0.85 = **2,720 eggs/year**
- 10 Leghorn chickens, 12 weeks old (not laying yet): 10 × 320 × 0.0 = **0 eggs/year**

---

## What If My Breed Isn't Listed?

### Option 1: Select "Other/Unknown"

At the bottom of each breed list is an **"Other/Unknown"** option:
- **Chickens:** Uses 250 eggs/year (average dual-purpose hen)
- **Ducks:** Uses 200 eggs/year (average duck)
- **Goats:** Uses 1,800 lbs milk/year (average dairy goat)

### Option 2: Select the Closest Match

If your breed isn't listed, select the closest similar breed:
- **Silkie mix?** → Select "Silkie"
- **Heritage breed hen?** → Select "Plymouth Rock" or "Rhode Island Red"
- **Hybrid layer?** → Select "ISA Brown" or "Leghorn"

---

## Tips for Accurate Results

### ✅ Do This:
1. **Select the correct breed** from the dropdown
2. **Enter the hatch/birth date** for age-based adjustments
3. **Enter accurate quantity** (number of birds)
4. **Select correct sex** for goats (males don't produce milk)
5. **Select correct purpose** (meat breeds don't lay as many eggs)

### ❌ Avoid This:
- ~~Typing random text in breed field~~ (now impossible with dropdown!)
- ~~Leaving breed blank~~ (select "Other/Unknown" instead)
- ~~Guessing ages~~ (approximate dates are fine, but better than nothing)

---

## Behind the Scenes

### How Breed Matching Works

1. You select a breed from the dropdown (e.g., "Rhode Island Red")
2. The system normalizes the name to match the database:
   - "Rhode Island Red" → "rhode-island-red"
   - "ISA Brown" → "isa-brown"
3. The system looks up the breed in the database
4. If found, uses breed-specific rates
5. If not found (or "Other"), uses species defaults

### No Breaking Changes

- **Old data still works:** Animals added before this update (with free-text breeds) will still calculate using defaults
- **Graceful fallback:** Unknown breeds automatically use species averages
- **Age optional:** If no hatch date, system assumes peak production

---

## Production Rates Reference

### Top Layer Chickens (Eggs)
1. Leghorn: 320 eggs/year
2. ISA Brown: 300 eggs/year
3. Easter Egger: 280 eggs/year
4. Rhode Island Red: 250 eggs/year
5. Australorp: 250 eggs/year

### Top Layer Ducks (Eggs)
1. Khaki Campbell: 300 eggs/year
2. Runner: 280 eggs/year
3. Welsh Harlequin: 240 eggs/year

### Top Dairy Goats (Milk)
1. Alpine: 2,200 lbs/year (~264 gallons)
2. Saanen: 2,000 lbs/year (~240 gallons)
3. LaMancha: 2,000 lbs/year (~240 gallons)
4. Nubian: 1,800 lbs/year (~216 gallons)

### Dwarf Breeds
- Nigerian Dwarf: 600 lbs/year (~72 gallons)

*Note: 1 gallon of milk ≈ 8.3 lbs*

---

## Example Calculations

### Example 1: Small Backyard Flock
**Input:**
- 6 Rhode Island Red chickens
- Hatched 1 year ago (peak production)

**Calculation:**
- 6 chickens × 250 eggs/year × 1.0 (peak) = **1,500 eggs/year**

**Result in Nutrition Dashboard:**
- ~138 lbs of eggs/year
- ~89,700 calories
- ~7,866 g protein

---

### Example 2: Mixed Age Flock
**Input:**
- 4 Leghorn chickens (1 year old - peak)
- 3 Rhode Island Red chickens (3 years old - declining)
- 5 young chicks (3 months old - not laying)

**Calculation:**
- Leghorns: 4 × 320 × 1.0 = 1,280 eggs
- RIR: 3 × 250 × 0.70 = 525 eggs
- Young: 5 × 250 × 0.0 = 0 eggs
- **Total: 1,805 eggs/year**

---

### Example 3: Dairy Goat Herd
**Input:**
- 2 Alpine does (3 years old - peak)
- 1 Nigerian Dwarf doe (2 years old - peak)
- 1 buck (breeding male)

**Calculation:**
- Alpines: 2 × 2,200 × 1.0 = 4,400 lbs
- Nigerian: 1 × 600 × 1.0 = 600 lbs
- Buck: 1 × 0 = 0 lbs (males don't produce milk)
- **Total: 5,000 lbs milk/year (~600 gallons)**

---

## Questions?

### Q: What if I don't know my chickens' exact age?
**A:** Enter an approximate hatch date. Even rough estimates (within a few months) are better than leaving it blank.

### Q: What if I have a mixed flock of different breeds?
**A:** Add each breed separately! The system will calculate production for each group and sum them.

### Q: Do I need to update old entries?
**A:** No! Old entries will continue working. But if you want more accurate estimates, you can edit them and select the correct breed from the dropdown.

### Q: What happens if I select "Other/Unknown"?
**A:** The system uses species defaults (250 eggs for chickens, 200 for ducks, 1,800 lbs for goats).

### Q: Can I still add custom breed names?
**A:** With the new dropdown, you must select from the list. If your breed isn't there, select "Other/Unknown" or the closest match.

---

## Summary

✅ **Easy breed selection** with dropdown menu
✅ **Production rates shown** right in the dropdown
✅ **Automatic age adjustments** based on hatch/birth date
✅ **Accurate nutrition estimates** for planning
✅ **No data loss** - old entries still work

The system now gives you realistic, breed-specific production estimates to help you plan your homestead's food production!
