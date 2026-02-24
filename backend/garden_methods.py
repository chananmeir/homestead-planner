"""
Garden Planning Methods Database
Defines different garden planning methodologies with their spacing rules,
planting densities, and bed templates.
"""

# ==================== GARDEN PLANNING METHODS ====================

GARDEN_METHODS = {
    'square-foot': {
        'name': 'Square Foot Gardening (SFG)',
        'description': 'Mel Bartholomew\'s method using 4x4 ft beds divided into 1 ft squares',
        'gridSize': 12,  # inches per cell
        'standardBedSizes': [
            {'width': 4, 'length': 4, 'name': '4x4 Classic SFG'},
            {'width': 4, 'length': 8, 'name': '4x8 Extended SFG'},
            {'width': 3, 'length': 3, 'name': '3x3 Compact SFG'}
        ],
        'benefits': [
            'Maximizes space efficiency',
            'Easy to track plantings',
            'Reduces weeding',
            'Perfect for beginners',
            'Succession planting friendly'
        ],
        'idealFor': 'Small spaces, raised beds, beginners',
        'spacing': 'Per square foot',
        'soilDepth': '6-12 inches minimum'
    },
    'row': {
        'name': 'Row Gardening',
        'description': 'Traditional method with plants in rows and paths between',
        'gridSize': 6,  # inches per cell (flexible)
        'standardBedSizes': [
            {'width': 3, 'length': 10, 'name': '3x10 Row Bed'},
            {'width': 4, 'length': 12, 'name': '4x12 Long Row'},
            {'width': 5, 'length': 20, 'name': '5x20 Traditional Plot'}
        ],
        'benefits': [
            'Easy cultivation and harvest',
            'Good air circulation',
            'Accommodates mechanical tools',
            'Traditional and proven',
            'Good for large plantings'
        ],
        'idealFor': 'Larger spaces, mechanized gardens, traditional gardeners',
        'spacing': 'Row spacing + within-row spacing',
        'pathWidth': '18-24 inches between rows'
    },
    'intensive': {
        'name': 'Intensive/Bio-intensive',
        'description': 'John Jeavons method with hexagonal spacing for maximum density',
        'gridSize': 6,  # inches per cell
        'standardBedSizes': [
            {'width': 4, 'length': 8, 'name': '4x8 Intensive Bed'},
            {'width': 5, 'length': 10, 'name': '5x10 Bio-intensive'},
            {'width': 3, 'length': 6, 'name': '3x6 Compact Intensive'}
        ],
        'benefits': [
            'Maximum yield per square foot',
            'Builds soil health',
            'Water efficient',
            'Creates microclimate',
            'Reduces pests'
        ],
        'idealFor': 'Experienced gardeners, sustainability focused, small plots',
        'spacing': 'Hexagonal/offset pattern',
        'soilDepth': '24 inches deep double-dug beds'
    },
    'migardener': {
        'name': 'MIgardener High-Intensity',
        'description': 'Luke Marion\'s ultra-dense row spacing method for maximum productivity',
        'gridSize': 3,  # inches per cell (finest grid for dense planting)
        'standardBedSizes': [
            {'width': 4, 'length': 8, 'name': '4x8 High-Intensity'},
            {'width': 4, 'length': 12, 'name': '4x12 Long High-Intensity'},
            {'width': 3, 'length': 6, 'name': '3x6 Compact High-Intensity'}
        ],
        'benefits': [
            'Extremely high yields per square foot',
            'Dense planting suppresses weeds naturally',
            'Self-supporting plant canopy',
            'Shades soil to retain moisture',
            'Efficient use of vertical space with trellising'
        ],
        'idealFor': 'Maximum production, experienced gardeners, intensive succession planting',
        'spacing': 'Ultra-dense rows with close within-row spacing',
        'soilDepth': '8-12 inches minimum, well-amended soil',
        'notes': 'Requires frequent succession planting and careful soil management'
    },
    'raised-bed': {
        'name': 'Raised Bed',
        'description': 'Various height raised beds with flexible layouts',
        'gridSize': 6,  # inches per cell
        'standardBedSizes': [
            {'width': 4, 'length': 8, 'name': '4x8 Standard Raised (12" high)'},
            {'width': 3, 'length': 6, 'name': '3x6 Compact Raised (8" high)'},
            {'width': 4, 'length': 4, 'name': '4x4 Square Raised (18" high)'},
            {'width': 2, 'length': 8, 'name': '2x8 Narrow Raised (24" high)'}
        ],
        'benefits': [
            'Better drainage',
            'Warmer soil in spring',
            'Easier on back/knees',
            'Control over soil quality',
            'Extends growing season'
        ],
        'idealFor': 'Poor soil, accessibility needs, season extension',
        'spacing': 'Flexible - use any method inside',
        'heights': ['6-8" low', '12" standard', '18" tall', '24"+ accessible']
    },
    'permaculture': {
        'name': 'Permaculture Zones',
        'description': 'Zone-based planning with perennials and guilds',
        'gridSize': 12,  # inches per cell (larger scale)
        'standardBedSizes': [
            {'width': 6, 'length': 12, 'name': 'Guild Bed (Zone 1)'},
            {'width': 8, 'length': 16, 'name': 'Perennial Bed (Zone 2)'},
            {'width': 10, 'length': 20, 'name': 'Food Forest Plot'}
        ],
        'benefits': [
            'Low maintenance',
            'Perennial abundance',
            'Mimics nature',
            'Wildlife friendly',
            'Resilient ecosystem'
        ],
        'idealFor': 'Long-term planning, perennials, food forests',
        'spacing': 'Mature plant size based',
        'zones': {
            'zone0': 'House/center',
            'zone1': 'Daily harvest (herbs, greens)',
            'zone2': 'Regular care (main garden)',
            'zone3': 'Occasional (orchards, chickens)',
            'zone4': 'Foraging (wild, pasture)',
            'zone5': 'Wilderness (unmanaged)'
        }
    },
    'container': {
        'name': 'Container Gardening',
        'description': 'Pots, buckets, and containers for mobile gardens',
        'gridSize': 12,  # inches per container
        'standardBedSizes': [
            {'width': 2, 'length': 4, 'name': 'Patio Container Area'},
            {'width': 3, 'length': 6, 'name': 'Balcony Container Setup'},
            {'width': 4, 'length': 4, 'name': 'Container Garden Grid'}
        ],
        'benefits': [
            'Ultimate portability',
            'No in-ground soil needed',
            'Patio/balcony friendly',
            'Control environment',
            'Extend season (move indoors)'
        ],
        'idealFor': 'Apartments, renters, patios, mobility',
        'spacing': 'Per container size',
        'containerSizes': ['1 gal', '3 gal', '5 gal', '7 gal', '10 gal', '15 gal', '20+ gal']
    }
}

