"""
Tests for the maturity-learning service (services/maturity_learning.py) and the
harvest-capture wiring in blueprints/harvests_bp.py.

Covers: per-harvest correction, EWMA recency weighting (incl. 2-year half-life),
the resolve_dtm precedence chain (incl. DTM/days-in-ground 0 respected), 0/1/many
samples, covered-derived-from-season_extension, recompute on the aggregate vs exact
keys, last-sample-removed deletes the row, and the HTTP capture path.
"""
from datetime import datetime, timedelta
import json

import pytest

from models import db, HarvestRecord, PlantedItem, VarietyMaturityModel, GardenBed
from services import maturity_learning as ml


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _make_harvest(user_id, *, plant_id='beet-1', variety='Detroit',
                  sun='full', covered=False, days_in_ground=60,
                  feedback='on_time', harvest_date=None):
    rec = HarvestRecord(
        user_id=user_id,
        plant_id=plant_id,
        harvest_date=harvest_date or datetime(2026, 6, 1),
        quantity=1.0,
        unit='lbs',
        maturity_feedback=feedback,
        days_in_ground=days_in_ground,
        variety_snapshot=variety,
        sun_exposure_snapshot=sun,
        covered_snapshot=covered,
    )
    db.session.add(rec)
    db.session.flush()
    return rec


# --------------------------------------------------------------------------- #
# per_harvest_estimate
# --------------------------------------------------------------------------- #

class TestPerHarvestEstimate:
    def test_on_time_is_identity(self):
        assert ml.per_harvest_estimate(60, 'on_time') == 60

    def test_too_early_lengthens(self):
        assert ml.per_harvest_estimate(60, 'too_early') == pytest.approx(69.0)

    def test_too_late_shortens(self):
        assert ml.per_harvest_estimate(60, 'too_late') == pytest.approx(54.0)

    def test_days_zero_is_valid(self):
        # 0 days-in-ground is a real value, not "missing".
        assert ml.per_harvest_estimate(0, 'on_time') == 0

    def test_none_days_returns_none(self):
        assert ml.per_harvest_estimate(None, 'on_time') is None

    def test_unknown_feedback_returns_none(self):
        assert ml.per_harvest_estimate(60, 'pest') is None
        assert ml.per_harvest_estimate(60, None) is None


# --------------------------------------------------------------------------- #
# bed_is_covered / bed_sun_exposure
# --------------------------------------------------------------------------- #

class TestBedDerivation:
    def test_no_season_extension_is_uncovered(self, sample_bed):
        sample_bed.season_extension = None
        assert ml.bed_is_covered(sample_bed) is False

    def test_type_none_is_uncovered(self, sample_bed):
        sample_bed.season_extension = json.dumps({'type': 'none'})
        assert ml.bed_is_covered(sample_bed) is False

    def test_row_cover_is_covered(self, sample_bed):
        sample_bed.season_extension = json.dumps({'type': 'row-cover', 'layers': 1})
        assert ml.bed_is_covered(sample_bed) is True

    def test_malformed_json_does_not_raise(self, sample_bed):
        sample_bed.season_extension = '{not valid json'
        assert ml.bed_is_covered(sample_bed) is False

    def test_sun_exposure_coalesced_to_unknown(self, sample_bed):
        sample_bed.sun_exposure = None
        assert ml.bed_sun_exposure(sample_bed) == 'unknown'
        sample_bed.sun_exposure = 'partial'
        assert ml.bed_sun_exposure(sample_bed) == 'partial'


# --------------------------------------------------------------------------- #
# EWMA recompute
# --------------------------------------------------------------------------- #

