# Plant Icon System - Implementation Guide

## Overview

The Homestead Planner now supports custom plant images with automatic emoji fallback. This system allows you to replace generic emoji icons with custom plant illustrations while maintaining full backward compatibility.

## How It Works

### Automatic Image Loading

The system automatically tries to load plant images from `/plant-icons/{plant-id}.png`:

- If the image exists and loads successfully → displays the custom image
- If the image doesn't exist or fails to load → displays the emoji fallback
- No database changes required - just drop image files in the directory!

### Components

#### 1. PlantIcon Component (HTML contexts)

Used in regular HTML/React components like PlantPalette.

```typescript
import PlantIcon from './common/PlantIcon';

<PlantIcon
  plantId="tomato-1"
  plantIcon="🍅"
  size={32}
  className="optional-classes"
/>
```

**Props:**
- `plantId` (string): The plant's database ID
- `plantIcon` (string): Emoji fallback if image doesn't load
- `size` (number): Size in pixels (default: 40)
- `className` (string): Optional CSS classes

#### 2. PlantIconSVG Component (SVG contexts)

Used inside SVG elements like the garden grid.

```typescript
import { PlantIconSVG } from './common/PlantIcon';

<svg>
  <PlantIconSVG
    plantId="lettuce-1"
    plantIcon="🥬"
    x={100}
    y={100}
    width={40}
    height={40}
  />
</svg>
```

**Props:**
- `plantId` (string): The plant's database ID
- `plantIcon` (string): Emoji fallback if image doesn't load
- `x` (number): X coordinate (top-left corner)
- `y` (number): Y coordinate (top-left corner)
- `width` (number): Image width
- `height` (number): Image height

## Adding Custom Plant Images

### Step 1: Find the Plant ID

Plant IDs are defined in `backend/plant_database.py`. Examples:
- `tomato-1`, `tomato-2`, `tomato-3` (varieties)
- `lettuce-1`, `lettuce-2`
- `basil-1`, `basil-2`

You can also check the frontend API response at `http://localhost:5000/api/plants`.

### Step 2: Create or Source Your Image

#### Image Specifications

- **Format**: PNG (with transparency recommended)
- **Size**: 40x40 pixels minimum (will scale automatically)
- **Recommended sizes**: 40x40, 80x80, or 120x120 for best quality
- **Background**: Transparent or white
- **Style**: Simple, clear icons that are recognizable at small sizes

#### Image Sources

1. **Create Your Own**
   - Use image editing software (GIMP, Photoshop, Figma, etc.)
   - Draw and scan hand illustrations
   - Take photos and crop/edit them

2. **AI Generation**
   - DALL-E, Midjourney, Stable Diffusion
   - Prompt example: "Simple icon of a tomato plant, transparent background, 40x40 pixels, flat design"

3. **Public Domain / Creative Commons**
   - OpenClipArt
   - Wikimedia Commons
   - Noun Project (with attribution)

4. **Professional Icon Packs**
   - Purchase commercial icon sets
   - Commission custom illustrations

### Step 3: Name and Save the Image

Save your image with the plant ID as the filename:

```
frontend/public/plant-icons/{plant-id}.png
```

**Examples:**
```
frontend/public/plant-icons/tomato-1.png
frontend/public/plant-icons/lettuce-1.png
frontend/public/plant-icons/basil-1.png
```

### Step 4: Test in the Application

1. **Start the development server** (if not running):
   ```bash
   cd frontend
   npm start
   ```

2. **Open the Garden Designer** at `http://localhost:3000`

3. **Check the PlantPalette** - Your custom icon should appear

4. **Place a plant on the grid** - Icon should render in the garden bed

5. **Test fallback** - Rename the image temporarily to confirm emoji fallback works

## File Structure

```
homestead-planner/
├── frontend/
│   ├── public/
│   │   └── plant-icons/              # Custom plant images
│   │       ├── README.md             # Quick reference guide
│   │       ├── tomato-1.png          # Example images
│   │       ├── lettuce-1.png
│   │       └── basil-1.png
│   └── src/
│       └── components/
│           └── common/
│               └── PlantIcon.tsx     # Icon component implementation
└── backend/
    └── plant_database.py             # Plant IDs defined here
```

## Current Plant Database

The system includes 98 plants across these categories:

### Vegetables (60+ varieties)
- Tomatoes (12 varieties)
- Lettuce (9 varieties)
- Peppers (8 varieties)
- Onions (7 varieties)
- And many more...

### Herbs (15+ varieties)
- Basil (3 varieties)
- Oregano, Thyme, Parsley, etc.

### Flowers (10+ varieties)
- Marigolds, Zinnias, Sunflowers, etc.

### Fruits
- Strawberries, Melons, etc.

### Cover Crops
- Clover, Rye, Buckwheat