# ==================== SQUARE FOOT GARDENING SPACING ====================
# How many plants per 1 ft square for SFG method

SFG_SPACING = {
    # 0.5 per square (17" spacing, 2 squares per plant) - Extra-large plants
    0.5: [
        'watermelon', 'melon', 'cantaloupe', 'pumpkin'
    ],

    # 1 per square (12" spacing) - Large plants
    1: [
        'tomato', 'pepper', 'eggplant', 'broccoli', 'cauliflower', 'cabbage',
        'brussels-sprouts', 'kale', 'collards', 'cilantro',
        'squash', 'cucumber', 'okra', 'corn', 'celery',
        'lettuce-head', 'lettuce-crisphead'
    ],

    # 4 per square (6" spacing) - Medium plants
    4: [
        'lettuce', 'lettuce-leaf', 'lettuce-romaine', 'mustard-greens', 'bok-choy',
        'marigold', 'nasturtium', 'zinnia', 'parsley', 'chard',
        'beet', 'onion', 'shallot', 'garlic', 'leek', 'kohlrabi', 'thyme'
    ],

    # 8 per square (4.2" spacing, typically vertical/trellis) - Pole/climbing plants
    8: [
        'pea', 'bean-pole'
    ],

    # 9 per square (4" spacing) - Small plants
    9: [
        'arugula', 'turnip', 'spinach',
        'bush-bean', 'asian-greens', 'scallion'
    ],

    # 16 per square (3" spacing) - Tiny plants
    16: [
        'carrot', 'radish', 'chive'
    ]
}

# ==================== ROW GARDENING SPACING ====================
# Row spacing and within-row spacing in inches

