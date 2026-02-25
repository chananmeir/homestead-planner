"""
CSV Variety Import Service

Handles parsing and importing plant variety data from CSV files into the SeedInventory database.
Supports multiple crop types with intelligent plant ID mapping and data transformation.
"""

import csv
import io
import logging
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from plant_database import PLANT_DATABASE
from utils.plant_id_resolver import (
    validate_plant_id as _validate_plant_id,
    validate_and_resolve_plant_id,
    resolve_alias
)

logger = logging.getLogger(__name__)


def validate_plant_id(plant_id: str) -> bool:
    """
    Validate that plant_id exists in PLANT_DATABASE.
    Uses the centralized resolver which handles alias resolution.

    Args:
        plant_id: The plant_id to validate

    Returns:
        bool: True if plant_id exists (directly or via alias), False otherwise
    """
    is_valid, _, _ = validate_and_resolve_plant_id(plant_id)
    return is_valid


# Plant type mapping: CSV type → database plant_id
# Note: Keys are case-insensitive (normalized to lowercase in map_variety_to_plant_id)
LETTUCE_TYPE_MAPPING = {
    'looseleaf': 'lettuce-1',
    'romaine': 'lettuce-1',
    'romaine mini': 'lettuce-1',  # Map mini romaine to regular romaine
    'butterhead': 'lettuce-1',
    'crisphead': 'lettuce-1',
    'summer crisp': 'lettuce-1',
    # Fallback
    'mixed': 'lettuce-1',
}

CARROT_TYPE_MAPPING = {
    'nantes': 'carrot-1',
    'imperator': 'carrot-1',
    'chantenay': 'carrot-1',
    'danvers': 'carrot-1',
    'ball': 'carrot-1',
    'paris market': 'carrot-1',
    # Fallback
    'mixed': 'carrot-1',
}

TOMATO_TYPE_MAPPING = {
    'beefsteak': 'tomato-1',
    'slicing': 'tomato-1',
    'heirloom': 'tomato-1',
    'roma': 'tomato-1',
    'paste': 'tomato-1',
    'cherry': 'tomato-1',
    'grape': 'tomato-1',
    'currant': 'tomato-1',
    # Fallback
    'mixed': 'tomato-1',
}

PEPPER_TYPE_MAPPING = {
    'bell': 'pepper-1',
    'sweet': 'pepper-1',
    'pimento': 'pepper-1',
    'hot': 'pepper-1',
    'jalapeño': 'pepper-1',
    'jalapeno': 'pepper-1',  # Handle accent variation
    'cayenne': 'pepper-1',
    'habanero': 'pepper-1',
    'serrano': 'pepper-1',
    # Fallback
    'mixed': 'pepper-1',
}

BEAN_TYPE_MAPPING = {
    'bush': 'bean-1',
    'dwarf': 'bean-1',
    'pole': 'bean-1',
    'climbing': 'bean-1',
    'runner': 'bean-1',
    # Fallback
    'mixed': 'bean-1',
}

SQUASH_TYPE_MAPPING = {
    'summer': 'squash-1',
    'zucchini': 'squash-1',
    'yellow': 'squash-1',
    'pattypan': 'squash-1',
    'winter': 'squash-1',
    'butternut': 'squash-1',
    'acorn': 'squash-1',
    'hubbard': 'squash-1',
    'delicata': 'squash-1',
    # Fallback
    'mixed': 'squash-1',
}

CUCUMBER_TYPE_MAPPING = {
    'slicing': 'cucumber-1',
    'pickling': 'cucumber-1',
    'burpless': 'cucumber-1',
    'lemon': 'cucumber-1',
    'english': 'cucumber-1',
    # Fallback
    'mixed': 'cucumber-1',
}

PEA_TYPE_MAPPING = {
    'shelling': 'pea-1',
    'english': 'pea-1',
    'garden': 'pea-1',
    'snap': 'pea-1',
    'snow': 'pea-1',
    # Fallback
    'mixed': 'pea-1',
}

BEET_TYPE_MAPPING = {
    'red': 'beet-1',
    'golden': 'beet-1',
    'chioggia': 'beet-1',
    # Fallback
    'mixed': 'beet-1',
}

BURDOCK_TYPE_MAPPING = {
    'gobo': 'burdock-1',
    'takinogawa': 'burdock-1',
    'watanabe': 'burdock-1',
    'common': 'burdock-1',
    'greater': 'burdock-1',
    # Fallback
    'mixed': 'burdock-1',
}

RADISH_TYPE_MAPPING = {
    'round': 'radish-1',
    'french breakfast': 'radish-1',
    'daikon': 'radish-1',
    'watermelon': 'radish-1',
    # Fallback
    'mixed': 'radish-1',
}

RICE_TYPE_MAPPING = {
    'long-grain': 'rice-1',
    'short-grain': 'rice-1',
    'medium-grain': 'rice-1',
    'jasmine': 'rice-1',
    'basmati': 'rice-1',
    'arborio': 'rice-1',
    'brown': 'rice-1',
    'white': 'rice-1',
    # Fallback
    'mixed': 'rice-1',
}

BROCCOLI_TYPE_MAPPING = {
    'calabrese': 'broccoli-1',
    'sprouting': 'broccoli-1',
    'romanesco': 'broccoli-1',
    # Fallback
    'mixed': 'broccoli-1',
}

CAULIFLOWER_TYPE_MAPPING = {
    'white': 'cauliflower-1',
    'purple': 'cauliflower-1',
    'orange': 'cauliflower-1',
    'romanesco': 'cauliflower-1',
    # Fallback
    'mixed': 'cauliflower-1',
}

CABBAGE_TYPE_MAPPING = {
    'green': 'cabbage-1',
    'red': 'cabbage-1',
    'savoy': 'cabbage-1',
    'napa': 'cabbage-1',
    # Fallback
    'mixed': 'cabbage-1',
}

