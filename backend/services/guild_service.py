"""Plant guild layout, validation, and companion scoring helpers."""

import math
from datetime import timedelta

from conflict_checker import validate_planting_conflict
from garden_methods import get_guild_by_id
from models import PlantedItem
from plant_database import get_plant_by_id
from sfg_spacing import get_sfg_cells_required


def _strip_variant_suffix(plant_id):
    parts = plant_id.rsplit('-', 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0]
    return plant_id


def _plant_ref_matches(reference_id, plant_id):
    if reference_id == plant_id:
        return True
    return _strip_variant_suffix(reference_id) == _strip_variant_suffix(plant_id)


def _format_plant_name(plant_id):
    plant = get_plant_by_id(plant_id)
    return plant.get('name', plant_id) if plant else plant_id


def _grid_dimensions(width_feet, length_feet, grid_size):
    return {
        'width': math.ceil((float(width_feet) * 12) / grid_size),
        'height': math.ceil((float(length_feet) * 12) / grid_size),
    }


def _cell_capacity_for_plant(plant_id, planning_method):
    if planning_method != 'square-foot':
        return 1

    cells_required = get_sfg_cells_required(plant_id)
    if cells_required <= 0:
        return 1
    if cells_required >= 1:
        return 1
    return max(1, int(math.floor(1 / cells_required)))


def _guild_cells(origin_x, origin_y, dimensions):
    cells = []
    for row in range(dimensions['height']):
        for col in range(dimensions['width']):
            cells.append({'x': origin_x + col, 'y': origin_y + row})
    return cells


def _build_layout(guild, bed, origin_x, origin_y):
    dimensions = _grid_dimensions(
        guild['bedSize']['width'],
        guild['bedSize']['length'],
        bed.grid_size or 12,
    )
    cells = _guild_cells(origin_x, origin_y, dimensions)
    placements = []
    cell_index = 0

    for guild_plant in guild.get('plants', []):
        plant_id = guild_plant.get('id')
        quantity = int(guild_plant.get('quantity') or 0)
        capacity = _cell_capacity_for_plant(plant_id, bed.planning_method)
        remaining = quantity

        while remaining > 0:
            if cell_index >= len(cells):
                break
            cell_quantity = min(capacity, remaining)
            position = cells[cell_index]
            placements.append({
                'plantId': plant_id,
                'plantName': _format_plant_name(plant_id),
                'role': guild_plant.get('role', ''),
                'position': position,
                'quantity': cell_quantity,
            })
            remaining -= cell_quantity
            cell_index += 1

    return dimensions, placements


def _score_companion_relationships(guild_plant_ids, existing_plant_ids):
    warnings = []
    benefits = []
    all_context_ids = list(dict.fromkeys(guild_plant_ids + existing_plant_ids))
    seen_pairs = set()

    for plant_id in guild_plant_ids:
        plant = get_plant_by_id(plant_id)
        if not plant:
            continue

        for other_id in all_context_ids:
            if other_id == plant_id:
                continue
            pair_key = tuple(sorted([plant_id, other_id]))
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            other = get_plant_by_id(other_id)
            if not other:
                continue

            plant_name = plant.get('name', plant_id)
            other_name = other.get('name', other_id)

            has_benefit = any(
                _plant_ref_matches(ref, other_id)
                for ref in plant.get('companionPlants', [])
            ) or any(
                _plant_ref_matches(ref, plant_id)
                for ref in other.get('companionPlants', [])
            )
            has_conflict = any(
                _plant_ref_matches(ref, other_id)
                for ref in plant.get('incompatiblePlants', [])
            ) or any(
                _plant_ref_matches(ref, plant_id)
                for ref in other.get('incompatiblePlants', [])
            )

            if has_benefit:
                benefits.append({
                    'code': 'companion_match',
                    'plantId': plant_id,
                    'otherPlantId': other_id,
                    'message': f'{plant_name} is a known companion for {other_name}.',
                })

            if has_conflict:
                warnings.append({
                    'code': 'companion_conflict',
                    'plantId': plant_id,
                    'otherPlantId': other_id,
                    'message': f'{plant_name} is listed as incompatible with {other_name}.',
                })

    return benefits, warnings


