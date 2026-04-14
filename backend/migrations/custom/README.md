# Custom Database Migrations

This directory contains custom migration scripts for the Homestead Planner database.

## Structure

- `schema/` - Database schema changes (add columns, tables, indexes)
- `data/` - Plant and seed data additions

## Running Migrations

All scripts are designed to be run from the backend directory:

```bash
cd backend
python migrations/custom/schema/add_position_fields.py
python migrations/custom/data/add_spinach.py
```

## Import Pattern

All scripts include path injection to work from the nested directory:

```python
# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))
```

This allows scripts to import from `app.py`, `models.py`, `plant_database.py`, etc.

## Migration Types

### Schema Migrations (`schema/`)
Add or modify database structure:
- Column additions
- Table creation
- Index creation
- Data type changes

### Data Migrations (`data/`)
Add plant varieties and seed catalog entries:
- New plant species
- Variety additions
- Plant database field updates

## Script Organization

**Schema migrations** (28 scripts):
- `add_actual_harvest_date.py` - Add actual_harvest_date to harvest_record
- `add_broadcast_density_fields.py` - Add broadcast seeding density fields
- `add_catalog_seed_id.py` - Link seed inventory to catalog
- `add_custom_dimensions_to_placed_structure.py` - Custom structure sizes
- `add_event_type_to_planting_event.py` - Track event types
- `add_garden_bed_id_to_placed_structure.py` - Link structures to beds
- `add_height_to_garden_bed.py` - Add vertical growing space tracking
- `add_indoor_seed_start_table.py` - Create indoor seed starting table
- `add_is_global_index_migration.py` - Global catalog indexing
- `add_is_global_migration.py` - Mark catalog seeds as global
- `add_last_synced_at.py` - Track sync timestamps
- `add_mulch_soil_to_garden_bed.py` - Track mulch and soil amendments
- `add_plant_spacing_fields.py` - Detailed plant spacing data
- `add_position_fields.py` - Track plant positions in beds
- `add_property_coordinates_migration.py` - GPS coordinates for property
- `add_row_continuity_fields.py` - Row planting continuity tracking
- `add_row_number.py` - Row numbering for garden beds
- `add_season_extension_migration.py` - Season extension structure tracking
- `add_seed_agronomic_overrides.py` - Custom agronomic data per seed
- `add_seed_density_fields.py` - Seeding density calculations
- `add_shape_type_to_placed_structure.py` - Structure shape variants
- `add_soil_temp_min.py` - Minimum soil temperature tracking
- `add_succession_group.py` - Group plantings for succession
- `add_user_id_to_all_models.py` - Multi-user support
- `add_variety_column.py` - Track plant varieties
- `add_variety_column_fixed.py` - Fix variety column implementation
- `add_variety_to_planted_item.py` - Variety tracking in planted items
- `add_weeks_indoors.py` - Indoor seed starting weeks
- `add_zone_to_garden_bed.py` - Hardiness zone per bed

**Data migrations** (23 scripts):
- `add_amaranth.py` - Add amaranth varieties
- `add_bronze_guard.py` - Add Bronze Guard lettuce
- `add_burdock.py` - Add burdock varieties
- `add_catnip.py` - Add catnip
- `add_dakota_black_popcorn.py` - Add Dakota Black popcorn
- `add_datura.py` - Add datura varieties
- `add_de_cicco_broccoli.py` - Add De Cicco broccoli
- `add_lemon_balm_varieties.py` - Add lemon balm varieties
- `add_mullein.py` - Add mullein
- `add_multiple_varieties.py` - Batch add multiple varieties
- `add_onion_varieties.py` - Add onion varieties
- `add_plant_fields.py` - Update plant database fields
- `add_pumpkin_varieties.py` - Add pumpkin varieties
- `add_purple_coneflower.py` - Add purple coneflower
- `add_rice.py` - Add rice varieties
- `add_shasta_daisy.py` - Add Shasta daisy
- `add_shungiku.py` - Add shungiku (chrysanthemum greens)
- `add_sorrel.py` - Add sorrel varieties
- `add_spinach.py` - Add spinach varieties
- `add_tomato_varieties.py` - Add tomato varieties
- `add_viroflay_spinach.py` - Add Viroflay spinach
- `add_watermelon_varieties.py` - Add watermelon varieties

## Original Location

These scripts were originally in `backend/` root directory and were moved on 2026-01-19 to improve project organization while maintaining full functionality.

## Best Practices

1. **Always run from backend directory**: `cd backend && python migrations/custom/schema/script.py`
2. **Check before modifying**: Many scripts check if changes already exist
3. **Test on development database**: Never run untested migrations on production
4. **Document changes**: Update this README when adding new migrations
5. **Name descriptively**: Use `add_<what_it_does>.py` naming convention

## Testing

Use the validation script to test imports without executing:

```bash
cd backend
python migrations/custom/test_migrations.py
```

## Related Documentation

- `../MIGRATION_GUIDE.md` - Plant database update guide (AST-based updates)
- `../MIGRATIONS.md` - Flask-Migrate (Alembic) workflow guide
- `../../CLAUDE.md` - Project structure and guidelines
