"""
Cross-User Foreign-Key Injection Tests

The isolation suites test the READ direction: "A creates a thing, B can't see
it." This file tests the WRITE direction, which is where the real holes were:
user B sends a perfectly well-formed request *of their own*, but points one of
its foreign keys at a record belonging to user A.

Two distinct impacts, both covered here:

1. **Write-through** — B attaches a child row to A's parent (e.g. a health
   record on A's animal). The row then shows up in A's list, because A's list
   is correctly scoped by *A's* parent.
2. **Read-back leak** — B references A's private row from B's own record, and
   a later GET dereferences it and reports its contents back to B. The seed /
   shopping-list path is the sharp example: it discloses another user's seed
   quantity, packet size and price.

Every test asserts THREE things, in this order:

1. the exact status code that blueprint uses (not ``in (403, 404)`` — a fix
   that returns the wrong flavour of error should be visible);
2. that **nothing was persisted** — queried straight from the DB, because a
   handler that returns 403 *after* ``db.session.commit()`` still leaked;
3. that the **third user is unaffected**, which is the part a two-user suite
   structurally cannot check.
"""

import pytest

from models import (
    db, GardenBed, GardenPlanItem, HealthRecord, EggProduction,
    DuckEggProduction, HiveInspection, HoneyHarvest, CompostIngredient,
    PlantingEvent, Photo, TrellisStructure, IndoorSeedStart,
)
from plant_database import COMPOST_MATERIALS
from tests import factories


# Taken from the live table rather than hardcoded, so a renamed material
# doesn't turn an isolation failure into a confusing 400.
A_VALID_COMPOST_MATERIAL = next(iter(COMPOST_MATERIALS))


# =====================================================================
# H1 — health records accept any livestockId
# =====================================================================

class TestHealthRecordFkInjection:
    """``POST /api/health-records`` — the one child endpoint in livestock_bp
    that historically did not verify its parent's owner, unlike
    egg-production / duck-egg-production / hive-inspections / honey-harvests.
    """

    def test_b_cannot_attach_health_record_to_a_animal(self, trio):
        a_animal = factories.create_livestock(trio['A']['user'].id, name='A Goat')
        c_animal = factories.create_livestock(trio['C']['user'].id, name='C Goat')

        resp = trio['B']['client'].post('/api/health-records', json={
            'livestockId': a_animal.id,
            'type': 'vaccination',
            'treatment': 'INJECTED BY B',
        })

        assert resp.status_code == 403
        assert HealthRecord.query.filter_by(livestock_id=a_animal.id).count() == 0
        assert HealthRecord.query.filter_by(livestock_id=c_animal.id).count() == 0

    def test_injected_record_does_not_appear_in_victim_list(self, trio):
        a_animal = factories.create_livestock(trio['A']['user'].id)

        trio['B']['client'].post('/api/health-records', json={
            'livestockId': a_animal.id,
            'type': 'vaccination',
            'treatment': 'INJECTED BY B',
        })

        a_records = trio['A']['client'].get('/api/health-records').get_json()
        assert all(r['treatment'] != 'INJECTED BY B' for r in a_records)

    def test_missing_livestock_id_does_not_500(self, trio):
        """A missing key must be a clean rejection, not a KeyError."""
        resp = trio['B']['client'].post('/api/health-records', json={'type': 'checkup'})
        assert resp.status_code < 500

    def test_owner_can_still_add_health_record(self, trio):
        """Negative control — the fix must not block the legitimate case."""
        animal = factories.create_livestock(trio['B']['user'].id)

        resp = trio['B']['client'].post('/api/health-records', json={
            'livestockId': animal.id, 'type': 'vaccination',
        })

        assert resp.status_code == 201


# =====================================================================
# The full parent-scoped child matrix
# =====================================================================

