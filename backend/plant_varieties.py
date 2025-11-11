# Plant Varieties Database
# Common varieties for each plant type to help users track specific cultivars

PLANT_VARIETIES = {
    # Tomatoes
    'tomato-1': [
        'Brandywine',
        'Cherokee Purple',
        'San Marzano',
        'Roma',
        'Beefsteak',
        'Big Boy',
        'Early Girl',
        'Better Boy',
        'Mortgage Lifter',
        'Black Krim'
    ],
    'tomato-cherry-1': [
        'Sun Gold',
        'Sweet 100',
        'Black Cherry',
        'Yellow Pear',
        'Chocolate Cherry',
        'Sweet Million'
    ],

    # Lettuce
    'lettuce-1': [
        'Red Leaf',
        'Green Leaf',
        'Oak Leaf',
        'Buttercrunch',
        'Bibb',
        'Boston',
        'Romaine',
        'Little Gem',
        'Lollo Rosso',
        'Red Sails'
    ],

    # Peppers
    'pepper-bell-1': [
        'California Wonder',
        'King of the North',
        'Yolo Wonder',
        'Bell Boy',
        'Big Bertha',
        'Jupiter'
    ],
    'pepper-hot-1': [
        'Jalapeño',
        'Serrano',
        'Cayenne',
        'Habanero',
        'Thai Hot',
        'Anaheim',
        'Poblano',
        'Ghost Pepper'
    ],

    # Beans
    'bean-bush-1': [
        'Blue Lake',
        'Provider',
        'Contender',
        'Bush Blue Lake',
        'Maxibel',
        'Dragon Tongue'
    ],
    'bean-pole-1': [
        'Kentucky Wonder',
        'Fortex',
        'Romano',
        'Rattlesnake',
        'Scarlet Runner'
    ],

    # Cucumbers
    'cucumber-1': [
        'Marketmore',
        'Straight Eight',
        'Lemon',
        'Armenian',
        'Diva',
        'Suyo Long',
        'Boston Pickling'
    ],

    # Squash
    'squash-summer-1': [
        'Black Beauty Zucchini',
        'Yellow Crookneck',
        'Pattypan',
        'Costata Romanesco',
        'Eight Ball',
        'Tromboncino'
    ],
    'squash-winter-1': [
        'Butternut',
        'Acorn',
        'Delicata',
        'Hubbard',
        'Kabocha',
        'Spaghetti Squash',
        'Blue Hubbard'
    ],

    # Carrots
    'carrot-1': [
        'Nantes',
        'Danvers',
        'Chantenay',
        'Imperator',
        'Purple Dragon',
        'Scarlet Nantes',
        'Cosmic Purple'
    ],

    # Onions
    'onion-1': [
        'Yellow Sweet Spanish',
        'Red Wethersfield',
        'Ailsa Craig',
        'Walla Walla',
        'Copra',
        'Candy'
    ],

    # Kale
    'kale-1': [
        'Lacinato (Dino)',
        'Winterbor',
        'Red Russian',
        'Redbor',
        'Curly',
        'Toscano'
    ],

    # Spinach
    'spinach-1': [
        'Bloomsdale',
        'Space',
        'Tyee',
        'Giant Winter',
        'Renegade',
        'Olympia'
    ],

    # Broccoli
    'broccoli-1': [
        'Calabrese',
        'Waltham',
        'De Cicco',
        'Purple Sprouting',
        'Romanesco'
    ],

    # Cabbage
    'cabbage-1': [
        'Early Jersey Wakefield',
        'Copenhagen Market',
        'Red Acre',
        'Savoy',
        'Danish Ballhead'
    ],

    # Cauliflower
    'cauliflower-1': [
        'Snow Crown',
        'Purple of Sicily',
        'Cheddar',
        'Romanesco',
        'Graffiti'
    ],

    # Eggplant
    'eggplant-1': [
        'Black Beauty',
        'Ichiban',
        'Rosa Bianca',
        'Fairy Tale',
        'Little Finger'
    ],

    # Peas
    'pea-1': [
        'Sugar Snap',
        'Oregon Sugar Pod',
        'Lincoln',
        'Wando',
        'Cascadia',
        'Sugar Ann'
    ],

    # Radish
    'radish-1': [
        'Cherry Belle',
        'French Breakfast',
        'Watermelon',
        'Daikon',
        'Easter Egg',
        'Black Spanish'
    ],

    # Beets
    'beet-1': [
        'Detroit Dark Red',
        'Golden',
        'Chioggia',
        'Cylindra',
        'Bulls Blood'
    ],

    # Swiss Chard
    'chard-1': [
        'Bright Lights',
        'Fordhook Giant',
        'Ruby Red',
        'Rainbow',
        'Lucullus'
    ],

    # Basil
    'basil-1': [
        'Genovese',
        'Sweet',
        'Thai',
        'Purple',
        'Lemon',
        'Cinnamon'
    ],

    # Cilantro
    'cilantro-1': [
        'Santo',
        'Slow Bolt',
        'Calypso',
        'Leisure'
    ],

    # Parsley
    'parsley-1': [
        'Italian Flat Leaf',
        'Curly',
        'Hamburg Root'
    ],

    # Potatoes
    'potato-1': [
        'Yukon Gold',
        'Red Pontiac',
        'Russet Burbank',
        'Kennebec',
        'Purple Majesty',
        'German Butterball',
        'Fingerling'
    ],

    # Corn
    'corn-1': [
        'Silver Queen',
        'Golden Bantam',
        'Bodacious',
        'Peaches and Cream',
        'Ambrosia'
    ],

    # Melons
    'melon-1': [
        'Sugar Baby Watermelon',
        'Crimson Sweet',
        'Cantaloupe Hale\'s Best',
        'Honeydew',
        'Charentais'
    ],

    # Pumpkin
    'pumpkin-1': [
        'Connecticut Field',
        'Sugar Pie',
        'Big Max',
        'Cinderella',
        'Jack O\'Lantern'
    ]
}

def get_varieties_for_plant(plant_id):
    """Get list of common varieties for a plant"""
    return PLANT_VARIETIES.get(plant_id, [])

def get_all_plant_varieties():
    """Get all plant varieties as a dictionary"""
    return PLANT_VARIETIES
