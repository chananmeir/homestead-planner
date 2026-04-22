"""
Regression tests for Save-for-Seed toggle persistence.

Phase B smoke finding #10 reported that after marking a plant "Save for
Seed", leaving and reopening the plant shows it no longer marked.

These tests exercise the full round-trip of the toggle against the HTTP
surface:

    1. Create a PlantedItem (save_for_seed defaults to False).
    2. PUT {"saveForSeed": true}  -> expect 200, saveForSeed == True.
    3. Re-fetch the PlantedItem via GET /api/garden-beds -> expect
       saveForSeed == True in the nested plantedItems payload (this is
       what the frontend calls when the user navigates away and returns).
    4. PUT {"saveForSeed": false} -> expect 200, saveForSeed == False.
    5. Re-fetch -> expect saveForSeed == False.

If any of these round-trip asserts fails we have regressed the
persistence contract used by the GardenDesigner seed-saving toggle.
"""

import pytest
from models import db, GardenBed, PlantedItem


# =====================================================================
# Helpers
# =====================================================================

def _create_bed(session, user, name='Seed Saving Bed'):
    bed = GardenBed(user_id=user.id, name=name, width=4.0, length=8.0)
    session.add(bed)
    session.commit()
    return bed


def _create_planted_item(session, user, bed, **overrides):
    defaults = dict(
        user_id=user.id,
        garden_bed_id=bed.id,
        plant_id='tomato-1',
        status='growing',
        position_x=0,
        position_y=0,
        quantity=1,
    )
    defaults.update(overrides)
    item = PlantedItem(**defaults)
    session.add(item)
    session.commit()
    return item


def _find_item_in_beds_payload(beds_payload, item_id):
    """Locate a single planted item in the /api/garden-beds nested payload."""
    for bed in beds_payload:
        for it in bed.get('plantedItems', []):
            if it.get('id') == item_id:
                return it
    return None


# =====================================================================
# Tests
# =====================================================================

class TestSaveForSeedPersistence:
    """End-to-end persistence tests for the saveForSeed toggle."""

    def test_save_for_seed_defaults_to_false(self, full_app, full_db, user_a, auth_client_a):
        """New PlantedItem should not be marked for seed saving by default."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)

            resp = auth_client_a.get('/api/garden-beds')
            assert resp.status_code == 200
            payload = resp.get_json()
            found = _find_item_in_beds_payload(payload, item.id)
            assert found is not None, 'PlantedItem not present in /api/garden-beds payload'
            assert found['saveForSeed'] is False

    def test_toggle_on_persists_in_put_response(self, full_app, full_db, user_a, auth_client_a):
        """PUT {saveForSeed: true} should return saveForSeed=true in response."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)

            resp = auth_client_a.put(f'/api/planted-items/{item.id}',
                                     json={'saveForSeed': True})
            assert resp.status_code == 200
            payload = resp.get_json()
            assert payload['saveForSeed'] is True, (
                f"PUT response missing saveForSeed=true; got {payload.get('saveForSeed')!r}"
            )

    def test_toggle_on_persists_in_subsequent_get(self, full_app, full_db, user_a, auth_client_a):
        """After PUT {saveForSeed: true}, /api/garden-beds should return true.

        This is the exact scenario from Phase B smoke finding #10: the
        frontend calls loadData() when the user navigates back, which
        refetches /api/garden-beds. If the flag doesn't round-trip here,
        the UI toggle renders unchecked.
        """
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)

            put_resp = auth_client_a.put(f'/api/planted-items/{item.id}',
                                         json={'saveForSeed': True})
            assert put_resp.status_code == 200

            get_resp = auth_client_a.get('/api/garden-beds')
            assert get_resp.status_code == 200
            found = _find_item_in_beds_payload(get_resp.get_json(), item.id)
            assert found is not None
            assert found['saveForSeed'] is True, (
                f"saveForSeed did not persist across GET; got {found.get('saveForSeed')!r}"
            )

    def test_toggle_off_persists_in_put_response(self, full_app, full_db, user_a, auth_client_a):
        """PUT {saveForSeed: false} after enabling should return false."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)

            # Turn on
            r1 = auth_client_a.put(f'/api/planted-items/{item.id}',
                                   json={'saveForSeed': True})
            assert r1.status_code == 200
            assert r1.get_json()['saveForSeed'] is True

            # Turn off
            r2 = auth_client_a.put(f'/api/planted-items/{item.id}',
                                   json={'saveForSeed': False})
            assert r2.status_code == 200
            assert r2.get_json()['saveForSeed'] is False

    def test_full_toggle_round_trip(self, full_app, full_db, user_a, auth_client_a):
        """Complete user journey: off -> on -> GET -> off -> GET."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)
            item_id = item.id

            # 1. Initial GET: false
            g0 = auth_client_a.get('/api/garden-beds')
            assert _find_item_in_beds_payload(g0.get_json(), item_id)['saveForSeed'] is False

            # 2. Toggle ON
            auth_client_a.put(f'/api/planted-items/{item_id}',
                              json={'saveForSeed': True})

            # 3. GET again: true (this is the Phase B scenario)
            g1 = auth_client_a.get('/api/garden-beds')
            assert _find_item_in_beds_payload(g1.get_json(), item_id)['saveForSeed'] is True

            # 4. Toggle OFF
            auth_client_a.put(f'/api/planted-items/{item_id}',
                              json={'saveForSeed': False})

            # 5. GET again: false
            g2 = auth_client_a.get('/api/garden-beds')
            assert _find_item_in_beds_payload(g2.get_json(), item_id)['saveForSeed'] is False

    def test_toggle_on_sets_status_to_saving_seed(self, full_app, full_db, user_a, auth_client_a):
        """Enabling save_for_seed should set status='saving-seed' and persist it."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed, status='growing')

            auth_client_a.put(f'/api/planted-items/{item.id}',
                              json={'saveForSeed': True})

            g = auth_client_a.get('/api/garden-beds')
            found = _find_item_in_beds_payload(g.get_json(), item.id)
            assert found['saveForSeed'] is True
            assert found['status'] == 'saving-seed'

    def test_toggle_off_restores_status(self, full_app, full_db, user_a, auth_client_a):
        """Disabling save_for_seed should restore status from lifecycle state."""
        from datetime import datetime
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(
                full_db.session, user_a, bed,
                status='growing',
                planted_date=datetime(2026, 4, 1),
            )

            # Turn on
            auth_client_a.put(f'/api/planted-items/{item.id}',
                              json={'saveForSeed': True})
            # Turn off
            auth_client_a.put(f'/api/planted-items/{item.id}',
                              json={'saveForSeed': False})

            g = auth_client_a.get('/api/garden-beds')
            found = _find_item_in_beds_payload(g.get_json(), item.id)
            assert found['saveForSeed'] is False
            # Status should have been restored (not 'saving-seed' anymore)
            assert found['status'] != 'saving-seed'
