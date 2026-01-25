"""
Garden Planner Service

Business logic and calculations for the Garden Season Planner tool.
Handles plant quantity calculations, succession planning, seed requirements,
and timeline optimization.
"""

import math
import json
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Tuple
from models import db, GardenPlan, GardenPlanItem, SeedInventory, GardenBed, PlantingEvent, TrellisStructure
from plant_database import get_plant_by_id
from services.space_calculator import calculate_space_requirement
from services.rotation_checker import get_rotation_status_for_plan_item


def calculate_plant_quantities(
    seed_selections: List[Dict],
    strategy: str = 'balanced',
    succession_preference: str = 'moderate',
    user_id: int = None,
    manual_quantities: Dict[int, int] = None,
    per_seed_succession: Dict[int, str] = None
) -> List[Dict]:
    """
    Calculate optimal plant quantities based on seed selection and strategy.

    Args:
        seed_selections: List of selected seed inventory items
        strategy: 'maximize_harvest', 'use_all_seeds', or 'balanced'
        succession_preference: 'none', 'light', 'moderate', 'heavy' (global default)
        user_id: User ID for accessing garden beds
        manual_quantities: Optional dict of seed_id -> manual quantity overrides
        per_seed_succession: Optional dict of seed_id -> succession preference overrides

    Returns:
        List of calculated plan items with quantities and succession info
    """
    if manual_quantities is None:
        manual_quantities = {}
    if per_seed_succession is None:
        per_seed_succession = {}
    # Calculate total available space (rough estimate used in main loop)
    total_available_cells = _calculate_total_available_space(user_id)

    plan_items = []

    for seed in seed_selections:
        plant_id = seed['plantId']
        variety = seed.get('variety', '')
        seed_inventory_id = seed.get('id')

        # Get plant data
        plant = get_plant_by_id(plant_id)
        if not plant:
            continue

        # Determine planting method and unit type
        unit_type = 'plants'  # Default to individual plants for now

        # Calculate space per plant
        space_per_plant = calculate_space_requirement(
            plant_id=plant_id,
            planning_method='square-foot'  # Use SFG as baseline
        )

        # Calculate max plants by space (floor to whole plants)
        max_by_space = math.floor(total_available_cells / space_per_plant) if space_per_plant > 0 else 0

        # Calculate max plants by seeds
        seeds_available = seed.get('quantity', 0) * seed.get('seedsPerPacket', 50)
        germination_rate = _get_germination_rate(seed, plant)
        # Use SFG-appropriate survival rates (ignore MIGardener ultra-dense rates)
        survival_rate = _get_survival_rate(plant, planning_method='square-foot')
        max_by_seeds = int(seeds_available * germination_rate * survival_rate)

        # Check for manual quantity override
        if seed_inventory_id and seed_inventory_id in manual_quantities:
            # Use manual quantity override
            target_plants = manual_quantities[seed_inventory_id]
        else:
            # Apply strategy to determine target quantity
            target_plants = _apply_strategy(
                max_by_space=max_by_space,
                max_by_seeds=max_by_seeds,
                strategy=strategy,
                plant=plant,
                seed=seed
            )

        # Get effective succession preference for this seed (per-seed override or global default)
        effective_succession = per_seed_succession.get(seed_inventory_id, succession_preference) \
            if per_seed_succession else succession_preference

        # Calculate succession info
        succession_info = _calculate_succession(
            plant=plant,
            target_plants=target_plants,
            succession_preference=effective_succession,
            user_id=user_id
        )

        # Calculate seed requirements
        seeds_needed = _calculate_seeds_needed(
            target_plants=target_plants,
            germination_rate=germination_rate,
            survival_rate=survival_rate
        )

        # Calculate packets needed
        seeds_per_packet = seed.get('seedsPerPacket', 50)
        packets_needed = math.ceil(seeds_needed / seeds_per_packet) if seeds_per_packet > 0 else 0

        # Calculate effective plants per planting (accounting for succession)
        if succession_info['enabled'] and succession_info['count'] > 1:
            # Space is per planting, not total season
            plants_per_planting = target_plants / succession_info['count']
        else:
            plants_per_planting = target_plants

        # Calculate space required (using plants per planting)
        # Note: This uses SFG as baseline for per-item display
        # Actual summary uses method-aware calculation from breakdown
        # Use ceil to round up fractional cells (e.g., 25.5 cells → 26 cells)
        space_required = math.ceil(plants_per_planting * space_per_plant)

        plan_item = {
            'seedInventoryId': seed_inventory_id,
            'plantId': plant_id,
            'variety': variety,
            'unitType': unit_type,
            'targetValue': target_plants,
            'plantEquivalent': target_plants,
            'seedsRequired': seeds_needed,
            'seedPacketsRequired': packets_needed,
            'successionEnabled': succession_info['enabled'],
            'successionCount': succession_info['count'],
            'successionIntervalDays': succession_info['interval'],
            'firstPlantDate': succession_info['firstDate'],
            'lastPlantDate': succession_info['lastDate'],
            'harvestWindowStart': succession_info['harvestStart'],
            'harvestWindowEnd': succession_info['harvestEnd'],
            'spaceRequiredCells': space_required,
            'bedsAllocated': [],
            'status': 'planned'
        }

        # Calculate row-based seeding info for MIGardener
        row_seeding_info = _calculate_row_seeding_info(
            plant=plant,
            target_plants=target_plants,
            seeds_needed=seeds_needed,
            user_id=user_id
        )
        if row_seeding_info:
            plan_item['rowSeedingInfo'] = row_seeding_info

        plan_items.append(plan_item)

    # Add rotation checking for plan items with bed allocations
    current_year = datetime.now().year
    for item in plan_items:
        if item.get('bedsAllocated') and user_id:
            rotation_status = get_rotation_status_for_plan_item(
                plan_item=item,
                user_id=user_id,
                planting_year=current_year,
                rotation_window=3
            )
            if rotation_status['has_warnings']:
                item['rotation_warnings'] = rotation_status['warnings']

    # Calculate method breakdown first (if user has beds)
    method_breakdown = None
    if user_id:
        method_breakdown = _calculate_space_breakdown_by_method(plan_items, user_id)

    # Calculate summary statistics from method breakdown
    if method_breakdown:
        # Aggregate totals from breakdown (excludes trellis - different unit)
        total_space_used = sum(
            stats['used']
            for method, stats in method_breakdown.items()
            if method != 'trellis'
        )
        total_space_available = sum(
            stats['available']
            for method, stats in method_breakdown.items()
            if method != 'trellis'
        )
        space_utilization = (total_space_used / total_space_available * 100) if total_space_available > 0 else 0
    else:
        # Fallback if no beds (edge case)
        total_space_used = 0
        total_space_available = 0
        space_utilization = 0

    summary = {
        'totalPlants': sum(item['plantEquivalent'] for item in plan_items),
        'totalSpaceUsed': total_space_used,
        'totalSpaceAvailable': total_space_available,
        'spaceUtilization': space_utilization,
        'cropDiversity': len(plan_items)
    }

    if method_breakdown:
        summary['methodBreakdown'] = method_breakdown

    return {
        'items': plan_items,
        'summary': summary
    }


