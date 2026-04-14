"""
Collision detection validator for structure placement.

Uses AABB (Axis-Aligned Bounding Box) collision detection for rectangles
and circle collision detection for circular structures.
"""

import math

try:
    from collision_rules import is_container, can_overlap, can_contain
except ImportError as e:
    raise ImportError(f"Failed to import collision_rules: {e}")


def check_circle_collision(circle_a, circle_b):
    """
    Check if two circles overlap.

    Args:
        circle_a: Dict with keys: position_x, position_y, width (diameter)
        circle_b: Dict with keys: position_x, position_y, width (diameter)

    Returns:
        bool: True if circles overlap, False otherwise
    """
    # Calculate centers (position is top-left of bounding box, so center is position + radius)
    radius_a = circle_a['width'] / 2
    radius_b = circle_b['width'] / 2

    center_a_x = circle_a['position_x'] + radius_a
    center_a_y = circle_a['position_y'] + radius_a

    center_b_x = circle_b['position_x'] + radius_b
    center_b_y = circle_b['position_y'] + radius_b

    # Calculate distance between centers
    distance = math.sqrt(
        (center_a_x - center_b_x) ** 2 +
        (center_a_y - center_b_y) ** 2
    )

    # Circles overlap if distance < sum of radii
    return distance < (radius_a + radius_b)


def check_circle_rectangle_collision(circle, rect):
    """
    Check if a circle overlaps with a rectangle.

    Args:
        circle: Dict with keys: position_x, position_y, width (diameter)
        rect: Dict with keys: position_x, position_y, width, length

    Returns:
        bool: True if they overlap, False otherwise
    """
    # Circle center
    radius = circle['width'] / 2
    circle_x = circle['position_x'] + radius
    circle_y = circle['position_y'] + radius

    # Rectangle bounds
    rect_left = rect['position_x']
    rect_right = rect['position_x'] + rect['width']
    rect_top = rect['position_y']
    rect_bottom = rect['position_y'] + rect['length']

    # Find closest point on rectangle to circle center
    closest_x = max(rect_left, min(circle_x, rect_right))
    closest_y = max(rect_top, min(circle_y, rect_bottom))

    # Calculate distance from circle center to closest point
    distance = math.sqrt(
        (circle_x - closest_x) ** 2 +
        (circle_y - closest_y) ** 2
    )

    # Overlap if distance < radius
    return distance < radius


def check_collision(struct_a, struct_b):
    """
    Check if two structures collide, handling rectangles and circles.

    Args:
        struct_a: Dict with keys: position_x, position_y, width, length, shape_type (optional)
        struct_b: Dict with keys: position_x, position_y, width, length, shape_type (optional)

    Returns:
        bool: True if structures overlap, False otherwise
    """
    shape_a = struct_a.get('shape_type', 'rectangle')
    shape_b = struct_b.get('shape_type', 'rectangle')

    if shape_a == 'circle' and shape_b == 'circle':
        return check_circle_collision(struct_a, struct_b)
    elif shape_a == 'circle' and shape_b == 'rectangle':
        return check_circle_rectangle_collision(struct_a, struct_b)
    elif shape_a == 'rectangle' and shape_b == 'circle':
        return check_circle_rectangle_collision(struct_b, struct_a)
    else:  # both rectangles
        return check_aabb_collision(struct_a, struct_b)


def check_aabb_collision(struct_a, struct_b):
    """
    Check if two rectangles overlap using AABB collision detection.

    Args:
        struct_a: Dict with keys: position_x, position_y, width, length
        struct_b: Dict with keys: position_x, position_y, width, length

    Returns:
        bool: True if structures overlap, False otherwise
    """
    a_left = struct_a['position_x']
    a_right = struct_a['position_x'] + struct_a['width']
    a_top = struct_a['position_y']
    a_bottom = struct_a['position_y'] + struct_a['length']

    b_left = struct_b['position_x']
    b_right = struct_b['position_x'] + struct_b['width']
    b_top = struct_b['position_y']
    b_bottom = struct_b['position_y'] + struct_b['length']

    # AABB collision: rectangles overlap if ALL of these are true
    return (
        a_left < b_right and
        a_right > b_left and
        a_top < b_bottom and
        a_bottom > b_top
    )