ROW_SPACING = {
    # [row spacing, within-row spacing]
    'tomato': [36, 24],
    'pepper': [24, 18],
    'eggplant': [30, 24],
    'broccoli': [24, 18],
    'cauliflower': [24, 18],
    'cabbage': [24, 18],
    'kale': [18, 12],
    'lettuce': [12, 8],
    'spinach': [12, 4],
    'carrot': [12, 2],
    'beet': [12, 3],
    'radish': [6, 2],
    'bean-bush': [18, 4],
    'bean-pole': [36, 6],
    'pea': [24, 2],
    'corn': [30, 12],
    'squash': [48, 36],
    'cucumber': [48, 18],
    'melon': [60, 24],
    'potato': [30, 12],
    'onion': [12, 4],
    'garlic': [12, 6],
    'basil': [12, 10],
    'parsley': [12, 8]
}

# ==================== INTENSIVE/BIO-INTENSIVE SPACING ====================
# Hexagonal spacing in inches (on-center)

INTENSIVE_SPACING = {
    'tomato': 18,
    'pepper': 12,
    'eggplant': 18,
    'broccoli': 15,
    'cauliflower': 15,
    'cabbage': 15,
    'kale': 12,
    'lettuce': 8,
    'spinach': 6,
    'carrot': 3,
    'beet': 4,
    'radish': 2,
    'bean-bush': 6,
    'bean-pole': 6,
    'pea': 4,
    'corn': 15,
    'squash': 24,
    'cucumber': 12,
    'melon': 18,
    'potato': 10,
    'onion': 4,
    'garlic': 6,
    'basil': 8,
    'parsley': 6,
    'chard': 8,
    'arugula': 4,
    'marigold': 8,
    'nasturtium': 10
}

# ==================== MIGARDENER HIGH-INTENSITY SPACING ====================
# Luke Marion's ultra-dense row spacing method
# Format: [row spacing, within-row spacing] in inches
# Note: Some crops use dense sowing followed by thinning

MIGARDENER_SPACING = {
    # Leafy greens - very dense planting for self-culling and mutual support
    'lettuce': [4, 4],           # Sow ~0.5" apart, thin to 3-4"; rows 3-4" apart
    'lettuce-leaf': [4, 4],      # Dense sowing creates self-supporting canopy
    'spinach': [5, 4],           # 4" within-row, 4-6" between rows

    # Root vegetables - dense sowing, then thin to final spacing
    'carrot': [6, 2],            # Sow densely, thin to 1.5-2" when 3-4 weeks old
    'radish': [4, 1],            # Sow 1" apart, thin to 1-1.5" for proper bulb development (36/sqft)
    'beet': [12, 3],             # 3" for high-density (smaller beets), 4" for larger bulbs

    # Alliums - ultra-dense for maximum yield
    'onion': [4, 4],             # 3-4" on center for medium bulbs, weed suppression
    'garlic': [4, 3],            # 3-3.5" apart is the sweet spot for max plants without overcrowding

    # Beans - closer than traditional methods
    'bean-bush': [18, 5.5],      # Only need 4-7" between plants (not as much space as often thought)
    'bush-bean': [18, 5.5],      # 18" row gap for airflow and harvest access
    'bean-pole': [30, 8],        # 8-10" apart on trellis; 24-36" between trellis rows

    # Peas - extremely dense planting tolerated
    'pea': [60, 1.5],            # Can sow 1-2" apart in 3" wide band at trellis base
                                 # 48-72" between trellised rows for access

    # Fruiting crops - still need airflow but more intensive than traditional
    'tomato': [36, 24],          # 2 ft apart for disease prevention; focus on vertical growth
    'pepper': [21, 14],          # 12-16" apart (14" is middle); 18-24" rows for airflow
}

# ==================== COMPANION PLANTING GUILDS ====================
# Pre-designed plant combinations for permaculture/companion planting