KALE_TYPE_MAPPING = {
    'lacinato': 'kale-1',
    'dinosaur': 'kale-1',
    'curly': 'kale-1',
    'russian': 'kale-1',
    # Fallback
    'mixed': 'kale-1',
}

ENDIVE_TYPE_MAPPING = {
    'frisee': 'endive-1',
    'escarole': 'endive-1',
    'broad-leaved': 'endive-1',
    'curly': 'endive-1',
    # Fallback
    'mixed': 'endive-1',
}

# Herb type mappings (all varieties map to single plant ID)
BASIL_TYPE_MAPPING = {
    'sweet': 'basil-1',
    'genovese': 'basil-1',
    'thai': 'basil-1',
    'purple': 'basil-1',
    'lemon': 'basil-1',
    'cinnamon': 'basil-1',
    'holy': 'basil-1',
    # Fallback
    'mixed': 'basil-1',
}

CILANTRO_TYPE_MAPPING = {
    'standard': 'cilantro-1',
    'slow-bolt': 'cilantro-1',
    'santo': 'cilantro-1',
    'calypso': 'cilantro-1',
    'leisure': 'cilantro-1',
    # Fallback
    'mixed': 'cilantro-1',
}

DATURA_TYPE_MAPPING = {
    'moonflower': 'datura-1',
    'angel-trumpet': 'datura-1',
    'devils-trumpet': 'datura-1',
    'white': 'datura-1',
    'purple': 'datura-1',
    'yellow': 'datura-1',
    # Fallback
    'mixed': 'datura-1',
}

PARSLEY_TYPE_MAPPING = {
    'flat-leaf': 'parsley-1',
    'italian': 'parsley-1',
    'curly': 'parsley-1',
    'hamburg': 'parsley-1',
    'moss-curled': 'parsley-1',
    # Fallback
    'mixed': 'parsley-1',
}

PURPLE_CONEFLOWER_TYPE_MAPPING = {
    'purple': 'purple-coneflower-1',
    'echinacea-purpurea': 'purple-coneflower-1',
    'white': 'purple-coneflower-1',
    'pink': 'purple-coneflower-1',
    'yellow': 'purple-coneflower-1',
    'standard': 'purple-coneflower-1',
    # Fallback
    'mixed': 'purple-coneflower-1',
}

SHASTA_DAISY_TYPE_MAPPING = {
    'alaska': 'shasta-daisy-1',
    'becky': 'shasta-daisy-1',
    'crazy-daisy': 'shasta-daisy-1',
    'snow-lady': 'shasta-daisy-1',
    'silver-princess': 'shasta-daisy-1',
    'standard': 'shasta-daisy-1',
    # Fallback
    'mixed': 'shasta-daisy-1',
}

DILL_TYPE_MAPPING = {
    'bouquet': 'dill-1',
    'mammoth': 'dill-1',
    'fernleaf': 'dill-1',
    'dukat': 'dill-1',
    'superdukat': 'dill-1',
    # Fallback
    'mixed': 'dill-1',
}

OREGANO_TYPE_MAPPING = {
    'greek': 'oregano-1',
    'italian': 'oregano-1',
    'common': 'oregano-1',
    'hot-spicy': 'oregano-1',
    'golden': 'oregano-1',
    # Fallback
    'mixed': 'oregano-1',
}

THYME_TYPE_MAPPING = {
    'common': 'thyme-1',
    'lemon': 'thyme-1',
    'french': 'thyme-1',
    'english': 'thyme-1',
    'creeping': 'thyme-1',
    'caraway': 'thyme-1',
    # Fallback
    'mixed': 'thyme-1',
}

SAGE_TYPE_MAPPING = {
    'common': 'sage-1',
    'purple': 'sage-1',
    'tricolor': 'sage-1',
    'pineapple': 'sage-1',
    'golden': 'sage-1',
    # Fallback
    'mixed': 'sage-1',
}

ROSEMARY_TYPE_MAPPING = {
    'tuscan-blue': 'rosemary-1',
    'arp': 'rosemary-1',
    'prostrate': 'rosemary-1',
    'spice-islands': 'rosemary-1',
    'common': 'rosemary-1',
    # Fallback
    'mixed': 'rosemary-1',
}

MINT_TYPE_MAPPING = {
    'spearmint': 'mint-1',
    'peppermint': 'mint-1',
    'chocolate': 'mint-1',
    'apple': 'mint-1',
    'orange': 'mint-1',
    'pineapple': 'mint-1',
    # Fallback
    'mixed': 'mint-1',
}

MULLEIN_TYPE_MAPPING = {
    'common': 'mullein-1',
    'great': 'mullein-1',
    'moth': 'mullein-1',
    'purple': 'mullein-1',
    'dark': 'mullein-1',
    'olympic': 'mullein-1',
    'verbascum-thapsus': 'mullein-1',
    # Fallback
    'mixed': 'mullein-1',
}

POTATO_TYPE_MAPPING = {
    'russet': 'potato-1',
    'yukon-gold': 'potato-1',
    'red': 'potato-1',
    'fingerling': 'potato-1',
    'purple': 'potato-1',
    'white': 'potato-1',
    'yellow': 'potato-1',
    'kennebec': 'potato-1',
    'norland': 'potato-1',
    'katahdin': 'potato-1',
    'all-blue': 'potato-1',
    'adirondack-blue': 'potato-1',
    'german-butterball': 'potato-1',
    'king-harry': 'potato-1',
    # Fallback
    'mixed': 'potato-1',
}

CORN_TYPE_MAPPING = {
    'sweet': 'corn-1',
    'bi-color': 'corn-1',
    'yellow': 'corn-1',
    'white': 'corn-1',
    'super-sweet': 'corn-1',
    'sugar-enhanced': 'corn-1',
    'standard': 'corn-1',
    'heirloom': 'corn-1',
    'ornamental': 'corn-1',
    'popcorn': 'corn-1',
    'dent': 'corn-1',
    'flint': 'corn-1',
    # Fallback
    'mixed': 'corn-1',
}