def _calculate_total_available_space(user_id: int) -> int:
    """Calculate total available space across all garden beds."""
    if not user_id:
        return 0

    beds = GardenBed.query.filter_by(user_id=user_id).all()
    total_cells = 0

    for bed in beds:
        # Calculate grid dimensions
        grid_size_inches = bed.grid_size or 12
        grid_size_feet = grid_size_inches / 12

        cols = int(bed.width / grid_size_feet)
        rows = int(bed.length / grid_size_feet)
        total_cells += cols * rows

    return total_cells


def _calculate_total_available_trellis_space(user_id: int) -> float:
    """Calculate total available linear feet across all user's trellis structures."""
    if not user_id:
        return 0.0

    trellises = TrellisStructure.query.filter_by(user_id=user_id).all()
    total_feet = sum(t.total_length_feet or 0.0 for t in trellises)
    return total_feet


def _is_trellis_planting(plant: Dict) -> bool:
    """Check if a plant requires trellis linear planting."""
    migardener = plant.get('migardener', {})
    return migardener.get('plantingStyle') == 'trellis_linear'


def _get_linear_feet_per_plant(plant: Dict) -> float:
    """Get linear feet required per plant for trellis crops."""
    migardener = plant.get('migardener', {})
    return migardener.get('linearFeetPerPlant', 5.0)  # Default 5 feet