class TestRecompute:
    def test_single_sample_equals_estimate(self, sample_user):
        _make_harvest(sample_user.id, days_in_ground=60, feedback='too_early')
        ml.recompute_key(sample_user.id, 'beet-1', 'Detroit', 'full', False,
                         now=datetime(2026, 6, 1))
        db.session.commit()
        row = VarietyMaturityModel.query.filter_by(
            user_id=sample_user.id, plant_id='beet-1', variety='Detroit',
            sun_exposure='full', covered=False).first()
        assert row is not None
        assert row.learned_dtm == 69      # 60 * 1.15
        assert row.sample_count == 1

    def test_two_year_half_life_weighting(self, sample_user):
        now = datetime(2026, 6, 1)
        # Recent on-time harvest at 50 days (weight 1.0).
        _make_harvest(sample_user.id, days_in_ground=50, feedback='on_time',
                      harvest_date=now)
        # 2-year-old on-time harvest at 80 days (weight 0.5).
        _make_harvest(sample_user.id, days_in_ground=80, feedback='on_time',
                      harvest_date=now - timedelta(days=730))
        ml.recompute_key(sample_user.id, 'beet-1', 'Detroit', 'full', False, now=now)
        db.session.commit()
        row = VarietyMaturityModel.query.filter_by(
            user_id=sample_user.id, plant_id='beet-1', sun_exposure='full',
            covered=False).first()
        # (1.0*50 + 0.5*80) / 1.5 = 90/1.5 = 60
        assert row.learned_dtm == 60
        assert row.sample_count == 2

    def test_zero_samples_no_row(self, sample_user):
        ml.recompute_key(sample_user.id, 'beet-1', 'Detroit', 'full', False,
                         now=datetime(2026, 6, 1))
        db.session.commit()
        assert VarietyMaturityModel.query.count() == 0

    def test_last_sample_removed_deletes_row(self, sample_user):
        rec = _make_harvest(sample_user.id, days_in_ground=60, feedback='on_time')
        ml.recompute_key(sample_user.id, 'beet-1', 'Detroit', 'full', False,
                         now=datetime(2026, 6, 1))
        db.session.commit()
        assert VarietyMaturityModel.query.count() == 1
        # Remove the only sample, recompute → row deleted.
        db.session.delete(rec)
        db.session.flush()
        ml.recompute_key(sample_user.id, 'beet-1', 'Detroit', 'full', False,
                         now=datetime(2026, 6, 1))
        db.session.commit()
        assert VarietyMaturityModel.query.count() == 0

    def test_records_without_signal_excluded(self, sample_user):
        # days_in_ground None and feedback None are both excluded.
        _make_harvest(sample_user.id, days_in_ground=None, feedback='on_time')
        _make_harvest(sample_user.id, days_in_ground=60, feedback=None)
        ml.recompute_key(sample_user.id, 'beet-1', 'Detroit', 'full', False,
                         now=datetime(2026, 6, 1))
        db.session.commit()
        assert VarietyMaturityModel.query.count() == 0


class TestRefreshFromHarvest:
    def test_recomputes_exact_and_aggregate(self, sample_user):
        rec = _make_harvest(sample_user.id, sun='full', covered=False,
                            days_in_ground=60, feedback='too_early')
        ml.refresh_from_harvest(rec, now=datetime(2026, 6, 1))
        db.session.commit()
        exact = VarietyMaturityModel.query.filter_by(
            sun_exposure='full', covered=False).first()
        agg = VarietyMaturityModel.query.filter_by(
            sun_exposure=None, covered=None).first()
        assert exact is not None and exact.learned_dtm == 69
        assert agg is not None and agg.learned_dtm == 69


# --------------------------------------------------------------------------- #
# resolve_dtm precedence
# --------------------------------------------------------------------------- #

class TestResolveDtm:
    def test_manual_override_wins(self, sample_user):
        class _Seed:
            days_to_maturity = 99
        # Even with a learned row present, the manual override takes precedence.
        _make_harvest(sample_user.id, days_in_ground=60, feedback='on_time')
        ml.refresh_from_harvest(
            HarvestRecord.query.first(), now=datetime(2026, 6, 1))
        db.session.commit()
        assert ml.resolve_dtm(sample_user.id, 'beet-1', 'Detroit', 'full', False,
                              seed_inventory=_Seed()) == 99

    def test_manual_override_zero_respected(self, sample_user):
        class _Seed:
            days_to_maturity = 0
        assert ml.resolve_dtm(sample_user.id, 'beet-1', 'Detroit', 'full', False,
                              seed_inventory=_Seed()) == 0

    def test_exact_learned(self, sample_user):
        rec = _make_harvest(sample_user.id, sun='full', covered=False,
                            days_in_ground=70, feedback='on_time')
        ml.refresh_from_harvest(rec, now=datetime(2026, 6, 1))
        db.session.commit()
        assert ml.resolve_dtm(sample_user.id, 'beet-1', 'Detroit', 'full', False) == 70

    def test_aggregate_fallback_when_combo_unseen(self, sample_user):
        # Sample recorded in full-sun/uncovered; resolving for shade/covered (unseen
        # exact combo) falls back to the variety-wide aggregate.
        rec = _make_harvest(sample_user.id, sun='full', covered=False,
                            days_in_ground=70, feedback='on_time')
        ml.refresh_from_harvest(rec, now=datetime(2026, 6, 1))
        db.session.commit()
        assert ml.resolve_dtm(sample_user.id, 'beet-1', 'Detroit', 'shade', True) == 70

    def test_plant_db_default(self, sample_user):
        assert ml.resolve_dtm(sample_user.id, 'beet-1', 'Detroit', 'full', False) == 55

    def test_fallback_60_for_unknown_plant(self, sample_user):
        assert ml.resolve_dtm(sample_user.id, 'no-such-plant', 'X', 'full', False) == 60

    def test_optional_returns_none_for_unknown_plant(self, sample_user):
        assert ml.resolve_dtm_optional(
            sample_user.id, 'no-such-plant', 'X', 'full', False) is None

    def test_learned_zero_respected(self, sample_user):
        # A learned value of 0 must win over the plant-DB default, not be treated falsy.
        row = VarietyMaturityModel(
            user_id=sample_user.id, plant_id='beet-1', variety='Detroit',
            sun_exposure='full', covered=False, learned_dtm=0, sample_count=1)
        db.session.add(row)
        db.session.commit()
        assert ml.resolve_dtm(sample_user.id, 'beet-1', 'Detroit', 'full', False) == 0