AMARANTH_TYPE_MAPPING = {
    # Leaf amaranths
    'leaf': 'amaranth-1',
    'red leaf': 'amaranth-1',
    'green': 'amaranth-1',
    'vegetable': 'amaranth-1',
    # Grain amaranths
    'grain': 'amaranth-1',
    'seed': 'amaranth-1',
    # Fallback
    'mixed': 'amaranth-1',
}

CATNIP_TYPE_MAPPING = {
    'common': 'catnip-1',
    'standard': 'catnip-1',
    'lemon': 'catnip-1',
    'nepeta-cataria': 'catnip-1',
    # Fallback
    'mixed': 'catnip-1',
}

ASPARAGUS_TYPE_MAPPING = {
    'jersey': 'asparagus-1',
    'purple': 'asparagus-1',
    'standard': 'asparagus-1',
    'mary-washington': 'asparagus-1',
    'jersey-giant': 'asparagus-1',
    'purple-passion': 'asparagus-1',
    # Fallback
    'mixed': 'asparagus-1',
}

BRUSSELS_SPROUTS_TYPE_MAPPING = {
    'standard': 'brussels-sprouts-1',
    'long-island': 'brussels-sprouts-1',
    'jade-cross': 'brussels-sprouts-1',
    'diablo': 'brussels-sprouts-1',
    # Fallback
    'mixed': 'brussels-sprouts-1',
}

EGGPLANT_TYPE_MAPPING = {
    'globe': 'eggplant-1',
    'italian': 'eggplant-1',
    'japanese': 'eggplant-1',
    'black-beauty': 'eggplant-1',
    'chinese': 'eggplant-1',
    'white': 'eggplant-1',
    'graffiti': 'eggplant-1',
    'fairy-tale': 'eggplant-1',
    # Fallback
    'mixed': 'eggplant-1',
}

CELERY_TYPE_MAPPING = {
    'standard': 'celery-1',
    'pascal': 'celery-1',
    'utah': 'celery-1',
    'golden': 'celery-1',
    'self-blanching': 'celery-1',
    # Fallback
    'mixed': 'celery-1',
}

SHALLOT_TYPE_MAPPING = {
    'french-red': 'shallot-1',
    'dutch-yellow': 'shallot-1',
    'red': 'shallot-1',
    'yellow': 'shallot-1',
    'ambition': 'shallot-1',
    'conservor': 'shallot-1',
    # Fallback
    'mixed': 'shallot-1',
}

SPINACH_TYPE_MAPPING = {
    'savoy': 'spinach-1',
    'semi-savoy': 'spinach-1',
    'flat-leaf': 'spinach-1',
    'smooth-leaf': 'spinach-1',
    'baby': 'spinach-1',
    'bloomsdale': 'spinach-1',
    'space': 'spinach-1',
    # Fallback
    'mixed': 'spinach-1',
}

SORREL_TYPE_MAPPING = {
    'common': 'sorrel-1',
    'french': 'sorrel-1',
    'garden': 'sorrel-1',
    'red-veined': 'sorrel-1',
    'bloody-dock': 'sorrel-1',
    'large-leaf': 'sorrel-1',
    # Fallback
    'mixed': 'sorrel-1',
}

SHUNGIKU_TYPE_MAPPING = {
    'edible-chrysanthemum': 'shungiku-1',
    'chrysanthemum-greens': 'shungiku-1',
    'crown-daisy': 'shungiku-1',
    'garland-chrysanthemum': 'shungiku-1',
    'large-leaf': 'shungiku-1',
    'small-leaf': 'shungiku-1',
    # Fallback
    'mixed': 'shungiku-1',
}

TURNIP_TYPE_MAPPING = {
    'purple-top': 'turnip-1',
    'white': 'turnip-1',
    'golden': 'turnip-1',
    'tokyo-cross': 'turnip-1',
    'hakurei': 'turnip-1',
    # Fallback
    'mixed': 'turnip-1',
}

COLLARD_GREENS_TYPE_MAPPING = {
    'standard': 'collard-greens-1',
    'georgia': 'collard-greens-1',
    'vates': 'collard-greens-1',
    'champion': 'collard-greens-1',
    # Fallback
    'mixed': 'collard-greens-1',
}

OKRA_TYPE_MAPPING = {
    'standard': 'okra-1',
    'clemson-spineless': 'okra-1',
    'emerald': 'okra-1',
    'burgundy': 'okra-1',
    'dwarf': 'okra-1',
    'spineless': 'okra-1',
    # Fallback
    'mixed': 'okra-1',
}

KOHLRABI_TYPE_MAPPING = {
    'purple': 'kohlrabi-1',
    'white': 'kohlrabi-1',
    'green': 'kohlrabi-1',
    'early-white-vienna': 'kohlrabi-1',
    'azur-star': 'kohlrabi-1',
    # Fallback
    'mixed': 'kohlrabi-1',
}

PUMPKIN_TYPE_MAPPING = {
    'pie': 'pumpkin-1',
    'carving': 'pumpkin-1',
    'miniature': 'pumpkin-1',
    'sugar': 'pumpkin-1',
    'jack-o-lantern': 'pumpkin-1',
    'giant': 'pumpkin-1',
    'white': 'pumpkin-1',
    # Fallback
    'mixed': 'pumpkin-1',
}

BOK_CHOY_TYPE_MAPPING = {
    'standard': 'bok-choy-1',
    'baby': 'bok-choy-1',
    'dwarf': 'bok-choy-1',
    'shanghai': 'bok-choy-1',
    'joi-choi': 'bok-choy-1',
    'win-win': 'bok-choy-1',
    'toy-choy': 'bok-choy-1',
    # Fallback
    'mixed': 'bok-choy-1',
}