def _calculate_trellis_space_for_seed(
    plant_id: str,
    variety: str,
    quantity: int,
    succession_count: int
) -> Optional[Dict]:
    """Calculate trellis space requirement for a seed."""
    plant = get_plant_by_id(plant_id)
    if not plant or not _is_trellis_planting(plant):
        return None

    linear_feet_per_plant = _get_linear_feet_per_plant(plant)
    plants_per_planting = quantity / succession_count if succession_count > 0 else quantity
    linear_feet_per_planting = plants_per_planting * linear_feet_per_plant

    return {
        'plantId': plant_id,
        'variety': variety,
        'linearFeetPerPlant': linear_feet_per_plant,
        'plantsPerPlanting': plants_per_planting,
        'linearFeetPerPlanting': linear_feet_per_planting,
        'totalLinearFeet': linear_feet_per_planting  # Same as per planting since trellis is reused
    }


def _get_germination_rate(seed: Dict, plant: Dict) -> float:
    """Get germination rate following hierarchy: seed override -> plant default -> 85%."""
    # 1. Seed-specific override
    if seed.get('germinationRate'):
        return seed['germinationRate'] / 100.0

    # 2. Plant default (if specified)
    if plant.get('germination_rate'):
        return plant['germination_rate'] / 100.0

    # 3. Global fallback
    return 0.85


def _get_survival_rate(plant: Dict, planning_method: str = None) -> float:
    """
    Get survival rate following hierarchy:
    1. Plant-specific MIGardener rate (only if using MIGardener planning method)
    2. Plant model expected_survival_rate (if set)
    3. Starting method default (direct_seed=75%, indoor_start=95%, transplant=90%)

    Args:
        plant: Plant data dictionary
        planning_method: Optional planning method ('migardener', 'square-foot', etc.)
                        If not 'migardener', MIGardener-specific rates are ignored
    """
    # Priority 1: MIGardener-specific rate (only when using MIGardener method)
    # MIGardener rates are designed for ultra-dense seeding with heavy thinning
    # and should not be used for other planning methods
    if planning_method == 'migardener':
        migardener_config = plant.get('migardener', {})
        if migardener_config and 'survivalRate' in migardener_config:
            return migardener_config['survivalRate']

    # Priority 2: Plant model expected_survival_rate (from database)
    if plant.get('expected_survival_rate'):
        return plant['expected_survival_rate']

    # Priority 3: Generic method-based fallback
    starting_method = plant.get('starting_method', 'transplant')
    if starting_method == 'direct_seed':
        return 0.75
    elif starting_method == 'indoor_start':
        return 0.95
    else:  # transplant or default
        return 0.90


def _apply_strategy(
    max_by_space: int,
    max_by_seeds: int,
    strategy: str,
    plant: Dict,
    seed: Dict
) -> int:
    """Apply planning strategy to determine target quantity."""
    if strategy == 'maximize_harvest':
        # Use all available space
        return max_by_space

    elif strategy == 'use_all_seeds':
        # Prioritize using up seeds, especially expiring ones
        return min(max_by_space, max_by_seeds)

    else:  # balanced
        # Use ~70% of space, prioritize variety diversity
        target = min(int(max_by_space * 0.7), max_by_seeds)
        # Ensure at least some plants if seeds are available
        return max(target, min(12, max_by_seeds)) if max_by_seeds > 0 else 0


