"""
Collision detection rules for structure placement.

Defines which structure categories can overlap and container relationships.
"""

# Category-based collision rules
COLLISION_RULES = {
    'ground-covering': {
        # Mulch, gravel, grass, hardscape - renders below all other structures
        'is_container': False,
        'can_overlap': '*',  # Special: can overlap with everything (like infrastructure)
        'must_not_overlap': []  # No restrictions
    },
    'structures': {
        # Greenhouses, barns, hoop houses - large enclosures
        'is_container': True,
        'allowed_children': ['garden', 'compost', 'water'],  # Can contain these categories
        'can_overlap': ['infrastructure', 'ground-covering'],  # Can overlap with paths/fences and ground coverings
        'must_not_overlap': ['structures', 'livestock', 'storage', 'orchard']  # Cannot overlap with these
    },
    'garden': {
        # Raised beds, in-ground beds, etc.
        'is_container': False,
        'can_overlap': ['infrastructure'],
        'must_not_overlap': ['garden', 'livestock', 'storage', 'compost', 'water', 'orchard']
    },
    'livestock': {
        # Chicken coops, beehives, duck ponds, runs
        'is_container': False,
        'can_overlap': ['infrastructure'],
        'must_not_overlap': ['livestock', 'garden', 'storage', 'compost', 'water', 'orchard']
    },
    'storage': {
        # Tool sheds, barns (small ones that aren't containers)
        'is_container': False,
        'can_overlap': ['infrastructure'],
        'must_not_overlap': ['storage', 'garden', 'livestock', 'compost', 'water', 'orchard']
    },
    'compost': {
        # 3-bin systems, tumblers, worm bins
        'is_container': False,
        'can_overlap': ['infrastructure'],
        'must_not_overlap': ['compost', 'garden', 'livestock', 'storage', 'water', 'orchard']
    },
    'water': {
        # Rain barrels, IBC totes, wells
        'is_container': False,
        'can_overlap': ['infrastructure'],
        'must_not_overlap': ['water', 'garden', 'livestock', 'storage', 'compost', 'orchard']
    },
    'orchard': {
        # Fruit trees, berry patches - need spacing
        'is_container': False,
        'can_overlap': ['infrastructure'],
        'must_not_overlap': ['orchard', 'garden', 'livestock', 'storage', 'compost', 'water']
    },
    'infrastructure': {
        # Pathways, fences, gates - ground level, can go anywhere
        'is_container': False,
        'can_overlap': '*',  # Special: can overlap with everything
        'must_not_overlap': []
    }
}


def is_container(category):
    """Check if a structure category can contain other structures."""
    rules = COLLISION_RULES.get(category, {})
    return rules.get('is_container', False)


def can_overlap(category_a, category_b):
    """Check if two structure categories are allowed to overlap."""
    # Infrastructure and ground-covering special cases - can overlap with anything
    if category_a == 'infrastructure' or category_b == 'infrastructure':
        return True
    if category_a == 'ground-covering' or category_b == 'ground-covering':
        return True

    rules_a = COLLISION_RULES.get(category_a, {})

    # Check if category_a explicitly allows overlap with category_b
    can_overlap_list = rules_a.get('can_overlap', [])
    if can_overlap_list == '*' or category_b in can_overlap_list:
        return True

    # Check if category_a must not overlap with category_b
    must_not_overlap = rules_a.get('must_not_overlap', [])
    if category_b in must_not_overlap:
        return False

    # Default: different categories can overlap unless explicitly forbidden
    return category_a != category_b


def can_contain(container_category, child_category):
    """Check if a container can contain a structure of given category."""
    if not is_container(container_category):
        return False

    rules = COLLISION_RULES.get(container_category, {})
    allowed_children = rules.get('allowed_children', [])

    return child_category in allowed_children


def get_collision_rules(category):
    """Get collision rules for a specific category."""
    return COLLISION_RULES.get(category, {
        'is_container': False,
        'can_overlap': [],
        'must_not_overlap': []
    })