def check_full_containment(container, structure):
    """
    Check if a structure is fully contained within a container.

    Args:
        container: Dict with keys: position_x, position_y, width, length
        structure: Dict with keys: position_x, position_y, width, length

    Returns:
        bool: True if structure is fully inside container, False otherwise
    """
    container_left = container['position_x']
    container_right = container['position_x'] + container['width']
    container_top = container['position_y']
    container_bottom = container['position_y'] + container['length']

    struct_left = structure['position_x']
    struct_right = structure['position_x'] + structure['width']
    struct_top = structure['position_y']
    struct_bottom = structure['position_y'] + structure['length']

    return (
        struct_left >= container_left and
        struct_right <= container_right and
        struct_top >= container_top and
        struct_bottom <= container_bottom
    )


def validate_property_boundaries(structure_bounds, property_width, property_length):
    """
    Validate that a structure fits within property boundaries.

    Args:
        structure_bounds: Dict with position_x, position_y, width, length, shape_type (optional)
        property_width: Property width in feet
        property_length: Property length in feet

    Returns:
        dict: {'valid': bool, 'message': str}
    """
    position_x = structure_bounds['position_x']
    position_y = structure_bounds['position_y']
    width = structure_bounds['width']
    length = structure_bounds['length']
    shape_type = structure_bounds.get('shape_type', 'rectangle')

    # Handle circles differently - position is top-left of bounding box
    if shape_type == 'circle':
        radius = width / 2
        center_x = position_x + radius
        center_y = position_y + radius

        # Check for negative coordinates (circle center must be at least radius from edges)
        if center_x - radius < 0 or center_y - radius < 0:
            return {
                'valid': False,
                'message': f"Circular structure (diameter {width}') at position ({position_x}', {position_y}') extends beyond property boundaries (negative coordinates)"
            }

        # Check if circle extends beyond property boundaries
        if center_x + radius > property_width or center_y + radius > property_length:
            return {
                'valid': False,
                'message': f"Circular structure (diameter {width}') at position ({position_x}', {position_y}') extends beyond property boundaries ({property_width}' x {property_length}')"
            }
    else:
        # Rectangle boundary checking
        right_edge = position_x + width
        bottom_edge = position_y + length

        # Check for negative coordinates
        if position_x < 0 or position_y < 0:
            return {
                'valid': False,
                'message': f"Structure position ({position_x}, {position_y}) has negative coordinates"
            }

        # Check if structure extends beyond property boundaries
        if right_edge > property_width or bottom_edge > property_length:
            return {
                'valid': False,
                'message': f"Structure ({width}' x {length}') at position ({position_x}', {position_y}') would extend to ({right_edge}', {bottom_edge}'), exceeding property boundaries ({property_width}' x {property_length}')"
            }

    return {'valid': True, 'message': ''}