def _calculate_succession(
    plant: Dict,
    target_plants: int,
    succession_preference: str,
    user_id: int
) -> Dict:
    """
    Calculate succession planting schedule.

    Returns:
        Dict with succession info: enabled, count, interval, dates
    """
    # Get user's frost dates (simplified - would need real implementation)
    last_frost_date = _get_last_frost_date(user_id)
    first_frost_date = _get_first_frost_date(user_id)

    # Check if succession is appropriate for this plant
    dtm = plant.get('days_to_maturity', 60)
    succession_policy = plant.get('succession_policy', 'optional')

    # Skip succession for long-season crops or if policy is 'never'
    if dtm > 90 or succession_policy == 'never' or succession_preference == 'none':
        first_date = _calculate_first_plant_date(plant, last_frost_date)
        harvest_start = first_date + timedelta(days=dtm) if first_date else None

        return {
            'enabled': False,
            'count': 1,
            'interval': None,
            'firstDate': first_date.isoformat() if first_date else None,
            'lastDate': first_date.isoformat() if first_date else None,
            'harvestStart': harvest_start.isoformat() if harvest_start else None,
            'harvestEnd': harvest_start.isoformat() if harvest_start else None
        }

    # Determine succession count based on preference
    succession_counts = {
        'light': 2,
        'moderate': 4,
        'heavy': 8
    }
    succession_count = succession_counts.get(succession_preference, 1)

    # Calculate optimal interval (at least 14 days, or DTM/2 for harvest overlap)
    interval_days = max(14, int(dtm / 2))

    # Calculate first and last planting dates
    first_date = _calculate_first_plant_date(plant, last_frost_date)
    if not first_date:
        return {
            'enabled': False,
            'count': 1,
            'interval': None,
            'firstDate': None,
            'lastDate': None,
            'harvestStart': None,
            'harvestEnd': None
        }

    # Calculate safe planting window
    safe_end_date = first_frost_date - timedelta(days=dtm + 14)  # DTM + 2 week buffer

    # Calculate last planting date based on succession count
    total_succession_days = (succession_count - 1) * interval_days
    last_date = first_date + timedelta(days=total_succession_days)

    # Ensure last date doesn't exceed safe window
    if last_date > safe_end_date:
        last_date = safe_end_date
        # Recalculate succession count to fit window
        days_available = (last_date - first_date).days
        succession_count = max(1, int(days_available / interval_days) + 1)

    # Calculate harvest window
    harvest_start = first_date + timedelta(days=dtm)
    harvest_end = last_date + timedelta(days=dtm)

    return {
        'enabled': True,
        'count': succession_count,
        'interval': interval_days,
        'firstDate': first_date.isoformat(),
        'lastDate': last_date.isoformat(),
        'harvestStart': harvest_start.isoformat(),
        'harvestEnd': harvest_end.isoformat()
    }


def _get_last_frost_date(user_id: int) -> date:
    """Get user's last frost date from settings or use default."""
    # This would query Settings table in real implementation
    # For now, use a reasonable default (April 15 for Zone 5)
    current_year = datetime.now().year
    return date(current_year, 4, 15)


def _get_first_frost_date(user_id: int) -> date:
    """Get user's first frost date from settings or use default."""
    # This would query Settings table in real implementation
    # For now, use a reasonable default (October 15 for Zone 5)
    current_year = datetime.now().year
    return date(current_year, 10, 15)


def _calculate_first_plant_date(plant: Dict, last_frost_date: date) -> Optional[date]:
    """Calculate first safe planting date based on plant frost tolerance."""
    frost_tolerance = plant.get('frost_tolerance', 'tender')

    # Adjust based on frost tolerance
    if frost_tolerance in ['very_hardy', 'hardy']:
        # Can plant 2 weeks before last frost
        return last_frost_date - timedelta(days=14)
    elif frost_tolerance in ['very_tender', 'tender']:
        # Wait 2 weeks after last frost
        return last_frost_date + timedelta(days=14)
    else:
        # Moderate - plant around last frost date
        return last_frost_date