CHARD_TYPE_MAPPING = {
    'rainbow': 'chard-1',
    'swiss': 'chard-1',
    'red': 'chard-1',
    'bright-lights': 'chard-1',
    'fordhook-giant': 'chard-1',
    'lucullus': 'chard-1',
    'ruby-red': 'chard-1',
    'five-color-silverbeet': 'chard-1',
    # Fallback
    'mixed': 'chard-1',
}

CANTALOUPE_TYPE_MAPPING = {
    'standard': 'melon-1',
    'hale-best': 'melon-1',
    'hearts-of-gold': 'melon-1',
    'honeydew': 'melon-1',
    'crenshaw': 'melon-1',
    'charentais': 'melon-1',
    'galia': 'melon-1',
    'sugar-cube': 'melon-1',
    'athena': 'melon-1',
    # Fallback
    'mixed': 'melon-1',
}

# Berry/Fruit type mappings
BLACKBERRY_TYPE_MAPPING = {
    'thornless': 'blackberry-1',
    'thorny': 'blackberry-1',
    'trailing': 'blackberry-1',
    'erect': 'blackberry-1',
    'semi-erect': 'blackberry-1',
    'triple-crown': 'blackberry-1',
    'ouachita': 'blackberry-1',
    'navaho': 'blackberry-1',
    # Fallback
    'mixed': 'blackberry-1',
}

GRAPE_TYPE_MAPPING = {
    'table': 'grape-1',
    'wine': 'grape-1',
    'concord': 'grape-1',
    'seedless': 'grape-1',
    'red': 'grape-1',
    'white': 'grape-1',
    'green': 'grape-1',
    'black': 'grape-1',
    # Fallback
    'mixed': 'grape-1',
}

CURRANT_TYPE_MAPPING = {
    'red': 'currant-1',
    'black': 'currant-1',
    'white': 'currant-1',
    'pink': 'currant-1',
    # Fallback
    'mixed': 'currant-1',
}

GOOSEBERRY_TYPE_MAPPING = {
    'green': 'gooseberry-1',
    'red': 'gooseberry-1',
    'yellow': 'gooseberry-1',
    'invicta': 'gooseberry-1',
    'hinnonmaki': 'gooseberry-1',
    # Fallback
    'mixed': 'gooseberry-1',
}

ELDERBERRY_TYPE_MAPPING = {
    'american': 'elderberry-1',
    'european': 'elderberry-1',
    'black': 'elderberry-1',
    'york': 'elderberry-1',
    'adams': 'elderberry-1',
    # Fallback
    'mixed': 'elderberry-1',
}

# Additional culinary/medicinal herbs
FENNEL_TYPE_MAPPING = {
    'florence': 'fennel-1',
    'bronze': 'fennel-1',
    'sweet': 'fennel-1',
    'common': 'fennel-1',
    'bulbing': 'fennel-1',
    'herb': 'fennel-1',
    # Fallback
    'mixed': 'fennel-1',
}

LAVENDER_TYPE_MAPPING = {
    'english': 'lavender-1',
    'angustifolia': 'lavender-1',
    'munstead': 'lavender-1',
    'hidcote': 'lavender-1',
    'vera': 'lavender-1',
    'common': 'lavender-1',
    # Fallback
    'mixed': 'lavender-1',
}

LEMON_BALM_TYPE_MAPPING = {
    'common': 'lemon-balm-1',
    'standard': 'lemon-balm-1',
    'variegated': 'lemon-balm-1',
    'gold-leaf': 'lemon-balm-1',
    'lime': 'lemon-balm-1',
    # Fallback
    'mixed': 'lemon-balm-1',
}

MARIGOLD_TYPE_MAPPING = {
    'french': 'marigold-1',
    'african': 'marigold-1',
    'signet': 'marigold-1',
    'common': 'marigold-1',
    # Fallback
    'mixed': 'marigold-1',
}

MARJORAM_TYPE_MAPPING = {
    'sweet': 'marjoram-1',
    'common': 'marjoram-1',
    'pot': 'marjoram-1',
    'wild': 'marjoram-1',
    'italian': 'marjoram-1',
    # Fallback
    'mixed': 'marjoram-1',
}

MELON_TYPE_MAPPING = {
    # Honeydew varieties
    'honeydew': 'melon-1',
    'honeydew melon': 'melon-1',
    'melon – honeydew melon': 'melon-1',
    # Canary varieties
    'canary': 'melon-1',
    'canary melon': 'melon-1',
    'melon – canary melon': 'melon-1',
    # Casaba varieties
    'casaba': 'melon-1',
    'casaba melon': 'melon-1',
    'melon – casaba melon': 'melon-1',
    # Crenshaw varieties
    'crenshaw': 'melon-1',
    'crenshaw melon': 'melon-1',
    'melon – crenshaw melon': 'melon-1',
    # Piel de Sapo
    'piel de sapo': 'melon-1',
    'melon – piel de sapo': 'melon-1',
    # Muskmelon varieties
    'muskmelon': 'melon-1',
    'melon – muskmelon': 'melon-1',
    'hybrid muskmelon': 'melon-1',
    'melon – hybrid muskmelon': 'melon-1',
    'french muskmelon': 'melon-1',
    'melon – french muskmelon': 'melon-1',
    'heirloom muskmelon': 'melon-1',
    'melon – heirloom muskmelon': 'melon-1',
    # Cantaloupe
    'cantaloupe': 'melon-1',
    'melon – cantaloupe': 'melon-1',
    # Hybrid melons
    'hybrid melon': 'melon-1',
    'melon – hybrid melon': 'melon-1',
    # Asian melons
    'asian melon': 'melon-1',
    'melon – asian melon': 'melon-1',
    # Cucumber-melon
    'cucumber-melon': 'melon-1',
    'melon – cucumber-melon': 'melon-1',
    # Mediterranean
    'mediterranean melon': 'melon-1',
    'melon – mediterranean melon': 'melon-1',
    # Other specific varieties
    'galia': 'melon-1',
    'charentais': 'melon-1',
    # Fallback
    'mixed': 'melon-1',
}