# (label, parent_factory, url_template, payload_builder, denied_status,
#  child_model, fk_attr, ok_status)
#
# ``denied_status`` and ``ok_status`` are both per-endpoint on purpose: these
# blueprints genuinely differ (403 vs 404 for denial; the compost route returns
# 200 with the recalculated pile rather than 201 with the ingredient). Asserting
# the exact code means a fix that returns the wrong flavour is caught.
CHILD_CASES = [
    ('egg_production', factories.create_chicken, '/api/egg-production',
     lambda p: {'chickenId': p.id, 'eggsCollected': 3}, 403,
     EggProduction, 'chicken_id', 201),

    ('duck_egg', factories.create_duck, '/api/duck-egg-production',
     lambda p: {'chickenId': p.id, 'eggsCollected': 3}, 403,
     DuckEggProduction, 'chicken_id', 201),

    ('hive_inspection', factories.create_beehive, '/api/hive-inspections',
     lambda p: {'beehiveId': p.id, 'population': 'strong'}, 403,
     HiveInspection, 'beehive_id', 201),

    ('honey_harvest', factories.create_beehive, '/api/honey-harvests',
     lambda p: {'beehiveId': p.id, 'honeyWeight': 10.0}, 403,
     HoneyHarvest, 'beehive_id', 201),

    ('health_record', factories.create_livestock, '/api/health-records',
     lambda p: {'livestockId': p.id, 'type': 'vaccination'}, 403,
     HealthRecord, 'livestock_id', 201),

    ('compost_ingredient', factories.create_compost,
     '/api/compost-piles/{pid}/ingredients',
     lambda p: {'material': A_VALID_COMPOST_MATERIAL, 'amount': 5.0}, 403,
     CompostIngredient, 'compost_pile_id', 200),

    ('plan_item', factories.create_plan, '/api/garden-plans/{pid}/items',
     lambda p: {'plantId': 'tomato-1', 'plantEquivalent': 10, 'targetValue': 10},
     404, GardenPlanItem, 'garden_plan_id', 201),
]

ATTACKER_PAIRS = [
    ('B', 'A'), ('C', 'A'),
    ('A', 'B'), ('C', 'B'),
    ('A', 'C'), ('B', 'C'),
]


class TestChildModelMatrix:
    """Every model with NO ``user_id`` column, in both directions.

    These 7 models are reachable only through their parent, so an endpoint
    that forgets the parent-ownership check has no second line of defence.
    Sweeping them as one table is what makes an inconsistent one obvious.
    """

    @pytest.mark.parametrize(
        'label,parent_factory,url_tpl,payload,expected,model,fk,ok_status',
        CHILD_CASES, ids=[c[0] for c in CHILD_CASES],
    )
    @pytest.mark.parametrize('attacker,victim', ATTACKER_PAIRS,
                             ids=lambda p: ''.join(p))
    def test_cannot_attach_child_to_foreign_parent(
        self, trio, label, parent_factory, url_tpl, payload, expected,
        model, fk, ok_status, attacker, victim,
    ):
        parent = parent_factory(trio[victim]['user'].id)
        third = next(x for x in 'ABC' if x not in (attacker, victim))
        third_parent = parent_factory(trio[third]['user'].id)

        resp = trio[attacker]['client'].post(
            url_tpl.format(pid=parent.id), json=payload(parent)
        )

        assert resp.status_code == expected, (
            f'{attacker} attaching {label} to {victim}: expected {expected}, '
            f'got {resp.status_code} {resp.get_json()}'
        )
        assert model.query.filter_by(**{fk: parent.id}).count() == 0, (
            f'{label} was persisted onto {victim}\'s parent despite the error'
        )
        assert model.query.filter_by(**{fk: third_parent.id}).count() == 0, (
            f'third party {third} was affected'
        )

    @pytest.mark.parametrize(
        'label,parent_factory,url_tpl,payload,expected,model,fk,ok_status',
        CHILD_CASES, ids=[c[0] for c in CHILD_CASES],
    )
    def test_owner_can_attach_child_to_own_parent(
        self, trio, label, parent_factory, url_tpl, payload, expected, model,
        fk, ok_status,
    ):
        """Negative control for the whole matrix."""
        parent = parent_factory(trio['B']['user'].id)

        resp = trio['B']['client'].post(
            url_tpl.format(pid=parent.id), json=payload(parent)
        )

        assert resp.status_code == ok_status, (
            f'owner blocked from creating own {label}: {resp.get_json()}'
        )
        assert model.query.filter_by(**{fk: parent.id}).count() == 1


