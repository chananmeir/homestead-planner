# Homestead Structures Database
# All the buildings, facilities, and infrastructure for a working homestead

STRUCTURES_DATABASE = [
    # ========== GROUND COVERINGS (renders below all structures) ==========
    # Mulch - Organic ground coverings
    {
        'id': 'mulch-wood-chips-1',
        'name': 'Wood Chips (10x10)',
        'category': 'ground-covering',
        'width': 10,
        'length': 10,
        'icon': '🪵',
        'color': '#8B7355',
        'description': 'Wood chip mulch area for weed suppression',
        'cost': 25,
        'materials': ['wood chips'],
        'notes': 'Replenish annually. Great for pathways between beds.'
    },
    {
        'id': 'mulch-wood-chips-2',
        'name': 'Wood Chips (15x15)',
        'category': 'ground-covering',
        'width': 15,
        'length': 15,
        'icon': '🪵',
        'color': '#8B7355',
        'description': 'Large wood chip mulch area',
        'cost': 55,
        'materials': ['wood chips'],
        'notes': 'Good for larger zones around trees or play areas.'
    },
    {
        'id': 'mulch-bark-1',
        'name': 'Bark Mulch (10x10)',
        'category': 'ground-covering',
        'width': 10,
        'length': 10,
        'icon': '🌰',
        'color': '#654321',
        'description': 'Decorative bark mulch area',
        'cost': 35,
        'materials': ['bark mulch'],
        'notes': 'Lasts longer than wood chips. More decorative.'
    },
    {
        'id': 'mulch-straw-1',
        'name': 'Straw Mulch (10x10)',
        'category': 'ground-covering',
        'width': 10,
        'length': 10,
        'icon': '🌾',
        'color': '#F0E68C',
        'description': 'Straw mulch for vegetable gardens',
        'cost': 15,
        'materials': ['straw'],
        'notes': 'Great for vegetable gardens. Breaks down in 1 season.'
    },

    # Gravel & Stone - Permanent ground coverings
    {
        'id': 'gravel-pad-1',
        'name': 'Gravel Pad (12x12)',
        'category': 'ground-covering',
        'width': 12,
        'length': 12,
        'icon': '🪨',
        'color': '#C0C0C0',
        'description': 'Gravel pad for parking or equipment storage',
        'cost': 180,
        'materials': ['gravel', 'landscape fabric'],
        'notes': 'Permanent surface. Good drainage.'
    },
    {
        'id': 'gravel-pad-2',
        'name': 'Gravel Pad (15x15)',
        'category': 'ground-covering',
        'width': 15,
        'length': 15,
        'icon': '🪨',
        'color': '#C0C0C0',
        'description': 'Large gravel pad',
        'cost': 280,
        'materials': ['gravel', 'landscape fabric'],
        'notes': 'Ideal for vehicle parking or large equipment.'
    },
    {
        'id': 'river-rock-1',
        'name': 'River Rock (10x10)',
        'category': 'ground-covering',
        'width': 10,
        'length': 10,
        'icon': '🪨',
        'color': '#B0B0B0',
        'description': 'Decorative river rock area',
        'cost': 200,
        'materials': ['river rock', 'landscape fabric'],
        'notes': 'Beautiful decorative stone. Low maintenance.'
    },

    # Grass & Lawn - Living ground covers
    {
        'id': 'lawn-area-1',
        'name': 'Lawn Area (20x20)',
        'category': 'ground-covering',
        'width': 20,
        'length': 20,
        'icon': '🌿',
        'color': '#90EE90',
        'description': 'Mowed lawn or turf grass area',
        'cost': 50,
        'materials': ['grass seed', 'topsoil'],
        'notes': 'Requires regular mowing. Good for kids/pets.'
    },
    {
        'id': 'lawn-area-2',
        'name': 'Lawn Area (30x30)',
        'category': 'ground-covering',
        'width': 30,
        'length': 30,
        'icon': '🌿',
        'color': '#90EE90',
        'description': 'Large lawn or turf grass area',
        'cost': 110,
        'materials': ['grass seed', 'topsoil'],
        'notes': 'Large play or gathering area.'
    },
    {
        'id': 'meadow-1',
        'name': 'Meadow/Wildflower (15x15)',
        'category': 'ground-covering',
        'width': 15,
        'length': 15,
        'icon': '🌼',
        'color': '#98FB98',
        'description': 'Wildflower meadow or unmowed grass',
        'cost': 30,
        'materials': ['wildflower seed mix'],
        'notes': 'Low maintenance. Great for pollinators.'
    },

    # Hardscape - Permanent hard surfaces
    {
        'id': 'concrete-pad-1',
        'name': 'Concrete Pad (10x10)',
        'category': 'ground-covering',
        'width': 10,
        'length': 10,
        'icon': '⬜',
        'color': '#808080',
        'description': 'Poured concrete slab',
        'cost': 500,
        'materials': ['concrete', 'rebar'],
        'notes': 'Permanent. Good for sheds or equipment.'
    },
    {
        'id': 'concrete-pad-2',
        'name': 'Concrete Pad (12x12)',
        'category': 'ground-covering',
        'width': 12,
        'length': 12,
        'icon': '⬜',
        'color': '#808080',
        'description': 'Large concrete slab',
        'cost': 720,
        'materials': ['concrete', 'rebar'],
        'notes': 'Heavy-duty surface for vehicles or structures.'
    },
    {
        'id': 'paver-patio-1',
        'name': 'Paver Patio (12x12)',
        'category': 'ground-covering',
        'width': 12,
        'length': 12,
        'icon': '🔲',
        'color': '#A9A9A9',
        'description': 'Decorative paver patio',
        'cost': 600,
        'materials': ['pavers', 'sand', 'gravel'],
        'notes': 'Attractive outdoor living space.'
    },

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
        'category': 'building',
        'width': 12,
        'length': 16,
        'icon': '🏠',
        'color': '#8B0000',
        'description': 'Small barn for feed, hay, and livestock',
        'cost': 3000,
        'materials': ['lumber', 'metal roofing', 'foundation', 'doors'],
        'notes': 'Multi-purpose. Can house goats, feed, hay.'
    },

    # ========== BUILDINGS ==========
    {
        'id': 'house-small-1',
        'name': 'Small House (20x30)',
        'category': 'building',
        'width': 20,
        'length': 30,
        'icon': '🏡',
        'color': '#DAA520',
        'description': 'Small residential house or cottage',
        'cost': 50000,
        'materials': ['foundation', 'lumber', 'roofing', 'windows', 'doors', 'insulation', 'siding'],
        'notes': 'Represents main dwelling or guest house.'
    },
    {
        'id': 'house-medium-1',
        'name': 'Medium House (30x40)',
        'category': 'building',
        'width': 30,
        'length': 40,
        'icon': '🏡',
        'color': '#CD853F',
        'description': 'Standard residential house',
        'cost': 100000,
        'materials': ['foundation', 'lumber', 'roofing', 'windows', 'doors', 'insulation', 'siding'],
        'notes': 'Main family dwelling.'
    },
    {
        'id': 'barn-large-1',
        'name': 'Large Barn (24x32)',
        'category': 'building',
        'width': 24,
        'length': 32,
        'icon': '🏠',
        'color': '#A52A2A',
        'description': 'Large barn for livestock, equipment, and hay storage',
        'cost': 8000,
        'materials': ['lumber', 'metal roofing', 'foundation', 'large doors', 'loft'],
        'notes': 'Can house multiple animals, tractors, and feed.'
    },
    {
        'id': 'garage-2car-1',
        'name': 'Garage (20x20)',
        'category': 'building',
        'width': 20,
        'length': 20,
        'icon': '🚗',
        'color': '#696969',
        'description': 'Two-car garage',
        'cost': 5000,
        'materials': ['foundation', 'lumber', 'roofing', 'garage doors'],
        'notes': 'Can store vehicles or equipment.'
    },
    {
        'id': 'workshop-1',
        'name': 'Workshop (16x20)',
        'category': 'building',
        'width': 16,
        'length': 20,
        'icon': '🔧',
        'color': '#708090',
        'description': 'Workshop for repairs and projects',
        'cost': 4000,
        'materials': ['lumber', 'roofing', 'windows', 'door', 'electrical', 'workbench'],
        'notes': 'Dedicated space for woodworking, repairs, and fabrication.'
    },
    {
        'id': 'cabin-1',
        'name': 'Cabin/Tiny House (12x20)',
        'category': 'building',
        'width': 12,
        'length': 20,
        'icon': '🛖',
        'color': '#8B7355',
        'description': 'Small cabin or tiny house',
        'cost': 15000,
        'materials': ['foundation', 'lumber', 'roofing', 'windows', 'door', 'insulation'],
        'notes': 'Guest house, off-grid shelter, or rental unit.'
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
        'id': 'cherry-1',
        'name': 'Cherry Tree',
        'category': 'orchard',
        'width': 18,
        'length': 18,
        'icon': '🍒',
        'color': '#DC143C',
        'description': 'Cherry tree (Prunus avium) - sweet cherry',
        'cost': 55,
        'materials': ['tree', 'stakes', 'mulch', 'bird netting'],
        'notes': 'Needs 15-20 ft spacing. First harvest year 3-7. Requires 700-1200 chill hours. Birds love cherries - netting recommended. Productive 15-30 years.'
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

    # ========== MAPLE TREES (for Syrup Production) ==========
    {
        'id': 'sugar-maple',
        'name': 'Sugar Maple',
        'category': 'orchard',
        'width': 30,
        'length': 30,
        'icon': '🍁',
        'color': '#8B4513',
        'description': 'Sugar maple (Acer saccharum) - best for syrup production',
        'cost': 75,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Requires 10-12" diameter for tapping. Can support 1-4 taps depending on size.'
    },
    {
        'id': 'red-maple',
        'name': 'Red Maple',
        'category': 'orchard',
        'width': 25,
        'length': 25,
        'icon': '🍁',
        'color': '#A0522D',
        'description': 'Red maple (Acer rubrum) - lower sugar content but tappable',
        'cost': 65,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Produces more sap with lower sugar content (2% vs 2.5% for sugar maple).'
    },
    {
        'id': 'black-maple',
        'name': 'Black Maple',
        'category': 'orchard',
        'width': 30,
        'length': 30,
        'icon': '🍁',
        'color': '#654321',
        'description': 'Black maple (Acer nigrum) - similar to sugar maple',
        'cost': 75,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Comparable to sugar maple for syrup production.'
    },
    {
        'id': 'box-elder-maple',
        'name': 'Box Elder Maple',
        'category': 'orchard',
        'width': 25,
        'length': 25,
        'icon': '🍁',
        'color': '#8B7355',
        'description': 'Box elder (Acer negundo) - tappable but lowest sugar content',
        'cost': 50,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Lower sugar content (1.5-2%). Requires more sap per gallon of syrup. Fast-growing.'
    },

    # ========== FRUIT TREES ==========
    {
        'id': 'apple-1',
        'name': 'Apple Tree',
        'category': 'orchard',
        'width': 20,
        'length': 20,
        'icon': '🍎',
        'color': '#DC143C',
        'description': 'Apple tree (Malus domestica) - standard or semi-dwarf',
        'cost': 60,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Space 15-20ft. First harvest year 4-6. Requires 800-1000 chill hours. Needs cross-pollination - plant 2+ varieties. Productive 30-50 years.'
    },
    {
        'id': 'pear-1',
        'name': 'Pear Tree',
        'category': 'orchard',
        'width': 20,
        'length': 20,
        'icon': '🍐',
        'color': '#9ACD32',
        'description': 'Pear tree (Pyrus communis) - European pear',
        'cost': 60,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Space 15-20ft. First harvest year 4-7. Needs cross-pollination. Fire blight susceptible. Long-lived (50-75 years).'
    },
    {
        'id': 'plum-1',
        'name': 'Plum Tree',
        'category': 'orchard',
        'width': 20,
        'length': 20,
        'icon': '🍑',
        'color': '#8E4585',
        'description': 'Plum tree (Prunus domestica) - European or Japanese',
        'cost': 55,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Space 15-20ft. First harvest year 3-6. European plums self-fertile, Japanese need cross-pollination. Heavy bearer - thin fruit. Productive 15-25 years.'
    },
    {
        'id': 'peach-1',
        'name': 'Peach Tree',
        'category': 'orchard',
        'width': 17,
        'length': 17,
        'icon': '🍑',
        'color': '#FFDAB9',
        'description': 'Peach tree (Prunus persica)',
        'cost': 50,
        'materials': ['tree', 'stakes', 'mulch', 'copper spray'],
        'notes': 'Space 15-17ft. First harvest year 2-4. SELF-FERTILE. Requires 600-900 chill hours. Peach leaf curl disease - spray copper. Short-lived (15-20 years) but productive.'
    },
    {
        'id': 'apricot-1',
        'name': 'Apricot Tree',
        'category': 'orchard',
        'width': 17,
        'length': 17,
        'icon': '🍑',
        'color': '#FBCEB1',
        'description': 'Apricot tree (Prunus armeniaca)',
        'cost': 55,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Space 15-17ft. First harvest year 3-4. SELF-FERTILE. Blooms very early - spring frost risk. Excellent for drying. Productive 20-30 years.'
    },
    {
        'id': 'fig-1',
        'name': 'Fig Tree',
        'category': 'orchard',
        'width': 15,
        'length': 15,
        'icon': '🫐',
        'color': '#8B4789',
        'description': 'Fig tree (Ficus carica)',
        'cost': 50,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Space 12-15ft. First harvest year 1-2 - FASTEST bearing fruit tree. SELF-FERTILE. Excellent for containers. Brown Turkey, Chicago Hardy cold-hardy varieties. 2 crops/year in warm climates.'
    },
    {
        'id': 'persimmon-1',
        'name': 'Persimmon Tree',
        'category': 'orchard',
        'width': 20,
        'length': 20,
        'icon': '🍅',
        'color': '#EC5800',
        'description': 'Persimmon tree (Diospyros virginiana) - American native',
        'cost': 55,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Space 15-20ft. First harvest year 4-6. VERY cold hardy (to -25F). Dioecious - need male + female for fruit (or self-fertile varieties). Easy to grow, drought-tolerant, pest-free. Productive 50+ years.'
    },
    {
        'id': 'mulberry-1',
        'name': 'Mulberry Tree',
        'category': 'orchard',
        'width': 25,
        'length': 25,
        'icon': '🫐',
        'color': '#4B0082',
        'description': 'Mulberry tree (Morus alba/rubra/nigra)',
        'cost': 50,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Space 20-25ft. First harvest year 2-5 - VERY FAST bearing. SELF-FERTILE. Fast-growing (3-5ft/year), extremely productive. Drought-tolerant, pest-free, low maintenance. Long harvest season (4-6 weeks).'
    },

    # ========== CITRUS TREES ==========
    {
        'id': 'lemon-1',
        'name': 'Lemon Tree',
        'category': 'orchard',
        'width': 15,
        'length': 15,
        'icon': '🍋',
        'color': '#FFF44F',
        'description': 'Lemon tree (Citrus limon) - Meyer or Eureka',
        'cost': 60,
        'materials': ['tree', 'stakes', 'mulch', 'fertilizer'],
        'notes': 'Space 12-15ft. First harvest year 3-5. Zones 9-11 (8b with protection). SELF-FERTILE. Excellent for containers. Frost damage at 28-30F - bring indoors in winter. Continuous blooming and fruiting. Productive 30-50 years.'
    },
    {
        'id': 'lime-1',
        'name': 'Lime Tree',
        'category': 'orchard',
        'width': 15,
        'length': 15,
        'icon': '🍋',
        'color': '#BFFF00',
        'description': 'Lime tree (Citrus aurantiifolia/latifolia) - Key or Persian',
        'cost': 60,
        'materials': ['tree', 'stakes', 'mulch', 'fertilizer'],
        'notes': 'Space 12-15ft. First harvest year 3-4. Zones 9-11. SELF-FERTILE. Excellent for containers (8-10ft). Most cold-sensitive citrus - frost damage at 32F. Bears fruit year-round in ideal conditions. Productive 20-40 years.'
    },
    {
        'id': 'orange-1',
        'name': 'Orange Tree',
        'category': 'orchard',
        'width': 20,
        'length': 20,
        'icon': '🍊',
        'color': '#FFA500',
        'description': 'Orange tree (Citrus sinensis) - Navel or Valencia',
        'cost': 65,
        'materials': ['tree', 'stakes', 'mulch', 'fertilizer'],
        'notes': 'Space 15-20ft. First harvest year 3-6. Zones 9-11 (8b with protection). SELF-FERTILE. Frost damage at 26-28F. Navel oranges for eating, Valencia for juice. Long fruit development (9-12 months on tree). Productive 50-80 years.'
    },

    # ========== NUT TREES ==========
    {
        'id': 'almond-1',
        'name': 'Almond Tree',
        'category': 'orchard',
        'width': 20,
        'length': 20,
        'icon': '🌰',
        'color': '#D2B48C',
        'description': 'Almond tree (Prunus dulcis)',
        'cost': 65,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Space 15-20ft. First harvest year 5-6. Requires 200-400 chill hours. Needs cross-pollination - plant 2+ varieties. Blooms VERY early - spring frost risk. Best in California/arid West. Drought-tolerant. Productive 25-30 years.'
    },
    {
        'id': 'walnut-1',
        'name': 'Walnut Tree',
        'category': 'orchard',
        'width': 40,
        'length': 40,
        'icon': '🌰',
        'color': '#654321',
        'description': 'Walnut tree (Juglans regia/nigra) - English or Black',
        'cost': 70,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Space 35-40ft. First harvest year 6-10. ALLELOPATHIC - juglone toxin kills tomatoes, apples, many plants. Massive tree (40-60ft). English walnut self-fertile. Productive 50-100+ years. Valuable timber tree.'
    },
    {
        'id': 'pecan-1',
        'name': 'Pecan Tree',
        'category': 'orchard',
        'width': 40,
        'length': 40,
        'icon': '🌰',
        'color': '#8B7355',
        'description': 'Pecan tree (Carya illinoinensis)',
        'cost': 70,
        'materials': ['tree', 'stakes', 'mulch'],
        'notes': 'Space 35-40ft. First harvest year 6-10. Needs cross-pollination - plant 2+ varieties. Long growing season required (200+ days). Massive tree (70-100ft). Deep taproot - needs deep soil. Alternate bearing. Productive 50-100+ years.'
    },
    {
        'id': 'hazelnut-1',
        'name': 'Hazelnut',
        'category': 'orchard',
        'width': 15,
        'length': 15,
        'icon': '🌰',
        'color': '#A0522D',
        'description': 'Hazelnut (Corylus avellana) - filbert',
        'cost': 50,
        'materials': ['plants', 'stakes', 'mulch'],
        'notes': 'Space 12-15ft. First harvest year 2-5 - FAST for a nut. Needs cross-pollination - plant 2+ varieties. Multi-stemmed shrub (12-15ft). Eastern Filbert Blight resistant varieties essential in humid climates. Productive 40-50 years.'
    },

    # ========== BERRY SHRUBS ==========
    {
        'id': 'grape-1',
        'name': 'Grape Vine',
        'category': 'orchard',
        'width': 8,
        'length': 8,
        'icon': '🍇',
        'color': '#6F2DA8',
        'description': 'Grape vine (Vitis vinifera) - requires trellis',
        'cost': 40,
        'materials': ['plants', 'trellis', 'stakes'],
        'notes': 'Space 6-8ft on trellis. First harvest year 3. Requires sturdy support structure. Prune annually in late winter. Can be productive for 50+ years. Versatile - fresh eating, juice, wine, raisins.'
    },
    {
        'id': 'currant-1',
        'name': 'Currant',
        'category': 'orchard',
        'width': 4,
        'length': 4,
        'icon': '🫐',
        'color': '#DC143C',
        'description': 'Currant (Ribes rubrum) - red or black',
        'cost': 35,
        'materials': ['plants', 'mulch'],
        'notes': 'Space 3-4ft. First harvest year 2-3. Red and black varieties available. Tolerates partial shade. High in vitamin C. Productive for 15-20 years. Note: White pine blister rust host in some areas.'
    },
    {
        'id': 'gooseberry-1',
        'name': 'Gooseberry',
        'category': 'orchard',
        'width': 4,
        'length': 4,
        'icon': '🫐',
        'color': '#9ACD32',
        'description': 'Gooseberry (Ribes uva-crispa)',
        'cost': 35,
        'materials': ['plants', 'mulch'],
        'notes': 'Space 3-4ft. First harvest year 2-3. Green, red, or yellow varieties. Tolerates partial shade. Thorny canes on most varieties. Very cold hardy. Productive for 15-20 years.'
    },
    {
        'id': 'elderberry-1',
        'name': 'Elderberry',
        'category': 'orchard',
        'width': 6,
        'length': 6,
        'icon': '🫐',
        'color': '#4B0082',
        'description': 'Elderberry (Sambucus nigra)',
        'cost': 40,
        'materials': ['plants', 'mulch'],
        'notes': 'Space 5-6ft. First harvest year 2-3. Medicinal value - immune support, antiviral. Plant 2+ varieties for pollination. Grows 6-12 feet tall. Flowers and berries edible (cook berries first). Productive for 30+ years.'
    },
    {
        'id': 'honeyberry-1',
        'name': 'Honeyberry',
        'category': 'orchard',
        'width': 4,
        'length': 4,
        'icon': '🫐',
        'color': '#4169E1',
        'description': 'Honeyberry (Lonicera caerulea) - haskap',
        'cost': 40,
        'materials': ['plants', 'mulch', 'netting'],
        'notes': 'Space 3-4ft. First harvest year 2-3. SUPER HARDY (to -55F). Needs cross-pollination - plant 2+ varieties. Compact shrub (4-6ft). Blooms and fruits VERY early (before strawberries). Blueberry-raspberry flavor. Productive 30-50 years.'
    },
    {
        'id': 'goji-1',
        'name': 'Goji Berry',
        'category': 'orchard',
        'width': 4,
        'length': 4,
        'icon': '🫐',
        'color': '#FF4500',
        'description': 'Goji berry (Lycium barbarum) - wolfberry',
        'cost': 35,
        'materials': ['plants', 'mulch'],
        'notes': 'Space 3-4ft. First harvest year 2-3. SELF-FERTILE. Vigorous shrub (6-10ft), can be invasive - plant with caution. Drought-tolerant, alkaline soil tolerant. Long harvest season (June-October). Superfood - high antioxidants. Productive 15-20 years.'
    },
    {
        'id': 'aronia-1',
        'name': 'Aronia',
        'category': 'orchard',
        'width': 4,
        'length': 4,
        'icon': '🫐',
        'color': '#2F4F4F',
        'description': 'Aronia (Aronia melanocarpa) - black chokeberry',
        'cost': 35,
        'materials': ['plants', 'mulch'],
        'notes': 'Space 3-4ft. First harvest year 2-3. North American native, extremely hardy (to -40F). SELF-FERTILE. Compact shrub (3-6ft). Highest antioxidant content of any fruit (3x blueberries). Best for juice, jam, dried. Productive 20-40 years.'
    },
    {
        'id': 'serviceberry-1',
        'name': 'Serviceberry',
        'category': 'orchard',
        'width': 6,
        'length': 6,
        'icon': '🫐',
        'color': '#8B4789',
        'description': 'Serviceberry (Amelanchier alnifolia) - Saskatoon',
        'cost': 45,
        'materials': ['plants', 'mulch', 'netting'],
        'notes': 'Space 5-6ft. First harvest year 2-4. North American native, extremely adaptable. SELF-FERTILE (cross-pollination increases yield). Multi-stemmed shrub (6-20ft). Beautiful spring flowers, sweet blueberry-like fruit. Birds love them. Productive 30-50 years.'
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
    'ground-covering': {'name': 'Ground Coverings', 'color': '#D2B48C'},  # Renders below all other structures
    'garden': {'name': 'Garden Beds', 'color': '#8B4513'},
    'structures': {'name': 'Greenhouses & Hoophouses', 'color': '#87CEEB'},
    'compost': {'name': 'Composting Systems', 'color': '#654321'},
    'livestock': {'name': 'Livestock & Poultry', 'color': '#CD853F'},
    'storage': {'name': 'Sheds & Storage', 'color': '#696969'},
    'building': {'name': 'Buildings', 'color': '#8B4513'},
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
