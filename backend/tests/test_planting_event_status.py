"""
Tests for PlantingEvent completion state consistency.

Phase 1 tests document current behavior (some test names note known gaps).
Phase 2 tests assert corrected behavior after normalization.

Uses full_app/auth_client fixtures from conftest.py for HTTP-level tests.
"""

import pytest
from models import db, PlantingEvent, PlantedItem, GardenBed


# =====================================================================
# Helpers
# =====================================================================

def _create_event(session, user, bed, **overrides):
    """Create a PlantingEvent with sensible defaults."""
    defaults = dict(
        user_id=user.id,
        garden_bed_id=bed.id,
        plant_id='tomato-1',
        event_type='planting',
        quantity=10,
        completed=False,
        quantity_completed=None,
    )
    defaults.update(overrides)
    event = PlantingEvent(**defaults)
    session.add(event)
    session.commit()
    return event


def _create_planted_item(session, user, bed, **overrides):
    """Create a PlantedItem with sensible defaults."""
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


def _create_bed(session, user, name='Test Bed'):
    """Create a GardenBed for the given user."""
    bed = GardenBed(
        user_id=user.id,
        name=name,
        width=4.0,
        length=8.0,
    )
    session.add(bed)
    session.commit()
    return bed


# =====================================================================
# Class 1: TestCompletionModel — is_complete property (7 tests)
# =====================================================================

class TestCompletionModel:
    """Test the PlantingEvent.is_complete computed property."""

    def test_default_is_not_complete(self, full_app, full_db, user_a):
        """New event with defaults should not be complete."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed)
            assert event.is_complete is False

    def test_quantity_based_complete(self, full_app, full_db, user_a):
        """quantity_completed >= quantity → is_complete True."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed,
                                  quantity=10, quantity_completed=10)
            assert event.is_complete is True

    def test_quantity_based_partial(self, full_app, full_db, user_a):
        """quantity_completed < quantity → is_complete False."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed,
                                  quantity=10, quantity_completed=5)
            assert event.is_complete is False

    def test_fallback_to_completed_boolean(self, full_app, full_db, user_a):
        """When quantity_completed is None, fall back to completed boolean."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed,
                                  completed=True, quantity_completed=None)
            assert event.is_complete is True

    def test_zero_quantity_completed_is_not_complete(self, full_app, full_db, user_a):
        """quantity_completed=0 with quantity=10 → not complete."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed,
                                  quantity=10, quantity_completed=0)
            assert event.is_complete is False

    def test_quantity_overrides_completed_boolean(self, full_app, full_db, user_a):
        """quantity_completed < quantity overrides completed=True."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed,
                                  completed=True, quantity=10, quantity_completed=5)
            assert event.is_complete is False

    def test_to_dict_includes_is_complete(self, full_app, full_db, user_a):
        """to_dict() must include isComplete key."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed,
                                  quantity=10, quantity_completed=10)
            d = event.to_dict()
            assert 'isComplete' in d
            assert d['isComplete'] is True


# =====================================================================
# Class 2: TestPutCompletion — PUT /api/planting-events/:id (5 tests)
# =====================================================================

class TestPutCompletion:
    """Test completion behavior of the PUT planting-event endpoint."""

    def test_set_completed_true_auto_sets_quantity(self, full_app, full_db, user_a, auth_client_a):
        """PUT completed=True without quantityCompleted auto-sets qty.

        Phase 2 behavior: completed=True → quantity_completed=quantity.
        """
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed, quantity=10)
            resp = auth_client_a.put(f'/api/planting-events/{event.id}',
                                     json={'completed': True})
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['completed'] is True
            # Phase 2: quantity_completed auto-set
            assert data['quantityCompleted'] == 10

    def test_quantity_completed_auto_derives_completed(self, full_app, full_db, user_a, auth_client_a):
        """PUT quantityCompleted >= quantity sets completed=True."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed, quantity=10)
            resp = auth_client_a.put(f'/api/planting-events/{event.id}',
                                     json={'quantityCompleted': 10})
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['completed'] is True
            assert data['quantityCompleted'] == 10

    def test_partial_quantity_completed(self, full_app, full_db, user_a, auth_client_a):
        """PUT quantityCompleted < quantity keeps completed=False."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed, quantity=10)
            resp = auth_client_a.put(f'/api/planting-events/{event.id}',
                                     json={'quantityCompleted': 5})
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['completed'] is False
            assert data['quantityCompleted'] == 5

    def test_conflict_completed_true_qty_partial(self, full_app, full_db, user_a, auth_client_a):
        """PUT completed=True + quantityCompleted=5 — qty check wins.

        Phase 2: quantityCompleted takes precedence over completed boolean.
        """
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed, quantity=10)
            resp = auth_client_a.put(f'/api/planting-events/{event.id}',
                                     json={'completed': True, 'quantityCompleted': 5})
            assert resp.status_code == 200
            data = resp.get_json()
            # quantityCompleted processing runs after completed is set,
            # overriding it to False since 5 < 10
            assert data['completed'] is False
            assert data['quantityCompleted'] == 5

    def test_set_completed_false_resets_quantity(self, full_app, full_db, user_a, auth_client_a):
        """PUT completed=False auto-resets quantity_completed to 0.

        Phase 2 behavior: completed=False → quantity_completed=0.
        """
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed,
                                  quantity=10, quantity_completed=10, completed=True)
            resp = auth_client_a.put(f'/api/planting-events/{event.id}',
                                     json={'completed': False})
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['completed'] is False
            # Phase 2: quantity_completed auto-reset
            assert data['quantityCompleted'] == 0


# =====================================================================
# Class 3: TestBulkUpdateCompletion — PATCH /api/planting-events/bulk-update (3 tests)
# =====================================================================

class TestBulkUpdateCompletion:
    """Test bulk update completion sync."""

    def test_bulk_mark_complete(self, full_app, full_db, user_a, auth_client_a):
        """Bulk mark completed=True + qty auto-set."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            e1 = _create_event(full_db.session, user_a, bed, quantity=10)
            e2 = _create_event(full_db.session, user_a, bed, quantity=5)
            resp = auth_client_a.patch('/api/planting-events/bulk-update',
                                       json={
                                           'eventIds': [e1.id, e2.id],
                                           'updates': {'completed': True}
                                       })
            assert resp.status_code == 200
            # Verify both events
            r1 = auth_client_a.get(f'/api/planting-events/{e1.id}')
            # Fetch individual events via the list endpoint
            # Use direct model query instead
            ev1 = PlantingEvent.query.get(e1.id)
            ev2 = PlantingEvent.query.get(e2.id)
            assert ev1.completed is True
            assert ev2.completed is True
            # Phase 2: auto-set quantity_completed
            assert ev1.quantity_completed == 10
            assert ev2.quantity_completed == 5

    def test_bulk_quantity_derives_completed(self, full_app, full_db, user_a, auth_client_a):
        """Bulk quantityCompleted >= quantity sets completed."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed, quantity=10)
            resp = auth_client_a.patch('/api/planting-events/bulk-update',
                                       json={
                                           'eventIds': [event.id],
                                           'updates': {'quantityCompleted': 10}
                                       })
            assert resp.status_code == 200
            ev = PlantingEvent.query.get(event.id)
            assert ev.completed is True
            assert ev.quantity_completed == 10

    def test_bulk_completed_false_resets_quantity(self, full_app, full_db, user_a, auth_client_a):
        """Bulk completed=False resets quantity_completed.

        Phase 2 behavior.
        """
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed,
                                  quantity=10, quantity_completed=10, completed=True)
            resp = auth_client_a.patch('/api/planting-events/bulk-update',
                                       json={
                                           'eventIds': [event.id],
                                           'updates': {'completed': False}
                                       })
            assert resp.status_code == 200
            ev = PlantingEvent.query.get(event.id)
            assert ev.completed is False
            # Phase 2: auto-reset
            assert ev.quantity_completed == 0


# =====================================================================
# Class 4: TestHarvestCompletion — PATCH /api/planting-events/:id/harvest (2 tests)
# =====================================================================

class TestHarvestCompletion:
    """Test that harvest endpoint sets completion state."""

    def test_harvest_sets_completed(self, full_app, full_db, user_a, auth_client_a):
        """PATCH /harvest sets completed=True and quantity_completed=quantity.

        Phase 2 behavior: harvesting implies completion.
        """
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed, quantity=10)
            resp = auth_client_a.patch(f'/api/planting-events/{event.id}/harvest',
                                       json={'harvestDate': '2026-08-15T00:00:00Z'})
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['actualHarvestDate'] is not None
            # Phase 2: harvest sets completion
            assert data['completed'] is True
            assert data['quantityCompleted'] == 10

    def test_harvest_preserves_existing_completed(self, full_app, full_db, user_a, auth_client_a):
        """Harvest on already-completed event keeps completed=True."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed,
                                  quantity=10, quantity_completed=10, completed=True)
            resp = auth_client_a.patch(f'/api/planting-events/{event.id}/harvest',
                                       json={'harvestDate': '2026-08-15T00:00:00Z'})
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['completed'] is True
            assert data['quantityCompleted'] == 10