# =====================================================================
# H2 — seedInventoryId on garden plan items (write + read-back leak)
# =====================================================================

class TestPlanItemSeedFkInjection:

    def test_b_cannot_reference_a_private_seed_via_plan_items_endpoint(self, trio):
        a_seed = factories.create_seed(trio['A']['user'].id, variety='A Secret')
        b_plan = factories.create_plan(trio['B']['user'].id)

        resp = trio['B']['client'].post(
            f'/api/garden-plans/{b_plan.id}/items',
            json={'plantId': 'tomato-1', 'plantEquivalent': 10,
                  'targetValue': 10, 'seedInventoryId': a_seed.id},
        )

        assert resp.status_code == 400
        assert GardenPlanItem.query.filter_by(seed_inventory_id=a_seed.id).count() == 0

    def test_b_cannot_reference_a_private_seed_at_plan_creation(self, trio):
        a_seed = factories.create_seed(trio['A']['user'].id, variety='A Secret')

        resp = trio['B']['client'].post('/api/garden-plans', json={
            'name': 'B Plan', 'year': 2026,
            'items': [{'plantId': 'tomato-1', 'plantEquivalent': 10,
                       'targetValue': 10, 'seedInventoryId': a_seed.id}],
        })

        assert resp.status_code == 400
        assert GardenPlanItem.query.filter_by(seed_inventory_id=a_seed.id).count() == 0


class TestShoppingListSeedLeak:
    """The read-back half of H2 — the one with real disclosure impact.

    ``GET /api/garden-plans/<id>/shopping-list`` dereferences each item's
    ``seed_inventory_id`` and reports ``seedsHave``, ``seedsPerPacket`` and a
    price-derived ``estimatedCost``. If a foreign seed id can be planted on a
    plan item, that endpoint reads it straight back out.
    """

    SECRET_PRICE = 99.99
    SECRET_QUANTITY = 7
    SECRET_PACKET = 13

    def _a_secret_seed(self, trio):
        return factories.create_seed(
            trio['A']['user'].id, variety='A Secret Seed',
            quantity=self.SECRET_QUANTITY, price=self.SECRET_PRICE,
            seeds_per_packet=self.SECRET_PACKET,
        )

    def test_shopping_list_does_not_disclose_foreign_seed(self, trio):
        a_seed = self._a_secret_seed(trio)
        b_plan = factories.create_plan(trio['B']['user'].id)

        trio['B']['client'].post(
            f'/api/garden-plans/{b_plan.id}/items',
            json={'plantId': 'tomato-1', 'plantEquivalent': 10,
                  'targetValue': 10, 'seedInventoryId': a_seed.id},
        )

        resp = trio['B']['client'].get(f'/api/garden-plans/{b_plan.id}/shopping-list')
        assert resp.status_code == 200

        for entry in _shopping_entries(resp.get_json()):
            # Assert on parsed fields, not a substring scan of the JSON —
            # a value like 13 would false-positive against unrelated numbers.
            assert entry.get('seedsHave') != self.SECRET_QUANTITY
            assert entry.get('seedsPerPacket') != self.SECRET_PACKET
            assert entry.get('estimatedCost') != self.SECRET_PRICE

    def test_direct_db_injection_still_does_not_leak(self, trio):
        """Defence in depth.

        Even if a foreign seed id reaches a plan item by some path that skips
        the endpoint (a migration, a script, a future unguarded write), the
        READ must not disclose it.
        """
        a_seed = self._a_secret_seed(trio)
        b_plan = factories.create_plan(trio['B']['user'].id)
        factories.create_plan_item(b_plan.id, seed_inventory_id=a_seed.id)

        resp = trio['B']['client'].get(f'/api/garden-plans/{b_plan.id}/shopping-list')
        assert resp.status_code == 200

        for entry in _shopping_entries(resp.get_json()):
            assert entry.get('seedsHave') != self.SECRET_QUANTITY
            assert entry.get('seedsPerPacket') != self.SECRET_PACKET
            assert entry.get('estimatedCost') != self.SECRET_PRICE