def _calculate_seeds_needed(
    target_plants: int,
    germination_rate: float,
    survival_rate: float
) -> int:
    """
    Calculate total seeds needed accounting for germination and survival rates.

    Formula: seeds_needed = (target_plants / (germination_rate × survival_rate)) × safety_buffer
    """
    if target_plants == 0:
        return 0

    safety_buffer = 1.15  # 15% extra

    seeds_needed = target_plants / (germination_rate * survival_rate) * safety_buffer
    return math.ceil(seeds_needed)


def _calculate_row_seeding_info(
    plant: Dict,
    target_plants: int,
    seeds_needed: int,
    user_id: int
) -> Optional[Dict]:
    """
    For MIGardener row-based plants, calculate seeds-per-row breakdown.

    Returns:
        Dict with row seeding info, or None if not row-based
    """
    migardener_config = plant.get('migardener', {})
    planting_style = migardener_config.get('plantingStyle')

    # Only for row-based planting
    if planting_style != 'row_based':
        return None

    seed_density_per_inch = migardener_config.get('seedDensityPerInch')
    if not seed_density_per_inch:
        return None

    # Get user's MIGardener beds to determine row length
    from models import GardenBed
    migardener_beds = GardenBed.query.filter_by(
        user_id=user_id,
        planning_method='migardener-intensive'
    ).all()

    if not migardener_beds:
        return None

    # Use first MIGardener bed's width as row length (typically 4 feet = 48 inches)
    # For 4x8 bed: width=4 feet = 48 inches per row
    typical_bed = migardener_beds[0]
    row_length_feet = typical_bed.width  # e.g., 4
    row_length_inches = row_length_feet * 12  # e.g., 48

    # Calculate seeds per row
    seeds_per_row = int(seed_density_per_inch * row_length_inches)

    # Calculate number of rows needed
    rows_needed = math.ceil(seeds_needed / seeds_per_row)

    return {
        'seedsPerRow': seeds_per_row,
        'rowsNeeded': rows_needed,
        'rowLengthFeet': row_length_feet,
        'totalSeeds': seeds_per_row * rows_needed
    }


def calculate_shopping_list(plan_id: int) -> List[Dict]:
    """
    Generate shopping list comparing seeds needed vs. inventory.

    Args:
        plan_id: Garden plan ID

    Returns:
        List of shopping list items with need/have/to-buy calculations
    """
    plan = GardenPlan.query.get(plan_id)
    if not plan:
        return []

    shopping_list = []

    for item in plan.items:
        seed = None
        if item.seed_inventory_id:
            seed = SeedInventory.query.get(item.seed_inventory_id)

        seeds_needed = item.seeds_required or 0
        seeds_have = (seed.quantity * seed.seeds_per_packet) if seed and seed.quantity else None
        seeds_per_packet = seed.seeds_per_packet if seed else 50

        # Calculate packets to buy
        if seeds_have is None:
            # Unknown inventory - assume 0
            packets_to_buy = math.ceil(seeds_needed / seeds_per_packet)
            note = "⚠ Assumes none on hand"
        else:
            seeds_deficit = max(0, seeds_needed - seeds_have)
            if seeds_deficit == 0:
                packets_to_buy = 0
                note = "✓ In stock"
            else:
                packets_to_buy = math.ceil(seeds_deficit / seeds_per_packet)
                note = "Need to purchase"

        shopping_item = {
            'plantId': item.plant_id,
            'variety': item.variety,
            'seedsNeeded': seeds_needed,
            'seedsHave': seeds_have,
            'packetsToBuy': packets_to_buy,
            'seedsPerPacket': seeds_per_packet,
            'estimatedCost': packets_to_buy * (seed.price if seed and seed.price else 3.50),
            'note': note
        }

        shopping_list.append(shopping_item)

    return shopping_list