MUSTARD_TYPE_MAPPING = {
    # Leaf mustards
    'leaf mustard': 'mustard-1',
    'vegetable – leaf mustard': 'mustard-1',
    # Asian mustards
    'asian mustard': 'mustard-1',
    'asian mustard green': 'mustard-1',
    'vegetable – asian mustard green': 'mustard-1',
    # Seed mustards
    'seed mustard': 'mustard-1',
    'vegetable – seed mustard': 'mustard-1',
    # Hot/biofumigant mustards
    'hot mustard': 'mustard-1',
    'biofumigant': 'mustard-1',
    'vegetable – hot mustard / biofumigant': 'mustard-1',
    # Specific varieties (also accepted as types)
    'southern giant': 'mustard-1',
    'red giant': 'mustard-1',
    'mizuna': 'mustard-1',
    'green wave': 'mustard-1',
    'ruby streaks': 'mustard-1',
    'common': 'mustard-1',
    # Fallback
    'mixed': 'mustard-1',
}

TARRAGON_TYPE_MAPPING = {
    'french': 'tarragon-1',
    'common': 'tarragon-1',
    'true': 'tarragon-1',
    'culinary': 'tarragon-1',
    'russian': 'tarragon-1',  # Inferior but include for completeness
    # Fallback
    'mixed': 'tarragon-1',
}

# Tree type mappings for CSV import

# ========== FRUIT TREES ==========
APPLE_TYPE_MAPPING = {
    'honeycrisp': 'apple-1',
    'gala': 'apple-1',
    'fuji': 'apple-1',
    'granny-smith': 'apple-1',
    'red-delicious': 'apple-1',
    'golden-delicious': 'apple-1',
    'mcintosh': 'apple-1',
    'jonathan': 'apple-1',
    'rome': 'apple-1',
    'cortland': 'apple-1',
    'empire': 'apple-1',
    'braeburn': 'apple-1',
    'crabapple': 'apple-1',
    'liberty': 'apple-1',
    'enterprise': 'apple-1',
    # Fallback
    'mixed': 'apple-1',
}

PEAR_TYPE_MAPPING = {
    'bartlett': 'pear-1',
    'anjou': 'pear-1',
    'bosc': 'pear-1',
    'comice': 'pear-1',
    'seckel': 'pear-1',
    'asian': 'pear-1',
    'harrow-sweet': 'pear-1',
    'moonglow': 'pear-1',
    'kieffer': 'pear-1',
    'conference': 'pear-1',
    # Fallback
    'mixed': 'pear-1',
}

CHERRY_SWEET_TYPE_MAPPING = {
    'bing': 'cherry-1',
    'rainier': 'cherry-1',
    'lambert': 'cherry-1',
    'stella': 'cherry-1',
    'lapins': 'cherry-1',
    'black-tartarian': 'cherry-1',
    'van': 'cherry-1',
    'summit': 'cherry-1',
    'sweetheart': 'cherry-1',
    # Fallback
    'mixed': 'cherry-1',
}

CHERRY_SOUR_TYPE_MAPPING = {
    'montmorency': 'cherry-1',
    'morello': 'cherry-1',
    'english-morello': 'cherry-1',
    'evans': 'cherry-1',
    'north-star': 'cherry-1',
    'meteor': 'cherry-1',
    'danube': 'cherry-1',
    # Fallback
    'mixed': 'cherry-1',
}

PLUM_TYPE_MAPPING = {
    'santa-rosa': 'plum-1',
    'satsuma': 'plum-1',
    'italian-prune': 'plum-1',
    'stanley': 'plum-1',
    'damson': 'plum-1',
    'methley': 'plum-1',
    'shiro': 'plum-1',
    'victoria': 'plum-1',
    'elephant-heart': 'plum-1',
    'green-gage': 'plum-1',
    # Fallback
    'mixed': 'plum-1',
}

PEACH_TYPE_MAPPING = {
    'elberta': 'peach-1',
    'redhaven': 'peach-1',
    'hale-haven': 'peach-1',
    'belle-of-georgia': 'peach-1',
    'reliance': 'peach-1',
    'madison': 'peach-1',
    'contender': 'peach-1',
    'crest-haven': 'peach-1',
    'loring': 'peach-1',
    'white-peach': 'peach-1',
    'donut': 'peach-1',
    # Fallback
    'mixed': 'peach-1',
}

APRICOT_TYPE_MAPPING = {
    'moorpark': 'apricot-1',
    'goldcot': 'apricot-1',
    'tomcot': 'apricot-1',
    'blenheim': 'apricot-1',
    'royal': 'apricot-1',
    'harcot': 'apricot-1',
    'chinese': 'apricot-1',
    'goldrich': 'apricot-1',
    'sungold': 'apricot-1',
    # Fallback
    'mixed': 'apricot-1',
}

FIG_TYPE_MAPPING = {
    'brown-turkey': 'fig-1',
    'chicago-hardy': 'fig-1',
    'celeste': 'fig-1',
    'kadota': 'fig-1',
    'mission': 'fig-1',
    'adriatic': 'fig-1',
    'petite-negra': 'fig-1',
    'desert-king': 'fig-1',
    'violette-de-bordeaux': 'fig-1',
    # Fallback
    'mixed': 'fig-1',
}

PERSIMMON_TYPE_MAPPING = {
    'american': 'persimmon-1',
    'meader': 'persimmon-1',
    'prok': 'persimmon-1',
    'szukis': 'persimmon-1',
    'fuyu': 'persimmon-1',  # Asian variety
    'hachiya': 'persimmon-1',  # Asian variety
    'jiro': 'persimmon-1',
    # Fallback
    'mixed': 'persimmon-1',
}

