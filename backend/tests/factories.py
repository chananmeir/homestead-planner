"""
Model factories for multi-user isolation tests.

Each ``create_*`` function builds and commits one row owned by the given user
(or attached to the given parent) and returns it. These are called imperatively
inside test bodies — they are deliberately NOT pytest fixtures, because
isolation tests need to control exactly which user owns what, and when.

Split by scoping model, because that split is the whole point of the isolation
suite:

* **User-scoped** factories take ``user_id`` — the row carries its own
  ``user_id`` column and endpoints filter on it directly.
* **Parent-scoped** factories take a parent id — these 7 models have NO
  ``user_id`` column and are reachable only through their parent. They are
  where cross-user FK-injection bugs hide.

NOTE: ``test_auth_isolation.py`` has its own older private ``_create_*``
helpers. They are intentionally left alone — rewriting a passing 418-line
security suite to import from here would be risk without payoff.
"""

from datetime import datetime, timedelta

from models import (
    db, GardenBed, GardenPlan, GardenPlanItem, SeedInventory, Property,
    TrellisStructure, Livestock, Chicken, Duck, Beehive, HealthRecord,
    CompostPile, CompostIngredient, HarvestRecord, PlantingEvent, PlantedItem,
    Photo, IndoorSeedStart, EggProduction, DuckEggProduction, HiveInspection,
    HoneyHarvest,
)


def _commit(row):
    db.session.add(row)
    db.session.commit()
    return row


# =====================================================================
# User-scoped resources (own a user_id column)
# =====================================================================

def create_bed(user_id, name='Test Bed', **kwargs):
    return _commit(GardenBed(
        user_id=user_id, name=name,
        width=kwargs.pop('width', 4.0), length=kwargs.pop('length', 8.0),
        **kwargs
    ))


def create_plan(user_id, name='Test Plan', year=2026, **kwargs):
    return _commit(GardenPlan(user_id=user_id, name=name, year=year, **kwargs))


def create_seed(user_id, variety='Roma', plant_id='tomato-1', quantity=10,
                price=None, seeds_per_packet=None, is_global=False):
    """A seed packet.

    ``price`` / ``seeds_per_packet`` are exposed so the shopping-list leak test
    can plant distinctive values in one user's seed and assert they never
    surface in another user's response.
    """
    return _commit(SeedInventory(
        user_id=user_id, plant_id=plant_id, variety=variety,
        quantity=quantity, price=price, seeds_per_packet=seeds_per_packet,
        is_global=is_global,
    ))


def create_property(user_id, name='Test Property'):
    return _commit(Property(user_id=user_id, name=name, width=100.0, length=200.0))


def create_trellis(user_id, name='Test Trellis', garden_bed_id=None):
    return _commit(TrellisStructure(
        user_id=user_id, name=name, garden_bed_id=garden_bed_id,
        start_x=0.0, start_y=0.0, end_x=10.0, end_y=0.0,
        total_length_feet=10.0, total_length_inches=120.0,
    ))


def create_livestock(user_id, name='Daisy'):
    return _commit(Livestock(user_id=user_id, name=name, species='goat', breed='Nubian'))


def create_chicken(user_id, name='Henrietta'):
    return _commit(Chicken(user_id=user_id, name=name, breed='Rhode Island Red', quantity=1))


def create_duck(user_id, name='Quackers'):
    return _commit(Duck(user_id=user_id, name=name, breed='Pekin', quantity=1))


def create_beehive(user_id, name='Hive Alpha'):
    return _commit(Beehive(user_id=user_id, name=name, type='Langstroth'))


def create_harvest(user_id, plant_id='tomato-1'):
    return _commit(HarvestRecord(user_id=user_id, plant_id=plant_id, quantity=5.0, unit='lbs'))


def create_compost(user_id, name='Pile 1'):
    return _commit(CompostPile(user_id=user_id, name=name))


def create_planting_event(user_id, bed_id, plant_id='tomato-1'):
    return _commit(PlantingEvent(
        user_id=user_id, garden_bed_id=bed_id, plant_id=plant_id,
        event_type='planting', quantity=4,
    ))


def create_planted_item(user_id, bed_id, plant_id='tomato-1', **kwargs):
    return _commit(PlantedItem(
        user_id=user_id, garden_bed_id=bed_id, plant_id=plant_id,
        quantity=kwargs.pop('quantity', 1), **kwargs
    ))


def create_photo(user_id, garden_bed_id=None, caption='Test photo'):
    return _commit(Photo(
        user_id=user_id, garden_bed_id=garden_bed_id, caption=caption,
        filename='test.jpg', filepath='/static/uploads/test.jpg',
        category='garden',
    ))


def create_indoor_seed_start(user_id, seed_inventory_id=None, plant_id='tomato-1'):
    return _commit(IndoorSeedStart(
        user_id=user_id, plant_id=plant_id,
        seed_inventory_id=seed_inventory_id,
        start_date=datetime(2026, 2, 25),
        expected_transplant_date=datetime(2026, 2, 25) + timedelta(weeks=8),
        seeds_started=12,
    ))


# =====================================================================
# Parent-scoped children — NO user_id column
#
# These 7 models are reachable only through their parent's ownership.
# Every isolation hole found in the audit lived in this group.
# =====================================================================

def create_health_record(livestock_id, type='vaccination'):
    return _commit(HealthRecord(
        livestock_id=livestock_id, type=type, treatment='CDT vaccine',
    ))


def create_egg_production(chicken_id, eggs_collected=4):
    return _commit(EggProduction(chicken_id=chicken_id, eggs_collected=eggs_collected))


def create_duck_egg(duck_id, eggs_collected=3):
    # NOTE: the column really is named chicken_id on DuckEggProduction — it
    # points at duck.id. Misnamed in the schema, kept for frontend compat.
    return _commit(DuckEggProduction(chicken_id=duck_id, eggs_collected=eggs_collected))


def create_hive_inspection(beehive_id):
    return _commit(HiveInspection(beehive_id=beehive_id, queen_seen=True, population='strong'))


def create_honey_harvest(beehive_id, honey_weight=10.0):
    return _commit(HoneyHarvest(beehive_id=beehive_id, honey_weight=honey_weight, frames_harvested=4))


def create_compost_ingredient(compost_pile_id, name='Grass clippings'):
    return _commit(CompostIngredient(
        compost_pile_id=compost_pile_id, name=name, amount=5.0, type='green',
    ))


def create_plan_item(garden_plan_id, seed_inventory_id=None, plant_id='tomato-1'):
    return _commit(GardenPlanItem(
        garden_plan_id=garden_plan_id, seed_inventory_id=seed_inventory_id,
        plant_id=plant_id, target_value=10.0, plant_equivalent=10,
    ))