def _shopping_entries(body):
    """Flatten a shopping-list response to the list of per-crop entries."""
    if isinstance(body, list):
        return body
    if isinstance(body, dict):
        for key in ('items', 'shoppingList', 'crops', 'data'):
            if isinstance(body.get(key), list):
                return body[key]
        return [v for v in body.values() if isinstance(v, dict)]
    return []


# =====================================================================
# H3 / M6 — indoor seed starts
# =====================================================================

class TestIndoorSeedStartFkInjection:

    def test_b_cannot_reference_a_private_seed(self, trio):
        a_seed = factories.create_seed(trio['A']['user'].id, variety='A Secret')

        resp = trio['B']['client'].post('/api/indoor-seed-starts', json={
            'plantId': 'tomato-1', 'seedInventoryId': a_seed.id,
            'startDate': '2026-02-25T00:00:00Z', 'seedsStarted': 12,
        })

        assert resp.status_code == 404
        assert IndoorSeedStart.query.filter_by(seed_inventory_id=a_seed.id).count() == 0

    def test_b_cannot_repoint_own_seed_start_at_a_private_seed(self, trio):
        a_seed = factories.create_seed(trio['A']['user'].id, variety='A Secret')
        b_start = factories.create_indoor_seed_start(trio['B']['user'].id)

        resp = trio['B']['client'].put(
            f'/api/indoor-seed-starts/{b_start.id}',
            json={'seedInventoryId': a_seed.id},
        )

        assert resp.status_code == 404
        db.session.expire_all()
        assert db.session.get(IndoorSeedStart, b_start.id).seed_inventory_id != a_seed.id

    def test_b_cannot_target_a_bed_for_destination(self, trio):
        a_bed = factories.create_bed(trio['A']['user'].id)

        resp = trio['B']['client'].post('/api/indoor-seed-starts', json={
            'plantId': 'tomato-1', 'startDate': '2026-02-25T00:00:00Z',
            'seedsStarted': 12, 'destinationBedIds': [a_bed.id],
        })

        assert resp.status_code == 400
        assert IndoorSeedStart.query.count() == 0

    def test_owner_can_clear_seed_link(self, trio):
        """Negative control — ``None`` must stay assignable."""
        b_seed = factories.create_seed(trio['B']['user'].id)
        b_start = factories.create_indoor_seed_start(
            trio['B']['user'].id, seed_inventory_id=b_seed.id
        )

        resp = trio['B']['client'].put(
            f'/api/indoor-seed-starts/{b_start.id}', json={'seedInventoryId': None}
        )

        assert resp.status_code == 200


# =====================================================================
# M1 — planting events accept any gardenBedId
# =====================================================================