# ========== NUT TREES ==========
ALMOND_TYPE_MAPPING = {
    'nonpareil': 'almond-1',
    'carmel': 'almond-1',
    'butte': 'almond-1',
    'monterey': 'almond-1',
    'fritz': 'almond-1',
    'mission': 'almond-1',
    'all-in-one': 'almond-1',
    'garden-prince': 'almond-1',
    # Fallback
    'mixed': 'almond-1',
}

WALNUT_TYPE_MAPPING = {
    'chandler': 'walnut-1',
    'hartley': 'walnut-1',
    'franquette': 'walnut-1',
    'carpathian': 'walnut-1',
    'english': 'walnut-1',
    'black': 'walnut-1',
    'thomas': 'walnut-1',
    'emma-k': 'walnut-1',
    'howard': 'walnut-1',
    # Fallback
    'mixed': 'walnut-1',
}

PECAN_TYPE_MAPPING = {
    'desirable': 'pecan-1',
    'pawnee': 'pecan-1',
    'kanza': 'pecan-1',
    'elliot': 'pecan-1',
    'stuart': 'pecan-1',
    'cape-fear': 'pecan-1',
    'caddo': 'pecan-1',
    'oconee': 'pecan-1',
    'lakota': 'pecan-1',
    # Fallback
    'mixed': 'pecan-1',
}

HAZELNUT_TYPE_MAPPING = {
    'barcelona': 'hazelnut-1',
    'jefferson': 'hazelnut-1',
    'yamhill': 'hazelnut-1',
    'theta': 'hazelnut-1',
    'eta': 'hazelnut-1',
    'hall-giant': 'hazelnut-1',
    'american': 'hazelnut-1',
    'dorris': 'hazelnut-1',
    # Fallback
    'mixed': 'hazelnut-1',
}

CHESTNUT_TYPE_MAPPING = {
    'dunstan': 'chestnut-1',
    'colossal': 'chestnut-1',
    'bouche-de-betizac': 'chestnut-1',
    'chinese': 'chestnut-1',
    'qing': 'chestnut-1',
    'eaton': 'chestnut-1',
    'labor-day': 'chestnut-1',
    'carolina': 'chestnut-1',
    # Fallback
    'mixed': 'chestnut-1',
}


# Crop type to mapping dictionary
CROP_TYPE_MAPPINGS = {
    'lettuce': LETTUCE_TYPE_MAPPING,
    'carrot': CARROT_TYPE_MAPPING,
    'tomato': TOMATO_TYPE_MAPPING,
    'pepper': PEPPER_TYPE_MAPPING,
    'bean': BEAN_TYPE_MAPPING,
    'squash': SQUASH_TYPE_MAPPING,
    'cucumber': CUCUMBER_TYPE_MAPPING,
    'pea': PEA_TYPE_MAPPING,
    'beet': BEET_TYPE_MAPPING,
    'burdock': BURDOCK_TYPE_MAPPING,
    'radish': RADISH_TYPE_MAPPING,
    'rice': RICE_TYPE_MAPPING,
    'broccoli': BROCCOLI_TYPE_MAPPING,
    'cauliflower': CAULIFLOWER_TYPE_MAPPING,
    'cabbage': CABBAGE_TYPE_MAPPING,
    'kale': KALE_TYPE_MAPPING,
    'endive': ENDIVE_TYPE_MAPPING,
    'potato': POTATO_TYPE_MAPPING,
    'corn': CORN_TYPE_MAPPING,
    'amaranth': AMARANTH_TYPE_MAPPING,
    'asparagus': ASPARAGUS_TYPE_MAPPING,
    'brussels-sprouts': BRUSSELS_SPROUTS_TYPE_MAPPING,
    'eggplant': EGGPLANT_TYPE_MAPPING,
    'celery': CELERY_TYPE_MAPPING,
    'shallot': SHALLOT_TYPE_MAPPING,
    'spinach': SPINACH_TYPE_MAPPING,
    'sorrel': SORREL_TYPE_MAPPING,
    'shungiku': SHUNGIKU_TYPE_MAPPING,
    'turnip': TURNIP_TYPE_MAPPING,
    'collard-greens': COLLARD_GREENS_TYPE_MAPPING,
    'okra': OKRA_TYPE_MAPPING,
    'kohlrabi': KOHLRABI_TYPE_MAPPING,
    'pumpkin': PUMPKIN_TYPE_MAPPING,
    'bok-choy': BOK_CHOY_TYPE_MAPPING,
    'chard': CHARD_TYPE_MAPPING,
    'cantaloupe': CANTALOUPE_TYPE_MAPPING,
    # Herbs
    'basil': BASIL_TYPE_MAPPING,
    'catnip': CATNIP_TYPE_MAPPING,
    'cilantro': CILANTRO_TYPE_MAPPING,
    'datura': DATURA_TYPE_MAPPING,
    'parsley': PARSLEY_TYPE_MAPPING,
    'purple-coneflower': PURPLE_CONEFLOWER_TYPE_MAPPING,
    'shasta-daisy': SHASTA_DAISY_TYPE_MAPPING,
    'dill': DILL_TYPE_MAPPING,
    'oregano': OREGANO_TYPE_MAPPING,
    'thyme': THYME_TYPE_MAPPING,
    'sage': SAGE_TYPE_MAPPING,
    'rosemary': ROSEMARY_TYPE_MAPPING,
    'mint': MINT_TYPE_MAPPING,
    'mullein': MULLEIN_TYPE_MAPPING,
    'fennel': FENNEL_TYPE_MAPPING,
    'lavender': LAVENDER_TYPE_MAPPING,
    'lemon-balm': LEMON_BALM_TYPE_MAPPING,
    'marigold': MARIGOLD_TYPE_MAPPING,
    'marjoram': MARJORAM_TYPE_MAPPING,
    'melon': MELON_TYPE_MAPPING,
    'mustard': MUSTARD_TYPE_MAPPING,
    'tarragon': TARRAGON_TYPE_MAPPING,
    # Berries/Fruits
    'blackberry': BLACKBERRY_TYPE_MAPPING,
    'grape': GRAPE_TYPE_MAPPING,
    'currant': CURRANT_TYPE_MAPPING,
    'gooseberry': GOOSEBERRY_TYPE_MAPPING,
    'elderberry': ELDERBERRY_TYPE_MAPPING,
    # Trees - Fruit
    'apple': APPLE_TYPE_MAPPING,
    'pear': PEAR_TYPE_MAPPING,
    'cherry-sweet': CHERRY_SWEET_TYPE_MAPPING,
    'cherry-sour': CHERRY_SOUR_TYPE_MAPPING,
    'plum': PLUM_TYPE_MAPPING,
    'peach': PEACH_TYPE_MAPPING,
    'apricot': APRICOT_TYPE_MAPPING,
    'fig': FIG_TYPE_MAPPING,
    'persimmon': PERSIMMON_TYPE_MAPPING,
    # Trees - Nut
    'almond': ALMOND_TYPE_MAPPING,
    'walnut': WALNUT_TYPE_MAPPING,
    'pecan': PECAN_TYPE_MAPPING,
    'hazelnut': HAZELNUT_TYPE_MAPPING,
    'chestnut': CHESTNUT_TYPE_MAPPING,
}


