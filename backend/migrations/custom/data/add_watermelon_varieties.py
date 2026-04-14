"""
Add new watermelon varieties to the seed catalog
- Sugar Baby (DTM 75)
- Charleston Grey (DTM 95)
- Congo (DTM 95)
"""
# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from app import app, db
from models import SeedInventory

def add_watermelon_varieties():
    """Add the three new watermelon varieties to the global seed catalog"""

    with app.app_context():
        # Check if varieties already exist
        existing = SeedInventory.query.filter(
            SeedInventory.is_global == True,
            SeedInventory.plant_id.in_([
                'watermelon-sugar-baby',
                'watermelon-charleston-grey',
                'watermelon-congo'
            ])
        ).all()

        if existing:
            print(f"Found {len(existing)} existing entries. Removing them first...")
            for seed in existing:
                db.session.delete(seed)
            db.session.commit()

        # Create the new seed catalog entries
        watermelon_varieties = [
            {
                'plant_id': 'watermelon-sugar-baby',
                'variety': 'Sugar Baby',
                'days_to_maturity': 75,
                'brand': None,
                'is_global': True,
                'user_id': None,
            },
            {
                'plant_id': 'watermelon-charleston-grey',
                'variety': 'Charleston Grey',
                'days_to_maturity': 95,
                'brand': None,
                'is_global': True,
                'user_id': None,
            },
            {
                'plant_id': 'watermelon-congo',
                'variety': 'Congo',
                'days_to_maturity': 95,
                'brand': None,
                'is_global': True,
                'user_id': None,
            }
        ]

        for variety_data in watermelon_varieties:
            seed = SeedInventory(**variety_data)
            db.session.add(seed)
            print(f"Added: {variety_data['variety']} (DTM: {variety_data['days_to_maturity']})")

        db.session.commit()
        print("\nSuccessfully added 3 new watermelon varieties to the catalog!")

        # Verify
        all_watermelon_seeds = SeedInventory.query.filter(
            SeedInventory.is_global == True,
            SeedInventory.plant_id.like('watermelon%')
        ).all()

        print(f"\nTotal watermelon varieties in catalog: {len(all_watermelon_seeds)}")
        for seed in all_watermelon_seeds:
            print(f"  - {seed.variety} (DTM: {seed.days_to_maturity})")

if __name__ == '__main__':
    add_watermelon_varieties()
