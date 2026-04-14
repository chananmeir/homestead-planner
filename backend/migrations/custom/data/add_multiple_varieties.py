"""
Add multiple new plant varieties to the seed catalog
"""
# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from app import app, db
from models import SeedInventory

def add_all_varieties():
    """Add all the new varieties to the global seed catalog"""

    with app.app_context():
        # Define all new varieties
        new_varieties = [
            # Squash
            {
                'plant_id': 'squash-green-stripe-cushaw',
                'variety': 'Green Stripe Cushaw',
                'days_to_maturity': 52,  # Average of 45-60
                'germination_temp_min': 70,
                'germination_temp_max': 70,
                'is_global': True,
                'user_id': None,
            },
            # Peppers
            {
                'plant_id': 'pepper-yellow-corno-di-toro',
                'variety': 'Yellow Corno Di Toro',
                'days_to_maturity': 80,
                'germination_temp_min': 75,
                'germination_temp_max': 85,
                'is_global': True,
                'user_id': None,
            },
            {
                'plant_id': 'pepper-miniature-yellow-bell',
                'variety': 'Miniature Yellow Bell',
                'days_to_maturity': 65,  # Average of 60-70
                'germination_temp_min': 75,
                'germination_temp_max': 85,
                'is_global': True,
                'user_id': None,
            },
            # Watermelon
            {
                'plant_id': 'watermelon-dixie-queen',
                'variety': 'Dixie Queen',
                'days_to_maturity': 70,
                'germination_temp_min': 70,
                'germination_temp_max': 80,
                'is_global': True,
                'user_id': None,
            },
            # Melon
            {
                'plant_id': 'melon-orange-flesh-honeydew',
                'variety': 'Orange Flesh Honeydew',
                'days_to_maturity': 92,  # Average of 75-110
                'germination_temp_min': 70,
                'germination_temp_max': 80,
                'is_global': True,
                'user_id': None,
            },
            # Collards
            {
                'plant_id': 'collard-vates',
                'variety': 'Vates',
                'days_to_maturity': 65,  # Average of 60-70
                'germination_temp_min': 75,
                'germination_temp_max': 75,
                'is_global': True,
                'user_id': None,
            },
            # Radicchio
            {
                'plant_id': 'radicchio-rouge-de-verona',
                'variety': 'Rouge De Verona',
                'days_to_maturity': 50,
                'germination_temp_min': 60,
                'germination_temp_max': 70,
                'is_global': True,
                'user_id': None,
            },
            # Kale
            {
                'plant_id': 'kale-bare-necessities',
                'variety': 'Bare Necessities',
                'days_to_maturity': 50,
                'germination_temp_min': 55,
                'germination_temp_max': 75,
                'is_global': True,
                'user_id': None,
            },
            # Caraway
            {
                'plant_id': 'caraway-1',
                'variety': 'Caraway',
                'days_to_maturity': 105,  # Average of 90-120
                'germination_temp_min': 70,
                'germination_temp_max': 70,
                'is_global': True,
                'user_id': None,
            },
            # Fenugreek
            {
                'plant_id': 'fenugreek-1',
                'variety': 'Fenugreek',
                'days_to_maturity': 35,  # Average of 30-40
                'germination_temp_min': 65,
                'germination_temp_max': 85,
                'is_global': True,
                'user_id': None,
            },
            # Chia
            {
                'plant_id': 'chia-white',
                'variety': 'White Chia',
                'days_to_maturity': 140,
                'germination_temp_min': 70,
                'germination_temp_max': 70,
                'is_global': True,
                'user_id': None,
            },
            # Gourd
            {
                'plant_id': 'gourd-bi-color-pear',
                'variety': 'Bi-Color Pear',
                'days_to_maturity': 95,
                'germination_temp_min': 70,
                'germination_temp_max': 90,
                'is_global': True,
                'user_id': None,
            },
            # Cucumber
            {
                'plant_id': 'cucumber-wisconsin-smr-pickling',
                'variety': 'Wisconsin SMR Pickling',
                'days_to_maturity': 55,  # Average of 50-60
                'germination_temp_min': 70,
                'germination_temp_max': 85,
                'is_global': True,
                'user_id': None,
            },
            # Sunflower
            {
                'plant_id': 'sunflower-teddy-bear',
                'variety': 'Teddy Bear',
                'days_to_maturity': 57,  # Average of 50-65
                'germination_temp_min': 70,
                'germination_temp_max': 70,
                'is_global': True,
                'user_id': None,
            },
            # Asparagus
            {
                'plant_id': 'asparagus-uc-157',
                'variety': 'UC-157',
                'days_to_maturity': 730,  # 2 years
                'germination_temp_min': 70,
                'germination_temp_max': 85,
                'is_global': True,
                'user_id': None,
            },
        ]

        # Check for existing entries and remove them
        plant_ids = [v['plant_id'] for v in new_varieties]
        existing = SeedInventory.query.filter(
            SeedInventory.is_global == True,
            SeedInventory.plant_id.in_(plant_ids)
        ).all()

        if existing:
            print(f"Found {len(existing)} existing entries. Removing them first...")
            for seed in existing:
                db.session.delete(seed)
            db.session.commit()

        # Add all new varieties
        print(f"\nAdding {len(new_varieties)} new varieties to the catalog:\n")
        for variety_data in new_varieties:
            seed = SeedInventory(**variety_data)
            db.session.add(seed)
            print(f"  + {variety_data['variety']} (DTM: {variety_data['days_to_maturity']} days)")

        db.session.commit()
        print(f"\nSuccessfully added {len(new_varieties)} new varieties to the catalog!")

if __name__ == '__main__':
    add_all_varieties()
