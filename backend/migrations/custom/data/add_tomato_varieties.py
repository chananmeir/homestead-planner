"""
Add new tomato varieties to the seed catalog
- Wisconsin 55 (DTM 77)
- Peron Sprayless (DTM 70)
- Orange Roussollin (DTM 65)
"""
# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from app import app, db
from models import SeedInventory

def add_tomato_varieties():
    """Add the three new tomato varieties to the global seed catalog"""

    with app.app_context():
        # Check if varieties already exist
        existing = SeedInventory.query.filter(
            SeedInventory.is_global == True,
            SeedInventory.plant_id.in_([
                'tomato-wisconsin-55',
                'tomato-peron-sprayless',
                'tomato-orange-roussollin'
            ])
        ).all()

        if existing:
            print(f"Found {len(existing)} existing entries. Removing them first...")
            for seed in existing:
                db.session.delete(seed)
            db.session.commit()

        # Create the new seed catalog entries
        tomato_varieties = [
            {
                'plant_id': 'tomato-wisconsin-55',
                'variety': 'Wisconsin 55',
                'days_to_maturity': 77,
                'brand': None,
                'is_global': True,
                'user_id': None,
            },
            {
                'plant_id': 'tomato-peron-sprayless',
                'variety': 'Peron Sprayless',
                'days_to_maturity': 70,
                'brand': None,
                'is_global': True,
                'user_id': None,
            },
            {
                'plant_id': 'tomato-orange-roussollin',
                'variety': 'Orange Roussollin',
                'days_to_maturity': 65,
                'brand': None,
                'is_global': True,
                'user_id': None,
            }
        ]

        for variety_data in tomato_varieties:
            seed = SeedInventory(**variety_data)
            db.session.add(seed)
            print(f"Added: {variety_data['variety']} (DTM: {variety_data['days_to_maturity']})")

        db.session.commit()
        print("\n✓ Successfully added 3 new tomato varieties to the catalog!")

        # Verify
        all_tomato_seeds = SeedInventory.query.filter(
            SeedInventory.is_global == True,
            SeedInventory.plant_id.like('tomato%')
        ).all()

        print(f"\nTotal tomato varieties in catalog: {len(all_tomato_seeds)}")
        for seed in all_tomato_seeds:
            print(f"  - {seed.variety} (DTM: {seed.days_to_maturity})")

if __name__ == '__main__':
    add_tomato_varieties()
