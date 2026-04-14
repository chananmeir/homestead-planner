# Plant Icon Images

This directory contains custom icon images for plants in the garden designer.

## Naming Convention

Plant icons should be named using the plant ID from the database:
- Format: `{plant-id}.png`
- Example: `tomato-1.png`, `lettuce-2.png`, `basil-1.png`

## Image Specifications

- **Format**: PNG with transparent background (recommended)
- **Size**: 40x40 pixels (will scale automatically)
- **Style**: Simple, clear icons that represent the plant visually

## Creating Icons

You can create icons using:
1. Image editing software (GIMP, Photoshop, Figma, etc.)
2. AI image generators
3. Public domain icon libraries
4. Hand-drawn and scanned illustrations

## Fallback Behavior

If a plant's icon image is not found or fails to load, the system will automatically fall back to displaying the emoji icon from the database.

## Current Status

Icons are being added incrementally. Plants without custom icons will display their emoji representations.