PLANT_GUILDS = {
    'three-sisters': {
        'name': 'Three Sisters Guild',
        'description': 'Native American companion planting: corn, beans, squash',
        'plants': [
            {'id': 'corn-1', 'quantity': 4, 'role': 'Structure for beans'},
            {'id': 'bean-pole-1', 'quantity': 4, 'role': 'Nitrogen fixation'},
            {'id': 'squash-summer-1', 'quantity': 2, 'role': 'Ground cover, weed suppression'}
        ],
        'bedSize': {'width': 4, 'length': 4},
        'method': 'permaculture'
    },
    'tomato-basil-marigold': {
        'name': 'Tomato Protection Guild',
        'description': 'Tomatoes with basil (flavor/pests) and marigolds (nematodes)',
        'plants': [
            {'id': 'tomato-1', 'quantity': 4, 'role': 'Main crop'},
            {'id': 'basil-1', 'quantity': 4, 'role': 'Pest deterrent, flavor enhancer'},
            {'id': 'marigold-1', 'quantity': 8, 'role': 'Nematode control, aphid trap'}
        ],
        'bedSize': {'width': 4, 'length': 4},
        'method': 'square-foot'
    },
    'salad-bowl': {
        'name': 'Perpetual Salad Bowl',
        'description': 'Mixed greens for continuous harvest',
        'plants': [
            {'id': 'lettuce-1', 'quantity': 6, 'role': 'Base green'},
            {'id': 'arugula-1', 'quantity': 4, 'role': 'Spicy green'},
            {'id': 'spinach-1', 'quantity': 4, 'role': 'Nutrient dense'},
            {'id': 'radish-1', 'quantity': 9, 'role': 'Quick harvest, crunch'}
        ],
        'bedSize': {'width': 3, 'length': 3},
        'method': 'square-foot'
    },
    'carrot-onion-defense': {
        'name': 'Root Vegetable Defense',
        'description': 'Carrots and onions deter each other\'s pests',
        'plants': [
            {'id': 'carrot-1', 'quantity': 32, 'role': 'Main crop'},
            {'id': 'onion-1', 'quantity': 18, 'role': 'Carrot fly deterrent'},
            {'id': 'chive-1', 'quantity': 6, 'role': 'Aphid control'}
        ],
        'bedSize': {'width': 4, 'length': 4},
        'method': 'square-foot'
    },
    'herb-spiral': {
        'name': 'Herb Spiral Guild',
        'description': 'Mixed herbs with different water/sun needs',
        'plants': [
            {'id': 'rosemary-1', 'quantity': 1, 'role': 'Top (dry)'},
            {'id': 'thyme-1', 'quantity': 3, 'role': 'Upper (dry)'},
            {'id': 'oregano-1', 'quantity': 2, 'role': 'Middle (moderate)'},
            {'id': 'basil-1', 'quantity': 3, 'role': 'Lower (moist)'},
            {'id': 'parsley-1', 'quantity': 3, 'role': 'Base (moist)'},
            {'id': 'mint-1', 'quantity': 1, 'role': 'Bottom (wet) - contained!'}
        ],
        'bedSize': {'width': 4, 'length': 4},
        'method': 'permaculture'
    },
    'brassica-companion': {
        'name': 'Brassica Companion Guild',
        'description': 'Cabbage family with pest-deterring companions',
        'plants': [
            {'id': 'broccoli-1', 'quantity': 2, 'role': 'Main crop'},
            {'id': 'cauliflower-1', 'quantity': 2, 'role': 'Main crop'},
            {'id': 'nasturtium-1', 'quantity': 6, 'role': 'Aphid trap crop'},
            {'id': 'dill-1', 'quantity': 8, 'role': 'Beneficial insect attractor'}
        ],
        'bedSize': {'width': 4, 'length': 4},
        'method': 'square-foot'
    }
}

# ==================== BED TEMPLATES ====================