# --------------------------------------------------------------------------- #
# HTTP capture path
# --------------------------------------------------------------------------- #

class TestHarvestCaptureHttp:
    def _make_bed_and_item(self, full_db, user):
        bed = GardenBed(user_id=user.id, name='Sun Bed', width=4.0, length=8.0,
                        sun_exposure='full')
        full_db.session.add(bed)
        full_db.session.flush()
        item = PlantedItem(
            user_id=user.id, plant_id='beet-1', variety='Detroit',
            garden_bed_id=bed.id,
            planted_date=datetime(2026, 4, 1), quantity=4)
        full_db.session.add(item)
        full_db.session.commit()
        return bed, item

    def test_bed_linked_harvest_persists_snapshot_and_learns(self, auth_client_a, user_a, full_db):
        _bed, item = self._make_bed_and_item(full_db, user_a)
        resp = auth_client_a.post('/api/harvests', json={
            'plantId': 'beet-1',
            'plantedItemId': item.id,
            'harvestDate': '2026-05-16T00:00:00Z',   # 45 days after 2026-04-01
            'quantity': 0.5,
            'maturityFeedback': 'too_early',
            'outcomeReason': 'immature',
        })
        assert resp.status_code == 201, resp.get_json()
        body = resp.get_json()
        assert body['maturityFeedback'] == 'too_early'
        assert body['daysInGround'] == 45
        assert body['sunExposureSnapshot'] == 'full'
        assert body['coveredSnapshot'] is False

        # A learned row was materialized: 45 * 1.15 = 51.75 → 52
        row = VarietyMaturityModel.query.filter_by(
            user_id=user_a.id, plant_id='beet-1', variety='Detroit',
            sun_exposure='full', covered=False).first()
        assert row is not None
        assert row.learned_dtm == 52
        assert row.sample_count == 1

    def test_plant_only_harvest_records_no_signal(self, auth_client_a, user_a, full_db):
        # The generic plant-only harvest (no plantedItemId) contributes nothing.
        resp = auth_client_a.post('/api/harvests', json={
            'plantId': 'beet-1',
            'harvestDate': '2026-05-16T00:00:00Z',
            'quantity': 2.0,
        })
        assert resp.status_code == 201
        assert resp.get_json()['maturityFeedback'] is None
        assert VarietyMaturityModel.query.count() == 0

    def test_delete_recomputes_and_removes_row(self, auth_client_a, user_a, full_db):
        _bed, item = self._make_bed_and_item(full_db, user_a)
        resp = auth_client_a.post('/api/harvests', json={
            'plantId': 'beet-1', 'plantedItemId': item.id,
            'harvestDate': '2026-05-16T00:00:00Z', 'quantity': 0.5,
            'maturityFeedback': 'too_early',
        })
        rec_id = resp.get_json()['id']
        assert VarietyMaturityModel.query.count() >= 1
        del_resp = auth_client_a.delete(f'/api/harvests/{rec_id}')
        assert del_resp.status_code == 204
        # The only sample is gone → both exact and aggregate rows removed.
        assert VarietyMaturityModel.query.count() == 0
