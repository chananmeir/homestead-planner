# Homestead Structures Database
# All the buildings, facilities, and infrastructure for a working homestead

STRUCTURES_DATABASE = [
    # ========== GARDEN STRUCTURES ==========
    {
        'id': 'raised-bed-1',
        'name': 'Raised Garden Bed (4x8)',
        'category': 'garden',
        'width': 4,  # feet
        'length': 8,  # feet
        'icon': '🟫',
        'color': '#8B4513',
        'description': 'Standard raised bed for vegetables',
        'cost': 150,
        'materials': ['lumber', 'screws', 'soil'],
        'notes': 'Most common size. Easy to reach center from sides.'
    },
    {
        'id': 'raised-bed-2',
        'name': 'Raised Garden Bed (4x4)',
        'category': 'garden',
        'width': 4,
        'length': 4,
        'icon': '🟫',
        'color': '#8B4513',
        'description': 'Square raised bed, great for square foot gardening',
        'cost': 100,
        'materials': ['lumber', 'screws', 'soil'],
        'notes': 'Perfect for square foot gardening method.'
    },
    {
        'id': 'inground-bed-1',
        'name': 'In-Ground Bed (3x10)',
        'category': 'garden',
        'width': 3,
        'length': 10,
        'icon': '🟩',
        'color': '#228B22',
        'description': 'Traditional in-ground garden bed',
        'cost': 20,
        'materials': ['compost', 'mulch'],
        'notes': 'Low cost. Needs regular soil amendment.'
    },
    {
        'id': 'greenhouse-1',
        'name': 'Greenhouse (10x12)',
        'category': 'structures',
        'width': 10,
        'length': 12,
        'icon': '🏠',
        'color': '#87CEEB',
        'description': 'Year-round growing structure',
        'cost': 2000,
        'materials': ['frame', 'polycarbonate', 'foundation'],
        'notes': 'Extends growing season. Needs ventilation and heating.'
    },
    {
        'id': 'hoophouse-1',
        'name': 'Hoop House (12x24)',
        'category': 'structures',
        'width': 12,
        'length': 24,
        'icon': '⛺',
        'color': '#ADD8E6',
        'description': 'Unheated season extension structure',
        'cost': 800,
        'materials': ['PVC pipes', 'plastic sheeting', 'lumber'],
        'notes': 'Eliot Coleman style. Adds 4-6 weeks to season.'
    },
    {
        'id': 'coldframe-1',
        'name': 'Cold Frame (4x4)',
        'category': 'garden',
        'width': 4,
        'length': 4,
        'icon': '📦',
        'color': '#B0C4DE',
        'description': 'Small season extension box with lid',
        'cost': 50,
        'materials': ['lumber', 'old windows', 'hinges'],
        'notes': 'Perfect for starting seeds and hardening off.'
    },

    # ========== COMPOSTING ==========
    {
        'id': 'compost-3bin-1',
        'name': 'Compost System (3-Bin)',
        'category': 'compost',
        'width': 12,
        'length': 4,
        'icon': '♻️',
        'color': '#654321',
        'description': '3-stage composting system',
        'cost': 200,
        'materials': ['lumber', 'wire mesh', 'hinges'],
        'notes': 'Active, curing, and finished compost stages.'
    },
    {
        'id': 'compost-tumbler-1',
        'name': 'Compost Tumbler',
        'category': 'compost',
        'width': 3,
        'length': 3,
        'icon': '🥁',
        'color': '#556B2F',
        'description': 'Rotating compost barrel',
        'cost': 150,
        'materials': ['barrel', 'frame', 'hardware'],
        'notes': 'Fast composting (4-6 weeks). Easy to turn.'
    },
    {
        'id': 'worm-bin-1',
        'name': 'Worm Composting Bin',
        'category': 'compost',
        'width': 2,
        'length': 2,
        'icon': '🪱',
        'color': '#8B4513',
        'description': 'Vermicomposting system',
        'cost': 80,
        'materials': ['bins', 'bedding', 'worms'],
        'notes': 'Great for kitchen scraps. Produces liquid fertilizer.'
    },

    # ========== POULTRY ==========
    {
        'id': 'chicken-coop-small-1',
        'name': 'Chicken Coop (Small 4x6)',
        'category': 'livestock',
        'width': 4,
        'length': 6,
        'icon': '🐔',
        'color': '#CD853F',
        'description': 'Small coop for 4-8 chickens',
        'cost': 600,
        'materials': ['lumber', 'wire mesh', 'roofing', 'nesting boxes'],
        'notes': 'Holds 4-8 birds. Needs 4 sq ft per bird inside.'
    },
    {
        'id': 'chicken-coop-large-1',
        'name': 'Chicken Coop (Large 8x10)',
        'category': 'livestock',
        'width': 8,
        'length': 10,
        'icon': '🐔',
        'color': '#D2691E',
        'description': 'Large coop for 16-20 chickens',
        'cost': 1200,
        'materials': ['lumber', 'wire mesh', 'roofing', 'nesting boxes', 'insulation'],
        'notes': 'Holds 16-20 birds. Include roosts and ventilation.'
    },
    {
        'id': 'chicken-run-1',
        'name': 'Chicken Run (10x20)',
        'category': 'livestock',
        'width': 10,
        'length': 20,
        'icon': '🏃',
        'color': '#F5DEB3',
        'description': 'Fenced outdoor run for chickens',
        'cost': 300,
        'materials': ['posts', 'wire mesh', 'gate'],
        'notes': 'Needs 10 sq ft per bird outside. Cover top for hawks.'
    },
    {
        'id': 'duck-pond-1',
        'name': 'Duck Pond',
        'category': 'livestock',
        'width': 6,
        'length': 8,
        'icon': '🦆',
        'color': '#4682B4',
        'description': 'Small pond for ducks',
        'cost': 400,
        'materials': ['pond liner', 'pump', 'rocks'],
        'notes': 'Ducks need water for health. Change weekly.'
    },

    # ========== STORAGE & TOOLS ==========
    {
        'id': 'tool-shed-small-1',
        'name': 'Tool Shed (6x8)',
        'category': 'storage',
        'width': 6,
        'length': 8,
        'icon': '🏚️',
        'color': '#696969',
        'description': 'Small storage for tools and supplies',
        'cost': 800,
        'materials': ['lumber', 'roofing', 'door', 'shelving'],
        'notes': 'Store tools, seeds, pots, and fertilizer.'
    },
    {
        'id': 'tool-shed-large-1',
        'name': 'Tool Shed (10x12)',
        'category': 'storage',
        'width': 10,
        'length': 12,
        'icon': '🏚️',
        'color': '#808080',
        'description': 'Large storage shed with workspace',
        'cost': 1500,
        'materials': ['lumber', 'roofing', 'door', 'window', 'workbench'],
        'notes': 'Can include potting bench and tool wall.'
    },
    {
        'id': 'barn-small-1',
        'name': 'Small Barn (12x16)',
        'category': 'storage',
        'width': 12,
        'length': 16,
        'icon': '🏠',
        'color': '#8B0000',
        'description': 'Small barn for feed, hay, and livestock',
        'cost': 3000,
        'materials': ['lumber', 'metal roofing', 'foundation', 'doors'],
        'notes': 'Multi-purpose. Can house goats, feed, hay.'
    },

    # ========== WATER SYSTEMS ==========
    {
        'id': 'rain-barrel-1',
        'name': 'Rain Barrel (55 gal)',
        'category': 'water',
        'width': 2,
        'length': 2,
        'icon': '🛢️',
        'color': '#4169E1',
        'description': 'Rainwater collection barrel',
        'cost': 100,
        'materials': ['barrel', 'spigot', 'downspout diverter'],
        'notes': 'Collect 600 gal per inch of rain on 1000 sq ft roof.'
    },
    {
        'id': 'ibc-tote-1',
        'name': 'IBC Water Tote (275 gal)',
        'category': 'water',
        'width': 4,
        'length': 4,
        'icon': '⬜',
        'color': '#1E90FF',
        'description': 'Large water storage tote',
        'cost': 150,
        'materials': ['IBC tote', 'ball valve', 'platform'],
        'notes': 'Industrial storage. Can link multiple together.'
    },
    {
        'id': 'well-1',
        'name': 'Well',
        'category': 'water',
        'width': 3,
        'length': 3,
        'icon': '⭕',
        'color': '#00008B',
        'description': 'Water well',
        'cost': 5000,
        'materials': ['drilling', 'pump', 'plumbing'],
        'notes': 'Expensive but invaluable for homestead.'
    },

    # ========== ORCHARDS & PERENNIALS ==========
    {
        'id': 'fruit-tree-1',
        'name': 'Fruit Tree',
        'category': 'orchard',
        'width': 15,
        'length': 15,
        'icon': '🌳',
        'color': '#228B22',
        'description': 'Standard fruit tree (apple, pear, peach, etc.)',
        'cost': 50,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Needs 15-20 ft spacing. Takes 3-5 years to fruit.'
    },
    {
        'id': 'dwarf-tree-1',
        'name': 'Dwarf Fruit Tree',
        'category': 'orchard',
        'width': 8,
        'length': 8,
        'icon': '🌲',
        'color': '#2E8B57',
        'description': 'Dwarf fruit tree',
        'cost': 60,
        'materials': ['dwarf tree', 'stakes', 'mulch'],
        'notes': 'Needs 8-10 ft spacing. Fruits in 2-3 years.'
    },
    {
        'id': 'berry-patch-1',
        'name': 'Berry Patch (8x12)',
        'category': 'orchard',
        'width': 8,
        'length': 12,
        'icon': '🫐',
        'color': '#6B8E23',
        'description': 'Raspberry, blackberry, or blueberry patch',
        'cost': 200,
        'materials': ['plants', 'trellis', 'mulch', 'netting'],
        'notes': 'Needs support. Protect from birds with netting.'
    },
    {
        'id': 'asparagus-bed-1',
        'name': 'Asparagus Bed (4x10)',
        'category': 'garden',
        'width': 4,
        'length': 10,
        'icon': '🥒',
        'color': '#6B8E23',
        'description': 'Perennial asparagus bed',
        'cost': 100,
        'materials': ['crowns', 'compost', 'mulch'],
        'notes': 'Perennial. Takes 2-3 years. Produces 20+ years.'
    },

    # ========== BEEKEEPING ==========
    {
        'id': 'beehive-1',
        'name': 'Beehive (Langstroth)',
        'category': 'livestock',
        'width': 2,
        'length': 2,
        'icon': '🐝',
        'color': '#FFD700',
        'description': 'Standard beehive',
        'cost': 200,
        'materials': ['hive boxes', 'frames', 'foundation', 'bees'],
        'notes': 'Produces 30-60 lbs honey/year. Pollinates crops.'
    },

    # ========== OTHER ==========
    {
        'id': 'fence-section-1',
        'name': 'Fence Section (8 ft)',
        'category': 'infrastructure',
        'width': 1,
        'length': 8,
        'icon': '🚧',
        'color': '#A0522D',
        'description': '8-foot fence section',
        'cost': 50,
        'materials': ['posts', 'rails', 'wire/boards'],
        'notes': 'Connect multiple sections for enclosures.'
    },
    {
        'id': 'gate-1',
        'name': 'Gate (4 ft)',
        'category': 'infrastructure',
        'width': 1,
        'length': 4,
        'icon': '🚪',
        'color': '#8B4513',
        'description': '4-foot walk-through gate',
        'cost': 100,
        'materials': ['lumber/metal', 'hinges', 'latch'],
        'notes': 'Access point for fenced areas.'
    },
    {
        'id': 'pathway-1',
        'name': 'Pathway/Walkway (3 ft wide)',
        'category': 'infrastructure',
        'width': 3,
        'length': 10,
        'icon': '🛤️',
        'color': '#D3D3D3',
        'description': 'Mulched or gravel pathway',
        'cost': 30,
        'materials': ['mulch/gravel', 'landscape fabric'],
        'notes': 'Prevents mud. Easy access between beds.'
    },
    {
        'id': 'firewood-shed-1',
        'name': 'Firewood Shed (4x8)',
        'category': 'storage',
        'width': 4,
        'length': 8,
        'icon': '🪵',
        'color': '#8B4513',
        'description': 'Open-sided firewood storage',
        'cost': 300,
        'materials': ['posts', 'roofing', 'floor'],
        'notes': 'Holds about 1 cord of wood. Needs airflow.'
    }
]

# Structure categories for filtering
STRUCTURE_CATEGORIES = {
    'garden': {'name': 'Garden Beds', 'color': '#8B4513'},
    'structures': {'name': 'Greenhouses & Hoophouses', 'color': '#87CEEB'},
    'compost': {'name': 'Composting Systems', 'color': '#654321'},
    'livestock': {'name': 'Livestock & Poultry', 'color': '#CD853F'},
    'storage': {'name': 'Sheds & Storage', 'color': '#696969'},
    'water': {'name': 'Water Systems', 'color': '#4169E1'},
    'orchard': {'name': 'Orchards & Perennials', 'color': '#228B22'},
    'infrastructure': {'name': 'Fencing & Paths', 'color': '#A0522D'}
}

def get_structure_by_id(structure_id):
    """Get structure details by ID"""
    for structure in STRUCTURES_DATABASE:
        if structure['id'] == structure_id:
            return structure
    return None

def get_structures_by_category(category):
    """Get all structures in a category"""
    return [s for s in STRUCTURES_DATABASE if s['category'] == category]

def get_all_categories():
    """Get all structure categories"""
    return STRUCTURE_CATEGORIES