def validate_guild_placement(user_id, bed, guild_id, origin_x=0, origin_y=0,
                             planted_date=None, conflict_override=False):
    """Validate a built-in guild placement against a user's bed."""
    guild = get_guild_by_id(guild_id)
    if not guild:
        return None

    errors = []
    warnings = []

    try:
        origin_x = int(origin_x)
        origin_y = int(origin_y)
    except (TypeError, ValueError):
        origin_x = 0
        origin_y = 0
        errors.append({
            'code': 'invalid_origin',
            'message': 'Origin x and y must be whole numbers.',
        })

    if origin_x < 0 or origin_y < 0:
        errors.append({
            'code': 'invalid_origin',
            'message': 'Origin x and y must be zero or greater.',
        })

    bed_dimensions = _grid_dimensions(bed.width, bed.length, bed.grid_size or 12)
    guild_dimensions, placements = _build_layout(guild, bed, origin_x, origin_y)

    if origin_x + guild_dimensions['width'] > bed_dimensions['width'] or (
        origin_y + guild_dimensions['height'] > bed_dimensions['height']
    ):
        errors.append({
            'code': 'guild_out_of_bounds',
            'message': (
                f"{guild['name']} needs {guild_dimensions['width']} x "
                f"{guild_dimensions['height']} cells from this origin, but "
                f"{bed.name} only has {bed_dimensions['width']} x "
                f"{bed_dimensions['height']} cells."
            ),
        })

    if bed.planning_method and guild.get('method') and bed.planning_method != guild['method']:
        warnings.append({
            'code': 'method_mismatch',
            'message': (
                f"{guild['name']} is designed for {guild['method']} beds; "
                f"{bed.name} uses {bed.planning_method}."
            ),
        })

    requested_quantity = sum(
        int(guild_plant.get('quantity') or 0)
        for guild_plant in guild.get('plants', [])
    )
    placed_quantity = sum(placement['quantity'] for placement in placements)
    if placed_quantity < requested_quantity:
        errors.append({
            'code': 'guild_capacity',
            'message': (
                f"{guild['name']} needs room for {requested_quantity} plants, "
                f"but this layout can place {placed_quantity} at the current grid size."
            ),
        })

    for guild_plant in guild.get('plants', []):
        plant_id = guild_plant.get('id')
        if not get_plant_by_id(plant_id):
            errors.append({
                'code': 'unknown_plant',
                'plantId': plant_id,
                'message': f'Guild plant {plant_id} does not exist in the plant database.',
            })

    if planted_date is not None:
        for placement in placements:
            plant = get_plant_by_id(placement['plantId'])
            if not plant:
                continue

            expected_harvest = planted_date
            if plant.get('daysToMaturity') is not None:
                expected_harvest = planted_date + timedelta(days=plant['daysToMaturity'])

            weeks_indoors = plant.get('weeksIndoors', 0)
            planting_method = 'transplant' if weeks_indoors and weeks_indoors > 0 else 'direct'
            position = placement['position']
            is_valid, conflict = validate_planting_conflict({
                'garden_bed_id': bed.id,
                'position_x': position['x'],
                'position_y': position['y'],
                'plant_id': placement['plantId'],
                'transplant_date': planted_date if planting_method == 'transplant' else None,
                'direct_seed_date': planted_date if planting_method == 'direct' else None,
                'seed_start_date': None,
                'start_date': planted_date,
                'end_date': expected_harvest,
                'conflict_override': conflict_override,
            }, user_id)
            if not is_valid:
                errors.append({
                    'code': 'planting_conflict',
                    'plantId': placement['plantId'],
                    'position': position,
                    'message': conflict.get('message', 'Planting conflict detected.'),
                    'conflicts': conflict.get('conflicts', []),
                })

    guild_plant_ids = [plant['id'] for plant in guild.get('plants', [])]
    existing_plant_ids = [
        item.plant_id
        for item in PlantedItem.query.filter(
            PlantedItem.user_id == user_id,
            PlantedItem.garden_bed_id == bed.id,
            PlantedItem.cancelled_at.is_(None),
            PlantedItem.cleared_at.is_(None),
            PlantedItem.outcome.is_(None),
        ).all()
    ]
    benefits, companion_warnings = _score_companion_relationships(
        guild_plant_ids,
        existing_plant_ids,
    )
    warnings.extend(companion_warnings)

    score = max(0, 100 + (len(benefits) * 5) - (len(warnings) * 10) - (len(errors) * 25))

    return {
        'guildId': guild_id,
        'guildName': guild['name'],
        'bedId': bed.id,
        'origin': {'x': origin_x, 'y': origin_y},
        'bedDimensions': bed_dimensions,
        'guildDimensions': guild_dimensions,
        'placements': placements,
        'totalQuantity': placed_quantity,
        'errors': errors,
        'warnings': warnings,
        'benefits': benefits,
        'score': min(score, 100),
        'canInsert': len(errors) == 0,
    }