def parse_dtm_range(dtm_string: str) -> Tuple[int, str]:
    """
    Parse days-to-maturity string and return (midpoint, formatted_range).

    Args:
        dtm_string: String like "46-50", "45", or "46-50 days"

    Returns:
        Tuple of (midpoint_days, formatted_range_string)
        Example: ("46-50") → (48, "46-50 days")

    Raises:
        ValueError: If format is invalid
    """
    dtm_string = dtm_string.strip()

    # Normalize different dash types (en-dash, em-dash) to regular hyphen
    dtm_string = dtm_string.replace('–', '-').replace('—', '-')

    # Remove "days" suffix if present (case-insensitive)
    dtm_string = dtm_string.replace(' days', '').replace(' Days', '').replace(' DAYS', '')

    # Handle single number
    if dtm_string.isdigit():
        days = int(dtm_string)
        return (days, f"{days} days")

    # Handle range like "46-50"
    if '-' in dtm_string:
        parts = dtm_string.split('-')
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            min_days = int(parts[0])
            max_days = int(parts[1])
            midpoint = (min_days + max_days) // 2
            return (midpoint, f"{min_days}-{max_days} days")

    raise ValueError(f"Invalid DTM format: {dtm_string}")


def map_variety_to_plant_id(crop_type: str, variety_type: str) -> str:
    """
    Map a variety type to the appropriate plant database ID.

    Args:
        crop_type: Type of crop ('lettuce', 'tomato', etc.)
        variety_type: Specific variety type ('Romaine', 'Cherry', etc.)

    Returns:
        Plant ID string (e.g., 'lettuce-1')

    Raises:
        ValueError: If crop type or variety type is not recognized
    """
    crop_type = crop_type.lower().strip()
    variety_type_lower = variety_type.strip().lower()  # Normalize to lowercase for case-insensitive matching

    if crop_type not in CROP_TYPE_MAPPINGS:
        raise ValueError(f"Unknown crop type: {crop_type}. Supported: {list(CROP_TYPE_MAPPINGS.keys())}")

    mapping = CROP_TYPE_MAPPINGS[crop_type]

    if variety_type_lower not in mapping:
        logger.warning(f"Unknown variety type '{variety_type}' for crop '{crop_type}', using fallback")
        # Try to find a fallback/generic entry
        if 'mixed' in mapping:
            return mapping['mixed']
        # Otherwise return the first entry as fallback
        return list(mapping.values())[0]

    return mapping[variety_type_lower]