def export_to_calendar(plan_id: int, user_id: int) -> Dict:
    """
    Export garden plan to planting calendar by creating PlantingEvent records.
    Uses idempotent export keys to prevent duplicates.
    Supports per-bed allocation if beds_allocated is specified.

    Args:
        plan_id: Garden plan ID
        user_id: User ID

    Returns:
        Dict with export results (events created/updated)
    """
    plan = GardenPlan.query.get(plan_id)
    if not plan or plan.user_id != user_id:
        return {'success': False, 'error': 'Plan not found'}

    events_created = 0
    events_updated = 0

    for item in plan.items:
        if not item.first_plant_date:
            continue

        # Parse bed allocations (JSON array of bed IDs)
        beds_allocated = []
        if item.beds_allocated:
            try:
                beds_allocated = json.loads(item.beds_allocated) if isinstance(item.beds_allocated, str) else item.beds_allocated
            except (json.JSONDecodeError, TypeError):
                beds_allocated = []

        # Generate succession group ID for linking events
        import uuid
        succession_group_id = str(uuid.uuid4())

        # Create events for each succession planting
        succession_count = item.succession_count or 1
        interval_days = item.succession_interval_days or 14

        # If beds are allocated, create separate events for each bed
        # Otherwise, create a single event without bed assignment (legacy behavior)
        if beds_allocated:
            # Create events for each bed
            for bed_id in beds_allocated:
                for i in range(succession_count):
                    # Calculate planting date for this succession
                    plant_date = datetime.strptime(item.first_plant_date, '%Y-%m-%d').date() + timedelta(days=i * interval_days)

                    # Generate export key for idempotency (include bed_id)
                    export_key = f"{item.id}_{bed_id}_{plant_date.isoformat()}_{i}"

                    # Check if event already exists
                    existing_event = PlantingEvent.query.filter_by(export_key=export_key).first()

                    if existing_event:
                        # Update existing event
                        existing_event.plant_id = item.plant_id
                        existing_event.variety = item.variety
                        existing_event.garden_bed_id = bed_id
                        existing_event.quantity = int(item.target_value / (succession_count * len(beds_allocated)))
                        existing_event.direct_seed_date = datetime.combine(plant_date, datetime.min.time())
                        existing_event.succession_group_id = succession_group_id
                        existing_event.succession_planting = succession_count > 1
                        events_updated += 1
                    else:
                        # Create new event
                        new_event = PlantingEvent(
                            user_id=user_id,
                            plant_id=item.plant_id,
                            variety=item.variety,
                            garden_bed_id=bed_id,
                            quantity=int(item.target_value / (succession_count * len(beds_allocated))),
                            direct_seed_date=datetime.combine(plant_date, datetime.min.time()),
                            succession_planting=succession_count > 1,
                            succession_group_id=succession_group_id if succession_count > 1 else None,
                            export_key=export_key
                        )
                        db.session.add(new_event)
                        events_created += 1
        else:
            # Legacy: No bed assignments - create events without bed_id
            for i in range(succession_count):
                # Calculate planting date for this succession
                plant_date = datetime.strptime(item.first_plant_date, '%Y-%m-%d').date() + timedelta(days=i * interval_days)

                # Generate export key for idempotency
                export_key = f"{item.id}_{plant_date.isoformat()}_{i}"

                # Check if event already exists
                existing_event = PlantingEvent.query.filter_by(export_key=export_key).first()

                if existing_event:
                    # Update existing event
                    existing_event.plant_id = item.plant_id
                    existing_event.variety = item.variety
                    existing_event.quantity = int(item.target_value / succession_count)
                    existing_event.direct_seed_date = datetime.combine(plant_date, datetime.min.time())
                    existing_event.succession_group_id = succession_group_id
                    existing_event.succession_planting = succession_count > 1
                    events_updated += 1
                else:
                    # Create new event
                    new_event = PlantingEvent(
                        user_id=user_id,
                        plant_id=item.plant_id,
                        variety=item.variety,
                        quantity=int(item.target_value / succession_count),
                        direct_seed_date=datetime.combine(plant_date, datetime.min.time()),
                        succession_planting=succession_count > 1,
                        succession_group_id=succession_group_id if succession_count > 1 else None,
                        export_key=export_key
                    )
                    db.session.add(new_event)
                    events_created += 1

        # Mark item as exported
        item.status = 'exported'

    db.session.commit()

    return {
        'success': True,
        'eventsCreated': events_created,
        'eventsUpdated': events_updated,
        'totalEvents': events_created + events_updated
    }