See `backend/plant_database.py` for the complete list with IDs.

## Technical Implementation

### Files Modified

1. **frontend/src/types.ts**
   - Added `iconUrl?: string` to Plant interface

2. **frontend/src/components/common/PlantIcon.tsx** (NEW)
   - Created PlantIcon and PlantIconSVG components
   - Implements automatic loading with fallback logic

3. **frontend/src/components/GardenDesigner.tsx**
   - Updated to use PlantIconSVG for grid rendering
   - Updated to use PlantIcon for plant lists

4. **frontend/src/components/GardenDesigner/PlacementPreview.tsx**
   - Updated to support both custom images and emoji

5. **frontend/src/components/common/PlantPalette.tsx**
   - Updated to use PlantIcon component

### How the Fallback Works

```typescript
// 1. Component tries to load image
<img src="/plant-icons/{plantId}.png" onError={handleImageError} />

// 2. If image fails, onError handler is triggered
const handleImageError = () => {
  setUseImage(false); // Switch to emoji mode
};

// 3. Component renders emoji instead
{useImage ? <img src={...} /> : <div>{plantIcon}</div>}
```

## Best Practices

### Image Creation

1. **Keep it simple** - Icons should be recognizable at 40x40 pixels
2. **Use transparency** - Allows icons to work on any background
3. **Consistent style** - Try to maintain visual consistency across all icons
4. **Test at scale** - View icons at different sizes to ensure clarity
5. **Optimize file size** - Use PNG compression to keep files small

### Naming Conventions

- Always use lowercase
- Use hyphens (not underscores or spaces)
- Match the exact plant ID from the database
- Use `.png` extension

### Organization

- Keep all plant icons in `/frontend/public/plant-icons/`
- Create subdirectories for categories if you have many icons:
  ```
  plant-icons/
  ├── vegetables/
  ├── herbs/
  ├── flowers/
  └── fruits/
  ```
  Note: Update the PlantIcon component to search subdirectories if you do this

## Troubleshooting

### Icon Not Appearing

1. **Check the filename** - Must exactly match plant ID
   ```bash
   # Get plant IDs from backend
   curl http://localhost:5000/api/plants | jq '.[].id'
   ```

2. **Check file location** - Must be in `frontend/public/plant-icons/`

3. **Clear browser cache** - Hard refresh with Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

4. **Check browser console** - Look for 404 errors indicating missing files

5. **Verify image format** - Must be a valid PNG file

### Image Not Loading Correctly

1. **Check image dimensions** - Ensure the image is at least 40x40 pixels
2. **Test the image** - Open it directly in a browser
3. **Check transparency** - Ensure PNG transparency is preserved
4. **Optimize the image** - Large files may load slowly

### Emoji Fallback Not Working

1. **Check plant database** - Ensure the plant has an `icon` field
2. **Verify PlantIcon props** - Make sure `plantIcon` prop is passed
3. **Check browser emoji support** - Some emojis may not render on older systems

## Future Enhancements

Possible improvements to the icon system:

1. **Icon Library** - Create a complete set of professional icons for all 98 plants
2. **Multiple Formats** - Support SVG, WebP, or other formats
3. **Responsive Sizing** - Serve different image sizes based on display resolution
4. **Icon Gallery** - Admin interface to preview and manage plant icons
5. **Batch Import** - Tool to import multiple icons at once
6. **Icon Generator** - AI-powered icon generation from plant descriptions
7. **Icon Variants** - Support multiple styles (realistic, flat, illustrated)
8. **Database Storage** - Store icon URLs in database instead of file convention

## Support

For questions or issues with the plant icon system:
1. Check this guide first
2. Review the component code in `PlantIcon.tsx`
3. Check the browser console for errors
4. Verify the plant ID in `plant_database.py`

## Examples

### Example 1: Adding a Tomato Icon

```bash
# 1. Create or download your tomato icon image
# 2. Save it as tomato-1.png
# 3. Copy to the icons directory
cp ~/Downloads/my-tomato-icon.png frontend/public/plant-icons/tomato-1.png

# 4. Refresh the browser - icon should appear!
```

### Example 2: Batch Adding Multiple Icons

```bash
# If you have a folder of icons named correctly:
cp ~/my-plant-icons/*.png frontend/public/plant-icons/

# Verify they copied correctly
ls frontend/public/plant-icons/
```

### Example 3: Testing Fallback Behavior

```bash
# Temporarily rename an icon to test fallback
mv frontend/public/plant-icons/tomato-1.png frontend/public/plant-icons/tomato-1.png.backup

# Refresh browser - should show emoji 🍅

# Restore the icon
mv frontend/public/plant-icons/tomato-1.png.backup frontend/public/plant-icons/tomato-1.png
```

---

**Last Updated**: 2026-01-12
**Version**: 1.0
**Author**: Claude Code