BED_TEMPLATES = [
    {
        'id': 'sfg-4x4-beginner',
        'name': 'SFG 4x4 Beginner Mix',
        'method': 'square-foot',
        'bedSize': {'width': 4, 'length': 4},
        'description': 'Perfect first-time square foot garden with easy plants',
        'plants': [
            {'plantId': 'tomato-1', 'position': {'row': 0, 'col': 0}, 'quantity': 1},
            {'plantId': 'pepper-1', 'position': {'row': 0, 'col': 1}, 'quantity': 1},
            {'plantId': 'basil-1', 'position': {'row': 0, 'col': 2}, 'quantity': 1},
            {'plantId': 'marigold-1', 'position': {'row': 0, 'col': 3}, 'quantity': 1},
            {'plantId': 'lettuce-1', 'position': {'row': 1, 'col': 0}, 'quantity': 4},
            {'plantId': 'spinach-1', 'position': {'row': 1, 'col': 1}, 'quantity': 4},
            {'plantId': 'radish-1', 'position': {'row': 1, 'col': 2}, 'quantity': 16},
            {'plantId': 'carrot-1', 'position': {'row': 1, 'col': 3}, 'quantity': 16},
            {'plantId': 'bean-bush-1', 'position': {'row': 2, 'col': 0}, 'quantity': 9},
            {'plantId': 'pea-1', 'position': {'row': 2, 'col': 1}, 'quantity': 9},
            {'plantId': 'onion-1', 'position': {'row': 2, 'col': 2}, 'quantity': 9},
            {'plantId': 'beet-1', 'position': {'row': 2, 'col': 3}, 'quantity': 9},
            {'plantId': 'cucumber-1', 'position': {'row': 3, 'col': 0}, 'quantity': 1},
            {'plantId': 'nasturtium-1', 'position': {'row': 3, 'col': 1}, 'quantity': 4},
            {'plantId': 'arugula-1', 'position': {'row': 3, 'col': 2}, 'quantity': 4},
            {'plantId': 'zinnia-1', 'position': {'row': 3, 'col': 3}, 'quantity': 4}
        ]
    },
    {
        'id': 'sfg-4x4-tomato-heavy',
        'name': 'SFG 4x4 Tomato Lover',
        'method': 'square-foot',
        'bedSize': {'width': 4, 'length': 4},
        'description': 'Maximum tomato production with companions',
        'plants': [
            {'plantId': 'tomato-1', 'position': {'row': 0, 'col': 0}, 'quantity': 1},
            {'plantId': 'tomato-1', 'position': {'row': 0, 'col': 1}, 'quantity': 1},
            {'plantId': 'tomato-cherry-1', 'position': {'row': 0, 'col': 2}, 'quantity': 1},
            {'plantId': 'tomato-cherry-1', 'position': {'row': 0, 'col': 3}, 'quantity': 1},
            {'plantId': 'basil-1', 'position': {'row': 1, 'col': 0}, 'quantity': 1},
            {'plantId': 'basil-1', 'position': {'row': 1, 'col': 1}, 'quantity': 1},
            {'plantId': 'basil-1', 'position': {'row': 1, 'col': 2}, 'quantity': 1},
            {'plantId': 'basil-1', 'position': {'row': 1, 'col': 3}, 'quantity': 1},
            {'plantId': 'marigold-1', 'position': {'row': 2, 'col': 0}, 'quantity': 4},
            {'plantId': 'marigold-1', 'position': {'row': 2, 'col': 1}, 'quantity': 4},
            {'plantId': 'carrot-1', 'position': {'row': 2, 'col': 2}, 'quantity': 16},
            {'plantId': 'onion-1', 'position': {'row': 2, 'col': 3}, 'quantity': 9},
            {'plantId': 'nasturtium-1', 'position': {'row': 3, 'col': 0}, 'quantity': 4},
            {'plantId': 'nasturtium-1', 'position': {'row': 3, 'col': 1}, 'quantity': 4},
            {'plantId': 'parsley-1', 'position': {'row': 3, 'col': 2}, 'quantity': 4},
            {'plantId': 'parsley-1', 'position': {'row': 3, 'col': 3}, 'quantity': 4}
        ]
    },
    {
        'id': 'row-3x10-classic',
        'name': 'Row Garden 3x10 Classic',
        'method': 'row',
        'bedSize': {'width': 3, 'length': 10},
        'description': 'Traditional row garden with walking paths',
        'rows': [
            {'plantId': 'tomato-1', 'rowNumber': 0, 'spacing': 24, 'quantity': 5},
            {'plantId': 'pepper-1', 'rowNumber': 1, 'spacing': 18, 'quantity': 7},
            {'plantId': 'lettuce-1', 'rowNumber': 2, 'spacing': 8, 'quantity': 15}
        ]
    },
    {
        'id': 'intensive-4x8-production',
        'name': 'Intensive 4x8 High Production',
        'method': 'intensive',
        'bedSize': {'width': 4, 'length': 8},
        'description': 'Bio-intensive hexagonal spacing for maximum yield',
        'plants': [
            {'plantId': 'kale-1', 'spacing': 12, 'quantity': 16},
            {'plantId': 'beet-1', 'spacing': 4, 'quantity': 48},
            {'plantId': 'carrot-1', 'spacing': 3, 'quantity': 64},
            {'plantId': 'lettuce-1', 'spacing': 8, 'quantity': 24}
        ]
    },
    {
        'id': 'salad-greens-succession',
        'name': 'Succession Salad Greens',
        'method': 'square-foot',
        'bedSize': {'width': 4, 'length': 8},
        'description': 'Plant 1/4 every 2 weeks for continuous harvest',
        'succession': True,
        'successionInterval': 14,  # days
        'successionPlantings': 4,
        'plants': [
            {'plantId': 'lettuce-1', 'position': {'row': 0, 'col': 0}, 'quantity': 4},
            {'plantId': 'arugula-1', 'position': {'row': 0, 'col': 1}, 'quantity': 4},
            {'plantId': 'spinach-1', 'position': {'row': 0, 'col': 2}, 'quantity': 4},
            {'plantId': 'mustard-greens-1', 'position': {'row': 0, 'col': 3}, 'quantity': 4}
        ]
    }
]

