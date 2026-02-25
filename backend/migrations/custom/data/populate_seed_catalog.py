"""
Populate the global seed catalog with common varieties for all plants in PLANT_DATABASE.

This creates is_global=True SeedInventory records that appear in the Seed Catalog tab.
Users can browse and clone these to their personal inventory.

Run: cd backend && python migrations/custom/data/populate_seed_catalog.py
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from models import db, SeedInventory
from plant_database import PLANT_DATABASE

# Common varieties for each plant, keyed by plant_id
# Format: [(variety_name, dtm_override_or_None, notes), ...]
VARIETIES = {
    # === VEGETABLES ===
    'tomato-1': [
        ('Roma', 75, 'Paste/sauce tomato, determinate'),
        ('Brandywine', 90, 'Large heirloom beefsteak, indeterminate'),
        ('Cherokee Purple', 85, 'Dark heirloom, rich flavor'),
        ('San Marzano', 80, 'Classic Italian paste tomato'),
        ('Cherry Bomb', 60, 'Prolific cherry tomato'),
        ('Sweet 100', 65, 'Sweet cherry, indeterminate'),
        ('Better Boy', 72, 'Classic hybrid slicing tomato'),
        ('Black Krim', 80, 'Russian heirloom, smoky flavor'),
        ('Mortgage Lifter', 85, 'Large pink heirloom'),
        ('Rutgers', 73, 'Classic canning/slicing variety'),
    ],
    'pepper-1': [
        ('California Wonder', 75, 'Classic green/red bell pepper'),
        ('Sweet Banana', 70, 'Yellow sweet pepper, great for frying'),
        ('Jalapeño', 70, 'Medium-hot pepper, versatile'),
        ('Habanero', 90, 'Very hot, fruity flavor'),
        ('Cayenne', 70, 'Hot, great for drying'),
        ('Poblano', 75, 'Mild, great for stuffing'),
        ('Shishito', 60, 'Mild Japanese pepper'),
        ('Anaheim', 80, 'Mild green chile'),
    ],
    'cucumber-1': [
        ('Straight Eight', 60, 'Classic slicing cucumber'),
        ('Marketmore 76', 65, 'Disease-resistant slicing'),
        ('Boston Pickling', 55, 'Prolific pickling variety'),
        ('Lemon', 65, 'Round yellow, mild flavor'),
        ('Spacemaster', 60, 'Compact bush, great for containers'),
        ('National Pickling', 52, 'Standard pickling cucumber'),
    ],
    'lettuce-1': [
        ('Buttercrunch', 65, 'Popular Bibb/butterhead type'),
        ('Black Seeded Simpson', 46, 'Early looseleaf, quick to harvest'),
        ('Romaine (Parris Island)', 68, 'Classic romaine'),
        ('Little Gem', 50, 'Small sweet romaine'),
        ('Red Sails', 53, 'Red looseleaf, slow to bolt'),
        ('Great Lakes', 80, 'Classic iceberg/crisphead'),
        ('Salad Bowl', 45, 'Green looseleaf, cut-and-come-again'),
    ],
    'carrot-1': [
        ('Danvers Half Long', 75, 'Classic all-purpose, adaptable'),
        ('Nantes', 65, 'Sweet, cylindrical, great raw'),
        ('Scarlet Nantes', 68, 'Bright orange, sweet'),
        ('Imperator 58', 75, 'Long market carrot'),
        ('Chantenay Red Core', 70, 'Short, stocky, good for heavy soil'),
        ('Little Finger', 55, 'Small, perfect for containers'),
    ],
    'bean-1': [
        ('Blue Lake Bush', 55, 'Classic green bean, bush type'),
        ('Provider', 50, 'Early, reliable bush bean'),
        ('Contender', 50, 'Stringless bush bean'),
        ('Dragon Tongue', 60, 'Purple-streaked wax bean'),
        ('Royal Burgundy', 55, 'Purple bush bean, turns green when cooked'),
    ],
    'pole-beans-1': [
        ('Kentucky Wonder', 65, 'Classic pole bean'),
        ('Scarlet Runner', 70, 'Ornamental and edible'),
        ('Blue Lake Pole', 60, 'Pole version of Blue Lake'),
    ],
    'corn-1': [
        ('Golden Bantam', 78, 'Classic open-pollinated sweet corn'),
        ('Silver Queen', 92, 'White sweet corn'),
        ('Peaches and Cream', 83, 'Bicolor sweet corn'),
        ('Honey Select', 79, 'Triple-sweet hybrid'),
    ],
    'squash-1': [
        ('Black Beauty Zucchini', 50, 'Classic dark green zucchini'),
        ('Yellow Crookneck', 55, 'Traditional summer squash'),
        ('Butternut', 100, 'Sweet winter squash, stores well'),
        ('Acorn', 85, 'Small winter squash, individual servings'),
        ('Spaghetti', 90, 'Stringy flesh, pasta substitute'),
        ('Delicata', 80, 'Sweet, edible skin'),
    ],
    'pumpkin-1': [
        ('Sugar Pie', 100, 'Classic baking pumpkin'),
        ('Jack O\' Lantern', 110, 'Standard carving pumpkin'),
        ('Cinderella (Rouge Vif d\'Etampes)', 110, 'Flat, decorative, good eating'),
    ],
    'onion-1': [
        ('Yellow Sweet Spanish', 110, 'Large mild onion'),
        ('Walla Walla', 115, 'Sweet onion, mild'),
        ('Red Burgundy', 95, 'Mild red for salads'),
        ('White Lisbon', 60, 'Bunching/green onion'),
    ],
    'garlic-1': [
        ('Softneck (Artichoke)', None, 'Common grocery store type, stores well'),
        ('Hardneck (Rocambole)', None, 'Rich flavor, produces scapes'),
        ('Elephant Garlic', None, 'Mild, large cloves (actually a leek)'),
    ],
    'pea-1': [
        ('Sugar Snap', 60, 'Edible pod, sweet, climbing'),
        ('Snow Pea (Oregon Sugar Pod)', 65, 'Flat edible pod'),
        ('Green Arrow', 68, 'Shelling pea, high yield'),
        ('Little Marvel', 60, 'Compact bush shelling pea'),
    ],
    'spinach-1': [
        ('Bloomsdale Long Standing', 48, 'Classic savoy leaf, slow to bolt'),
        ('Giant Noble', 45, 'Large leaves, good for cooking'),
        ('Space', 40, 'Smooth leaf, baby spinach'),
    ],
    'kale-1': [
        ('Dwarf Blue Curled Scotch', 55, 'Classic curly kale'),
        ('Lacinato (Dinosaur)', 60, 'Italian flat-leaf kale'),
        ('Red Russian', 50, 'Tender flat leaves, cold hardy'),
    ],
    'broccoli-1': [
        ('Calabrese', 60, 'Classic Italian heirloom'),
        ('De Cicco', 48, 'Early, produces many side shoots'),
        ('Waltham 29', 74, 'Cold-hardy, fall harvest'),
    ],
    'cabbage-1': [
        ('Copenhagen Market', 72, 'Early round head'),
        ('Late Flat Dutch', 100, 'Large heads, good for sauerkraut'),
        ('Red Acre', 76, 'Compact red cabbage'),
    ],
    'cauliflower-1': [
        ('Snowball Self-Blanching', 68, 'Classic white cauliflower'),
        ('Purple Cape', 85, 'Purple heads, no blanching needed'),
    ],
    'eggplant-1': [
        ('Black Beauty', 80, 'Classic large dark eggplant'),
        ('Ichiban', 65, 'Long Japanese eggplant'),
        ('Rosa Bianca', 75, 'Italian heirloom, mild'),
    ],
    'beet-1': [
        ('Detroit Dark Red', 55, 'Classic all-purpose beet'),
        ('Chioggia', 55, 'Candy-striped Italian heirloom'),
        ('Golden', 55, 'Yellow beet, doesn\'t stain'),
        ('Bull\'s Blood', 35, 'Grown for deep red leaves'),
    ],
    'radish-1': [
        ('Cherry Belle', 22, 'Classic round red radish'),
        ('French Breakfast', 25, 'Oblong, mild, red with white tip'),
        ('Daikon (Minowase)', 50, 'Long white Asian radish'),
        ('Watermelon', 60, 'Green outside, pink inside'),
    ],
    'turnip-1': [
        ('Purple Top White Globe', 55, 'Classic dual-purpose'),
        ('Hakurei', 38, 'Sweet Japanese salad turnip'),
        ('Golden Ball', 60, 'Yellow, sweet, stores well'),
    ],
    'chard-1': [
        ('Bright Lights', 55, 'Rainbow stems, ornamental'),
        ('Fordhook Giant', 50, 'Classic white-stemmed'),
        ('Ruby Red (Rhubarb)', 55, 'Deep red stems'),
    ],
    'celery-1': [
        ('Utah Tall', 100, 'Classic green celery'),
        ('Giant Pascal', 115, 'Heirloom, large stalks'),
    ],
    'leek-1': [
        ('American Flag', 120, 'Classic garden leek'),
        ('King Richard', 75, 'Early, long white shanks'),
    ],
    'arugula-1': [
        ('Roquette', 40, 'Standard peppery arugula'),
        ('Sylvetta (Wild)', 50, 'Stronger flavor, perennial tendency'),
    ],
    'okra-1': [
        ('Clemson Spineless', 56, 'Classic variety, smooth pods'),
        ('Burgundy', 60, 'Red pods, ornamental'),
    ],
    'melon-1': [
        ('Hale\'s Best', 85, 'Classic cantaloupe'),
        ('Honeydew (Green Flesh)', 100, 'Sweet green melon'),
        ('Sugar Baby Watermelon', 80, 'Small personal-size watermelon'),
    ],
    'watermelon-1': [
        ('Crimson Sweet', 85, 'Classic large watermelon'),
        ('Sugar Baby', 75, 'Small icebox melon'),
        ('Charleston Gray', 90, 'Large oblong, thick rind'),
    ],
    'asparagus-1': [
        ('Mary Washington', None, 'Classic heirloom variety'),
        ('Jersey Giant', None, 'All-male hybrid, high yield'),
    ],
    'kohlrabi-1': [
        ('Early White Vienna', 55, 'Classic quick kohlrabi'),
        ('Early Purple Vienna', 55, 'Purple skin, white inside'),
    ],
    'collard-greens-1': [
        ('Georgia Southern', 75, 'Classic collard, large leaves'),
        ('Vates', 60, 'Compact, cold-hardy'),
    ],
    'brussels-sprouts-1': [
        ('Long Island Improved', 100, 'Classic compact variety'),
        ('Catskill', 90, 'Early maturing'),
    ],
    'endive-1': [
        ('Broad Leaf Batavian', 85, 'Escarole type'),
        ('Green Curled', 90, 'Frisée type'),
    ],
    'mustard-1': [
        ('Southern Giant Curled', 45, 'Classic curly mustard'),
        ('Red Giant', 45, 'Large purple-red leaves'),
    ],
    'bok-choy-1': [
        ('Pak Choi (White Stem)', 45, 'Classic bok choy'),
        ('Joi Choi', 50, 'Vigorous hybrid'),
    ],
    'amaranth-1': [
        ('Red Garnet', 50, 'Dual-use: greens and grain'),
    ],
    # === HERBS ===
    'basil-1': [
        ('Genovese', 60, 'Classic Italian sweet basil'),
        ('Thai', 60, 'Spicy, anise flavor'),
        ('Purple (Dark Opal)', 65, 'Ornamental and culinary'),
        ('Lemon', 55, 'Citrus-scented'),
    ],
    'cilantro-1': [
        ('Santo', 50, 'Slow-bolt cilantro'),
        ('Calypso', 55, 'Very slow to bolt'),
    ],
    'dill-1': [
        ('Bouquet', 50, 'Standard garden dill'),
        ('Fernleaf', 45, 'Compact, good for containers'),
    ],
    'parsley-1': [
        ('Italian Flat Leaf', 75, 'Best flavor for cooking'),
        ('Moss Curled', 70, 'Classic curly garnish'),
    ],
    'oregano-1': [
        ('Greek', None, 'Strong flavor, classic'),
        ('Italian', None, 'Milder, all-purpose'),
    ],
    'thyme-1': [
        ('English', None, 'Classic culinary thyme'),
        ('Lemon', None, 'Citrus-scented variety'),
    ],
    'sage-1': [
        ('Common (Garden)', None, 'Classic culinary sage'),
        ('Purple', None, 'Ornamental and culinary'),
    ],
    'rosemary-1': [
        ('Tuscan Blue', None, 'Upright, strong flavor'),
        ('Prostrate', None, 'Trailing, ground cover'),
    ],
    'mint-1': [
        ('Peppermint', None, 'Classic for tea'),
        ('Spearmint', None, 'Mild, great for cooking'),
    ],
    'chives-1': [
        ('Common', None, 'Standard onion-flavored chives'),
        ('Garlic', None, 'Flat-leaf, garlic flavor'),
    ],
    'lavender-1': [
        ('English (Munstead)', None, 'Compact, fragrant'),
        ('Hidcote', None, 'Deep purple, very fragrant'),
    ],
    'fennel-1': [
        ('Florence (Bulbing)', 65, 'Grown for bulb, anise flavor'),
        ('Bronze', None, 'Ornamental herb fennel'),
    ],
    'lemon-balm-1': [
        ('Common', None, 'Classic lemon-scented herb'),
    ],
    'marjoram-1': [
        ('Sweet', 80, 'Milder than oregano'),
    ],
    'borage-1': [
        ('Common Blue', 55, 'Edible blue flowers, cucumber taste'),
    ],
    'catnip-1': [
        ('Common', None, 'Cats love it, also makes tea'),
    ],
    'mullein-1': [
        ('Common', None, 'Medicinal herb, tall flower spikes'),
    ],

    # === FLOWERS ===
    'marigold-1': [
        ('French Dwarf', 50, 'Compact, pest deterrent'),
        ('African Tall', 70, 'Large blooms'),
    ],
    'nasturtium-1': [
        ('Jewel Mix', 55, 'Edible flowers, trailing'),
        ('Alaska Mix', 55, 'Variegated foliage'),
    ],
    'sunflower-1': [
        ('Mammoth', 80, 'Giant sunflower, edible seeds'),
        ('Teddy Bear', 65, 'Dwarf, fluffy double blooms'),
    ],
    'zinnia-1': [
        ('California Giant Mix', 75, 'Large dahlia-flowered'),
        ('Lilliput Mix', 60, 'Pompon type, great for cutting'),
    ],
    'calendula-1': [
        ('Pacific Beauty', 50, 'Edible flowers, medicinal'),
    ],

    # === FRUITS (seed-grown or notable) ===
    'strawberry-1': [
        ('Alpine (Alexandria)', None, 'Everbearing, grow from seed'),
        ('Ozark Beauty', None, 'Everbearing, large berries'),
    ],
}


def populate_catalog():
    from app import app
    with app.app_context():
        # Check how many global seeds already exist
        existing_count = SeedInventory.query.filter_by(is_global=True).count()
        print(f"Existing global catalog entries: {existing_count}")

        # Build a set of existing (plant_id, variety) to avoid duplicates
        existing = set()
        for seed in SeedInventory.query.filter_by(is_global=True).all():
            existing.add((seed.plant_id, seed.variety))

        imported = 0
        skipped = 0

        for plant_id, varieties in VARIETIES.items():
            # Verify plant_id exists in PLANT_DATABASE
            plant = next((p for p in PLANT_DATABASE if p['id'] == plant_id), None)
            if not plant:
                print(f"  WARNING: {plant_id} not in PLANT_DATABASE, skipping")
                continue

            for variety_name, dtm, notes in varieties:
                if (plant_id, variety_name) in existing:
                    skipped += 1
                    continue

                seed = SeedInventory(
                    user_id=None,  # Global catalog
                    plant_id=plant_id,
                    variety=variety_name,
                    brand=None,
                    quantity=0,
                    is_global=True,
                    days_to_maturity=dtm,
                    notes=notes,
                )
                db.session.add(seed)
                imported += 1

        db.session.commit()
        final_count = SeedInventory.query.filter_by(is_global=True).count()
        print(f"Imported: {imported} new varieties")
        print(f"Skipped: {skipped} (already existed)")
        print(f"Total catalog entries: {final_count}")


if __name__ == '__main__':
    populate_catalog()