class TestPlantingEventBedFkInjection:

    # Each event type builds its PlantingEvent in its own branch, so each one
    # needs covering — a single guard at the top of the handler is what makes
    # them all safe, but that has to be proven per branch.
    EVENT_PAYLOADS = {
        'planting': {'plantId': 'tomato-1', 'quantity': 4,
                     'expectedHarvestDate': '2026-08-01T00:00:00Z'},
        'mulch': {'applicationDate': '2026-05-01T00:00:00Z',
                  'mulchType': 'straw', 'depthInches': 3, 'coverage': 'full'},
        'fertilizing': {'applicationDate': '2026-05-01T00:00:00Z',
                        'fertilizerType': 'balanced-organic', 'amount': 2},
        'irrigation': {'applicationDate': '2026-05-01T00:00:00Z',
                       'method': 'drip', 'durationMinutes': 30},
    }

    @pytest.mark.parametrize('event_type', sorted(EVENT_PAYLOADS))
    def test_b_cannot_create_event_on_a_bed(self, trio, event_type):
        a_bed = factories.create_bed(trio['A']['user'].id)

        payload = {'gardenBedId': a_bed.id, 'eventType': event_type}
        payload.update(self.EVENT_PAYLOADS[event_type])

        resp = trio['B']['client'].post('/api/planting-events', json=payload)

        assert resp.status_code == 403, resp.get_json()
        assert PlantingEvent.query.filter_by(garden_bed_id=a_bed.id).count() == 0

    @pytest.mark.parametrize('event_type', sorted(EVENT_PAYLOADS))
    def test_owner_can_create_each_event_type_on_own_bed(self, trio, event_type):
        """Negative control across all four branches."""
        bed = factories.create_bed(trio['B']['user'].id)

        payload = {'gardenBedId': bed.id, 'eventType': event_type}
        payload.update(self.EVENT_PAYLOADS[event_type])

        resp = trio['B']['client'].post('/api/planting-events', json=payload)

        assert resp.status_code == 201, resp.get_json()

    def test_response_does_not_echo_foreign_bed_geometry(self, trio):
        """The rejected request must not disclose the victim bed's config.

        The old code fetched the bed unconditionally and fed its ``grid_size``
        and ``planning_method`` into the space calculation it returned.
        """
        a_bed = factories.create_bed(
            trio['A']['user'].id, width=99.0, length=99.0,
        )

        resp = trio['B']['client'].post('/api/planting-events', json={
            'gardenBedId': a_bed.id, 'eventType': 'planting',
            'plantId': 'tomato-1', 'quantity': 4,
            'expectedHarvestDate': '2026-08-01T00:00:00Z',
        })

        assert resp.status_code == 403
        assert 'spaceRequired' not in (resp.get_json() or {})


# =====================================================================
# M2 / M3 — photos and trellises accept any gardenBedId
# =====================================================================

class TestPhotoBedFkInjection:

    def test_b_cannot_repoint_own_photo_at_a_bed(self, trio):
        a_bed = factories.create_bed(trio['A']['user'].id)
        b_photo = factories.create_photo(trio['B']['user'].id)

        resp = trio['B']['client'].put(f'/api/photos/{b_photo.id}',
                                       json={'gardenBedId': a_bed.id})

        assert resp.status_code == 403
        db.session.expire_all()
        assert db.session.get(Photo, b_photo.id).garden_bed_id != a_bed.id

    def test_owner_can_link_photo_to_own_bed(self, trio):
        bed = factories.create_bed(trio['B']['user'].id)
        photo = factories.create_photo(trio['B']['user'].id)

        resp = trio['B']['client'].put(f'/api/photos/{photo.id}',
                                       json={'gardenBedId': bed.id})

        assert resp.status_code == 200


class TestTrellisBedFkInjection:

    def test_b_cannot_create_trellis_on_a_bed(self, trio):
        a_bed = factories.create_bed(trio['A']['user'].id)

        resp = trio['B']['client'].post('/api/trellis-structures', json={
            'name': 'B Trellis', 'gardenBedId': a_bed.id,
            'startX': 0, 'startY': 0, 'endX': 10, 'endY': 0,
            'totalLengthFeet': 10,
        })

        assert resp.status_code == 403
        assert TrellisStructure.query.filter_by(garden_bed_id=a_bed.id).count() == 0

    def test_owner_can_create_trellis_on_own_bed(self, trio):
        bed = factories.create_bed(trio['B']['user'].id)

        resp = trio['B']['client'].post('/api/trellis-structures', json={
            'name': 'B Trellis', 'gardenBedId': bed.id,
            'startX': 0, 'startY': 0, 'endX': 10, 'endY': 0,
            'totalLengthFeet': 10,
        })

        assert resp.status_code == 201