# ==================== HELPER FUNCTIONS ====================

def get_sfg_quantity(plant_id):
    """Get the number of plants per square foot for SFG method"""
    # Try to match plant ID to SFG spacing
    for quantity, plant_list in SFG_SPACING.items():
        for plant_pattern in plant_list:
            if plant_pattern in plant_id:
                return quantity
    # Default: 1 per square for unknown plants
    return 1

def get_row_spacing(plant_id):
    """Get row and within-row spacing for row gardening"""
    # Try to find exact match or partial match
    for plant_key, spacing in ROW_SPACING.items():
        if plant_key in plant_id:
            return {'rowSpacing': spacing[0], 'plantSpacing': spacing[1]}
    # Default spacing for unknown plants
    return {'rowSpacing': 24, 'plantSpacing': 12}

def get_intensive_spacing(plant_id):
    """Get hexagonal spacing for intensive method"""
    for plant_key, spacing in INTENSIVE_SPACING.items():
        if plant_key in plant_id:
            return spacing
    # Default spacing for unknown plants
    return 12

def get_migardener_spacing(plant_id):
    """Get MIgardener high-intensity row and within-row spacing"""
    # Try to find exact match or partial match
    for plant_key, spacing in MIGARDENER_SPACING.items():
        if plant_key in plant_id:
            return {'rowSpacing': spacing[0], 'plantSpacing': spacing[1]}
    # Default spacing for unknown plants (use conservative row method defaults)
    return {'rowSpacing': 18, 'plantSpacing': 8}

def calculate_plants_per_bed(bed_width, bed_length, plant_id, method='square-foot'):
    """Calculate how many plants fit in a bed based on method"""
    bed_area_inches = bed_width * 12 * bed_length * 12

    if method == 'square-foot':
        squares = (bed_width * bed_length)  # Number of 1 ft squares
        per_square = get_sfg_quantity(plant_id)
        return squares * per_square

    elif method == 'row':
        spacing = get_row_spacing(plant_id)
        row_spacing_inches = spacing['rowSpacing']
        plant_spacing_inches = spacing['plantSpacing']

        num_rows = int((bed_width * 12) / row_spacing_inches)
        plants_per_row = int((bed_length * 12) / plant_spacing_inches)
        return num_rows * plants_per_row

    elif method == 'intensive':
        spacing_inches = get_intensive_spacing(plant_id)
        # Hexagonal packing efficiency: 0.866
        plants_per_sq_ft = (144 / (spacing_inches * spacing_inches)) * 0.866
        return int((bed_width * bed_length) * plants_per_sq_ft)

    elif method == 'migardener':
        spacing = get_migardener_spacing(plant_id)
        row_spacing_inches = spacing['rowSpacing']
        plant_spacing_inches = spacing['plantSpacing']

        num_rows = int((bed_width * 12) / row_spacing_inches)
        plants_per_row = int((bed_length * 12) / plant_spacing_inches)
        return num_rows * plants_per_row

    return 1

def get_method_grid_size(method):
    """Get the grid cell size in inches for a given method"""
    return GARDEN_METHODS.get(method, {}).get('gridSize', 12)

def get_guild_by_id(guild_id):
    """Get a plant guild by ID"""
    return PLANT_GUILDS.get(guild_id)

def get_template_by_id(template_id):
    """Get a bed template by ID"""
    for template in BED_TEMPLATES:
        if template['id'] == template_id:
            return template
    return None

def get_methods_list():
    """Get list of all available garden methods"""
    return [
        {
            'id': method_id,
            'name': method_data['name'],
            'description': method_data['description'],
            'idealFor': method_data['idealFor']
        }
        for method_id, method_data in GARDEN_METHODS.items()
    ]
