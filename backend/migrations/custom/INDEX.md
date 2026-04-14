# Migration Script Index

Quick reference guide to all custom migration scripts in this directory.

## Schema Migrations (`schema/`)

Database structure modifications - columns, tables, indexes, constraints.

### Table: planting_event
- `add_actual_harvest_date.py` - Add actual_harvest_date column for tracking actual vs planned harvest
- `add_event_type_to_planting_event.py` - Add event_type column to categorize planting events
- `add_position_fields.py` - Add position_x, position_y, space_required for grid-based placement
- `add_row_continuity_fields.py` - Add row continuity tracking for continuous plantings
- `add_row_number.py` - Add row_number column for row-based garden layouts
- `add_succession_group.py` - Add succession_group for grouping succession plantings
- `add_variety_column.py` - Add variety column to track plant varieties
- `add_variety_column_fixed.py` - Fixed version of add_variety_column.py
- `add_variety_to_planted_item.py` - Migrate variety data to planted items

### Table: garden_bed
- `add_height_to_garden_bed.py` - Add height column for vertical growing space tracking
- `add_mulch_soil_to_garden_bed.py` - Add mulch_type and soil_type tracking
- `add_zone_to_garden_bed.py` - Add hardiness_zone column for zone-specific planning

### Table: placed_structure
- `add_custom_dimensions_to_placed_structure.py` - Add custom width/length/height for structures
- `add_garden_bed_id_to_placed_structure.py` - Link structures to specific garden beds
- `add_shape_type_to_placed_structure.py` - Add shape variations (circle, polygon, etc.)

### Table: property
- `add_property_coordinates_migration.py` - Add latitude/longitude for GPS location

### Table: seed_inventory
- `add_catalog_seed_id.py` - Link personal seeds to catalog entries
- `add_seed_agronomic_overrides.py` - Custom agronomic data per seed variety
- `add_seed_density_fields.py` - Seeding density calculations and tracking

### Table: seed_inventory / catalog
- `add_broadcast_density_fields.py` - Broadcast seeding density calculations
- `add_is_global_index_migration.py` - Index for global catalog queries
- `add_is_global_migration.py` - Mark catalog seeds as global vs personal
- `add_last_synced_at.py` - Track catalog synchronization timestamps
- `add_weeks_indoors.py` - Indoor seed starting weeks before transplant

### New Tables
- `add_indoor_seed_start_table.py` - Create indoor_seed_start table for seed starting

### Plant Database Fields
- `add_plant_spacing_fields.py` - Detailed spacing data (row, plant, SFG)
- `add_soil_temp_min.py` - Minimum soil temperature for germination

### Multi-user Support
- `add_user_id_to_all_models.py` - Add user_id to all tables for multi-user support

### Season Extension
- `add_season_extension_migration.py` - Track season extension structures (cold frames, etc.)

---

## Data Migrations (`data/`)

Plant varieties and seed catalog additions.

### Flowers & Ornamentals
- `add_purple_coneflower.py` - Add Echinacea purpurea (Purple Coneflower)
- `add_shasta_daisy.py` - Add Leucanthemum x superbum (Shasta Daisy)

### Grains & Cereals
- `add_dakota_black_popcorn.py` - Add Dakota Black popcorn variety
- `add_rice.py` - Add rice varieties to catalog

### Greens & Salad Crops
- `add_bronze_guard.py` - Add Bronze Guard lettuce variety
- `add_shungiku.py` - Add Shungiku (Chrysanthemum greens)
- `add_sorrel.py` - Add sorrel varieties
- `add_spinach.py` - Add spinach varieties to catalog
- `add_viroflay_spinach.py` - Add Viroflay spinach variety

### Herbs & Medicinal Plants
- `add_amaranth.py` - Add amaranth varieties
- `add_catnip.py` - Add Nepeta cataria (Catnip)
- `add_lemon_balm_varieties.py` - Add lemon balm varieties
- `add_mullein.py` - Add Verbascum thapsus (Mullein)

### Alliums
- `add_onion_varieties.py` - Add various onion varieties

### Brassicas
- `add_de_cicco_broccoli.py` - Add De Cicco broccoli variety

### Cucurbits
- `add_pumpkin_varieties.py` - Add pumpkin varieties
- `add_watermelon_varieties.py` - Add watermelon varieties

### Root Vegetables
- `add_burdock.py` - Add Arctium lappa (Burdock root)

### Solanaceae
- `add_datura.py` - Add Datura stramonium varieties (WARNING: toxic)
- `add_tomato_varieties.py` - Add tomato varieties

### Batch Updates
- `add_multiple_varieties.py` - Batch add multiple plant varieties
- `add_plant_fields.py` - Systematic plant database field updates

---

## Usage

All scripts are designed to run from the backend directory:

```bash
cd backend

# Schema migration
python migrations/custom/schema/add_position_fields.py

# Data migration
python migrations/custom/data/add_spinach.py
```

## Testing

Validate all scripts before running:

```bash
cd backend
python migrations/custom/test_migrations.py
```

## Safety Notes

1. **Schema migrations**: Most check if changes already exist before applying
2. **Data migrations**: Generally safe to re-run (update existing or skip if present)
3. **Always test on development database first**
4. **Backup your database before running migrations**: `cp instance/homestead.db instance/homestead.db.backup`

## Migration History

These scripts were originally in `backend/` root directory and were organized into this structure on 2026-01-19 to improve project organization.

**Total Scripts**: 51 (29 schema, 22 data)