def parse_variety_csv(file_content: str, crop_type: str) -> Tuple[List[Dict], List[str]]:
    """
    Parse CSV file content and extract variety data.

    Expected CSV columns:
    - Variety (required): Name of the variety
    - Type (required): Sub-type for plant ID mapping
    - Days to Maturity (required): Number or range (e.g., "46-50")
    - Soil Temp Sowing F (optional): Temperature range
    - Notes (optional): Additional information

    Args:
        file_content: CSV file content as string
        crop_type: Type of crop being imported ('lettuce', 'tomato', etc.)

    Returns:
        Tuple of (varieties_list, errors_list)
        - varieties_list: List of dictionaries with parsed variety data
        - errors_list: List of error messages (empty if no errors)
    """
    varieties = []
    errors = []

    try:
        # Parse CSV
        csv_file = io.StringIO(file_content)
        reader = csv.DictReader(csv_file)

        # Validate required columns
        required_columns = ['Variety', 'Type', 'Days to Maturity']
        if reader.fieldnames is None:
            errors.append("CSV file appears to be empty or malformed")
            return (varieties, errors)

        missing_columns = [col for col in required_columns if col not in reader.fieldnames]
        if missing_columns:
            errors.append(f"Missing required columns: {', '.join(missing_columns)}")
            return (varieties, errors)

        # Parse each row
        row_num = 1  # Start at 1 (header is row 0)
        for row in reader:
            row_num += 1

            try:
                # Required fields
                variety_name = row['Variety'].strip()
                variety_type = row['Type'].strip()
                dtm_string = row['Days to Maturity'].strip()

                if not variety_name:
                    errors.append(f"Row {row_num}: Variety name is required")
                    continue

                if not variety_type:
                    errors.append(f"Row {row_num}: Type is required")
                    continue

                if not dtm_string:
                    errors.append(f"Row {row_num}: Days to Maturity is required")
                    continue

                # Parse DTM
                try:
                    dtm_midpoint, dtm_range = parse_dtm_range(dtm_string)
                except ValueError as e:
                    errors.append(f"Row {row_num}: {str(e)}")
                    continue

                # Map to plant ID
                try:
                    plant_id = map_variety_to_plant_id(crop_type, variety_type)
                except ValueError as e:
                    errors.append(f"Row {row_num}: {str(e)}")
                    continue

                # Validate plant_id exists in PLANT_DATABASE
                if not validate_plant_id(plant_id):
                    errors.append(f"Row {row_num}: Mapped plant_id '{plant_id}' does not exist in PLANT_DATABASE. This is a data integrity issue - contact admin.")
                    continue

                # Optional fields
                soil_temp = row.get('Soil Temp Sowing F', '').strip()
                notes = row.get('Notes', '').strip()

                # Build notes field
                notes_parts = []
                if variety_type:
                    notes_parts.append(f"Type: {variety_type}")
                if dtm_range:
                    notes_parts.append(f"DTM: {dtm_range}")
                if soil_temp:
                    notes_parts.append(f"Soil Temp: {soil_temp}°F")
                if notes:
                    notes_parts.append(notes)

                combined_notes = " | ".join(notes_parts)

                # Create variety dict
                variety_data = {
                    'variety': variety_name,
                    'plant_id': plant_id,
                    'days_to_maturity': dtm_midpoint,
                    'notes': combined_notes,
                    'brand': None,  # Will be filled by user
                    'quantity': 0,  # Default to 0
                    'location': '',  # User will specify
                }

                varieties.append(variety_data)
                logger.info(f"Parsed variety: {variety_name} → {plant_id}")

            except Exception as e:
                errors.append(f"Row {row_num}: Unexpected error - {str(e)}")
                logger.error(f"Error parsing row {row_num}: {e}")

    except csv.Error as e:
        errors.append(f"CSV parsing error: {str(e)}")
        logger.error(f"CSV parsing error: {e}")
    except Exception as e:
        errors.append(f"Unexpected error: {str(e)}")
        logger.error(f"Unexpected error during CSV parsing: {e}")

    return (varieties, errors)


def import_varieties_to_database(db, varieties: List[Dict], is_global: bool = False, user_id: int = None) -> Tuple[int, List[str]]:
    """
    Import parsed varieties into the SeedInventory database.

    Args:
        db: Flask SQLAlchemy database instance
        varieties: List of variety dictionaries from parse_variety_csv()
        is_global: Boolean flag to mark varieties as global/shared (default: False)
        user_id: User ID for personal varieties (None for global catalog)

    Returns:
        Tuple of (imported_count, errors_list)
    """
    from models import SeedInventory

    imported_count = 0
    errors = []

    try:
        for variety_data in varieties:
            try:
                # Check for duplicate (must include is_global to distinguish global vs personal varieties)
                existing = SeedInventory.query.filter_by(
                    plant_id=variety_data['plant_id'],
                    variety=variety_data['variety'],
                    is_global=is_global
                ).first()

                if existing:
                    logger.warning(f"Skipping duplicate variety: {variety_data['variety']} ({variety_data['plant_id']})")
                    continue

                # Create new seed inventory entry
                # Validate DTM before inserting (must be positive integer or None)
                dtm = variety_data.get('days_to_maturity')
                validated_dtm = dtm if dtm is not None and isinstance(dtm, int) and 0 < dtm < 365 else None

                seed = SeedInventory(
                    user_id=None if is_global else user_id,  # NULL for global, user_id for personal
                    plant_id=variety_data['plant_id'],
                    variety=variety_data['variety'],
                    brand=variety_data['brand'],
                    quantity=variety_data['quantity'],
                    purchase_date=None,
                    expiration_date=None,
                    germination_rate=None,
                    location=variety_data['location'],
                    price=None,
                    notes=variety_data['notes'],
                    is_global=is_global,
                    # Populate variety-specific DTM override from CSV
                    days_to_maturity=validated_dtm
                )

                db.session.add(seed)
                imported_count += 1
                logger.info(f"Imported variety: {variety_data['variety']}")

            except Exception as e:
                errors.append(f"Failed to import {variety_data.get('variety', 'unknown')}: {str(e)}")
                logger.error(f"Error importing variety: {e}")

        # Commit all changes
        db.session.commit()
        logger.info(f"Successfully imported {imported_count} varieties")

    except Exception as e:
        db.session.rollback()
        error_msg = f"Database error during import: {str(e)}"
        errors.append(error_msg)
        logger.error(error_msg)
        imported_count = 0

    return (imported_count, errors)


def validate_csv_format(file_content: str) -> Tuple[bool, List[str]]:
    """
    Validate CSV format without importing data.

    Args:
        file_content: CSV file content as string

    Returns:
        Tuple of (is_valid, errors_list)
    """
    errors = []

    try:
        csv_file = io.StringIO(file_content)
        reader = csv.DictReader(csv_file)

        if reader.fieldnames is None:
            errors.append("CSV file is empty or has no header row")
            return (False, errors)

        required_columns = ['Variety', 'Type', 'Days to Maturity']
        missing_columns = [col for col in required_columns if col not in reader.fieldnames]

        if missing_columns:
            errors.append(f"Missing required columns: {', '.join(missing_columns)}")

        # Check if file has at least one data row
        rows = list(reader)
        if len(rows) == 0:
            errors.append("CSV file has no data rows")

        is_valid = len(errors) == 0
        return (is_valid, errors)

    except csv.Error as e:
        errors.append(f"Invalid CSV format: {str(e)}")
        return (False, errors)
    except Exception as e:
        errors.append(f"Validation error: {str(e)}")
        return (False, errors)