def _calculate_space_breakdown_by_method(plan_items: List[Dict], user_id: int) -> Dict:
    """Calculate space usage broken down by planning method."""
    from models import GardenBed

    # Get user's beds grouped by method
    beds = GardenBed.query.filter_by(user_id=user_id).all()

    breakdown = {}

    # Calculate bed-based methods (if beds exist)
    if beds:
        beds_by_method = {}
        for bed in beds:
            method = bed.planning_method or 'square-foot'
            if method not in beds_by_method:
                beds_by_method[method] = []
            beds_by_method[method].append(bed)

        for method, method_beds in beds_by_method.items():
            # Calculate available cells for this method
            cells_available = sum([
                _calculate_bed_cells(bed) for bed in method_beds
            ])

            # Calculate used cells for this method (exclude trellis crops)
            cells_used = 0
            for item in plan_items:
                plant_id = item['plantId']
                plant = get_plant_by_id(plant_id)

                # Skip trellis crops for bed-based methods
                if plant and _is_trellis_planting(plant):
                    continue

                quantity = item['plantEquivalent']
                grid_size = method_beds[0].grid_size if method_beds else 12

                cells_per_plant = calculate_space_requirement(
                    plant_id,
                    grid_size,
                    method
                )
                cells_used += cells_per_plant * quantity

            breakdown[method] = {
                'used': cells_used,
                'available': cells_available,
                'utilization': (cells_used / cells_available * 100) if cells_available > 0 else 0
            }

    # Calculate trellis space (separate from beds)
    total_trellis_feet = _calculate_total_available_trellis_space(user_id)
    trellis_feet_used = 0.0

    for item in plan_items:
        plant_id = item['plantId']
        plant = get_plant_by_id(plant_id)

        if plant and _is_trellis_planting(plant):
            quantity = item['plantEquivalent']
            succession_count = item.get('successionCount', 1)
            plants_per_planting = quantity / succession_count if succession_count > 0 else quantity

            linear_feet_per_plant = _get_linear_feet_per_plant(plant)
            trellis_feet_used += plants_per_planting * linear_feet_per_plant

    # Add trellis to breakdown if any trellis crops exist
    if trellis_feet_used > 0:
        breakdown['trellis'] = {
            'used': trellis_feet_used,
            'available': total_trellis_feet,
            'utilization': (trellis_feet_used / total_trellis_feet * 100) if total_trellis_feet > 0 else 0
        }

    return breakdown


def _calculate_bed_cells(bed: 'GardenBed') -> int:
    """Calculate total cells in a bed."""
    grid_size_feet = (bed.grid_size or 12) / 12
    cols = int(bed.width / grid_size_feet)
    rows = int(bed.length / grid_size_feet)
    return cols * rows


def validate_space_feasibility(plan_id: int) -> Dict:
    """
    Check if plan fits within available garden space.

    Args:
        plan_id: Garden plan ID

    Returns:
        Dict with feasibility status and warnings
    """
    plan = GardenPlan.query.get(plan_id)
    if not plan:
        return {'feasible': False, 'error': 'Plan not found'}

    total_space_required = sum(item.space_required_cells or 0 for item in plan.items)
    total_space_available = _calculate_total_available_space(plan.user_id)

    feasible = total_space_required <= total_space_available
    utilization = (total_space_required / total_space_available * 100) if total_space_available > 0 else 0

    warnings = []
    if not feasible:
        warnings.append(f"Plan requires {total_space_required} cells but only {total_space_available} available")
    elif utilization > 90:
        warnings.append(f"High space utilization ({utilization:.1f}%) - may be difficult to achieve")

    return {
        'feasible': feasible,
        'totalSpaceRequired': total_space_required,
        'totalSpaceAvailable': total_space_available,
        'utilization': utilization,
        'warnings': warnings
    }