# =====================================================================
# Class 5: TestCrossModelIndependence — PlantedItem ↔ PlantingEvent (2 tests)
# =====================================================================

class TestCrossModelIndependence:
    """Test that PlantedItem status changes propagate to PlantingEvent
    only for the 'harvested' transition (Phase 2)."""

    def test_planted_item_harvested_completes_planting_event(self, full_app, full_db, user_a, auth_client_a):
        """PlantedItem status='harvested' → linked PlantingEvent.completed=True.

        Phase 2 behavior: cross-model harvest sync.
        """
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            # Create a PlantingEvent at position (0,0)
            event = _create_event(full_db.session, user_a, bed,
                                  position_x=0, position_y=0, quantity=1)
            # Create a PlantedItem at the same position
            item = _create_planted_item(full_db.session, user_a, bed,
                                        position_x=0, position_y=0,
                                        status='growing')

            # Update PlantedItem status to harvested
            resp = auth_client_a.put(f'/api/planted-items/{item.id}',
                                     json={'status': 'harvested'})
            assert resp.status_code == 200

            # Check that the linked PlantingEvent is now completed
            ev = PlantingEvent.query.get(event.id)
            assert ev.completed is True
            if ev.quantity is not None:
                assert ev.quantity_completed == ev.quantity

    def test_seed_saving_toggle_does_not_complete_planting_event(self, full_app, full_db, user_a, auth_client_a):
        """Toggling save_for_seed on PlantedItem does not set PlantingEvent.completed."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed,
                                  position_x=0, position_y=0, quantity=1)
            item = _create_planted_item(full_db.session, user_a, bed,
                                        position_x=0, position_y=0,
                                        status='growing')

            # Toggle seed saving ON
            resp = auth_client_a.put(f'/api/planted-items/{item.id}',
                                     json={'saveForSeed': True})
            assert resp.status_code == 200

            # PlantingEvent should NOT be completed
            ev = PlantingEvent.query.get(event.id)
            assert ev.completed is False