def validate_structure_placement(new_structure, existing_structures, structures_db, property_width=None, property_length=None):
    """
    Validate if a structure can be placed at the given position.

    Args:
        new_structure: Dict with structure data including:
            - structure_id: ID of structure type
            - position_x, position_y: Position coordinates
            - id (optional): ID of existing structure being edited
        existing_structures: List of already placed structures
        structures_db: Dict mapping structure_id to structure definition
            (must include 'category', 'width', 'length')
        property_width: Optional property width for boundary checking
        property_length: Optional property length for boundary checking

    Returns:
        dict: {
            'valid': bool,
            'conflicts': list of conflict dicts,
            'warnings': list of warning dicts
        }
    """
    conflicts = []
    warnings = []

    # Validate required fields
    required_fields = ['structure_id', 'position_x', 'position_y']
    missing_fields = [f for f in required_fields if f not in new_structure or new_structure[f] is None]
    if missing_fields:
        return {
            'valid': False,
            'conflicts': [{'message': f"Missing required fields: {', '.join(missing_fields)}"}],
            'warnings': []
        }

    # Get structure definition
    new_struct_def = structures_db.get(new_structure['structure_id'])
    if not new_struct_def:
        return {
            'valid': False,
            'conflicts': [{'message': f"Unknown structure type: {new_structure['structure_id']}"}],
            'warnings': []
        }

    new_category = new_struct_def['category']
    new_struct_bounds = {
        'position_x': new_structure['position_x'],
        'position_y': new_structure['position_y'],
        'width': new_struct_def['width'],
        'length': new_struct_def['length']
    }

    # Validate property boundaries if dimensions provided
    if property_width is not None and property_length is not None:
        boundary_check = validate_property_boundaries(new_struct_bounds, property_width, property_length)
        if not boundary_check['valid']:
            conflicts.append({
                'type': 'boundary_violation',
                'message': boundary_check['message']
            })
            return {
                'valid': False,
                'conflicts': conflicts,
                'warnings': warnings
            }

    for existing in existing_structures:
        # Skip self when editing
        if new_structure.get('id') and existing.get('id') == new_structure['id']:
            continue

        # Get existing structure definition
        existing_def = structures_db.get(existing['structure_id'])
        if not existing_def:
            # Warn about unknown structure but continue validation
            warnings.append({
                'type': 'unknown_structure',
                'structure_id': existing.get('id'),
                'message': f"Skipping validation for unknown structure type: {existing['structure_id']}"
            })
            continue  # Skip unknown structures

        existing_category = existing_def['category']
        existing_bounds = {
            'position_x': existing['position_x'],
            'position_y': existing['position_y'],
            'width': existing_def['width'],
            'length': existing_def['length']
        }

        # Check for overlap
        has_overlap = check_collision(new_struct_bounds, existing_bounds)

        if not has_overlap:
            continue  # No collision, check next structure

        # CASE 1: New structure is being placed inside a container
        if is_container(existing_category):
            if check_full_containment(existing_bounds, new_struct_bounds):
                # Check if this container type can hold this structure type
                if can_contain(existing_category, new_category):
                    # Valid: structure is fully contained and allowed
                    warnings.append({
                        'type': 'contained',
                        'structure_id': existing.get('id'),
                        'structure_name': existing.get('name', existing_def['name']),
                        'message': f"{new_struct_def['name']} will be placed inside {existing.get('name', existing_def['name'])}"
                    })
                    continue  # Allow this placement
                else:
                    # Container doesn't allow this type of structure
                    conflicts.append({
                        'type': 'invalid_containment',
                        'structure_id': existing.get('id'),
                        'structure_name': existing.get('name', existing_def['name']),
                        'message': f"{existing_def['name']} cannot contain {new_struct_def['name']}"
                    })
            else:
                # Partially overlapping with container boundary
                conflicts.append({
                    'type': 'partial_overlap',
                    'structure_id': existing.get('id'),
                    'structure_name': existing.get('name', existing_def['name']),
                    'message': f"{new_struct_def['name']} partially overlaps container boundary. Must be fully inside or outside."
                })
            continue

        # CASE 2: New structure is a container being placed over existing structures
        if is_container(new_category):
            if check_full_containment(new_struct_bounds, existing_bounds):
                # Check if this container can hold the existing structure
                if can_contain(new_category, existing_category):
                    # Valid: existing structure will be contained
                    warnings.append({
                        'type': 'will_contain',
                        'structure_id': existing.get('id'),
                        'structure_name': existing.get('name', existing_def['name']),
                        'message': f"This {new_struct_def['name']} will contain {existing.get('name', existing_def['name'])}"
                    })
                    continue  # Allow this placement
                else:
                    # Container can't hold this type
                    conflicts.append({
                        'type': 'invalid_containment',
                        'structure_id': existing.get('id'),
                        'structure_name': existing.get('name', existing_def['name']),
                        'message': f"{new_struct_def['name']} cannot contain {existing_def['name']}"
                    })
            else:
                # Partially overlapping
                conflicts.append({
                    'type': 'partial_overlap',
                    'structure_id': existing.get('id'),
                    'structure_name': existing.get('name', existing_def['name']),
                    'message': f"Container partially overlaps {existing.get('name', existing_def['name'])}. Must fully contain or avoid."
                })
            continue

        # CASE 3: Both are regular structures - check collision rules
        if not can_overlap(new_category, existing_category):
            conflicts.append({
                'type': 'overlap',
                'structure_id': existing.get('id'),
                'structure_name': existing.get('name', existing_def['name']),
                'position_x': existing['position_x'],
                'position_y': existing['position_y'],
                'message': f"{new_struct_def['name']} overlaps with {existing.get('name', existing_def['name'])} at ({existing['position_x']}', {existing['position_y']}')"
            })

    return {
        'valid': len(conflicts) == 0,
        'conflicts': conflicts,
        'warnings': warnings
    }
