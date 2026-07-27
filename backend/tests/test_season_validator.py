"""
Regression tests for backend/season_validator.py

Covers two bugs that surfaced when the app runs in simulation mode with a
simulated "today" different from the real system clock:

BUG 1 — Live weather path ignored simulation mode.
    When planting_date was today/tomorrow, validate_planting_conditions()
    called get_soil_temperature_with_adjustments(), which internally uses
    datetime.now() and live Open-Meteo. In simulation the returned
    real-time soil temperature masked the simulated-month climate.

BUG 2 — calculate_cooler_planting_dates searched BACKWARDS, returning
    past dates (e.g. "Earliest (Risky): July 4, 2023" when simulating
    2024-01-01).
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, datetime, timedelta
from unittest.mock import patch

import pytest

import season_validator
import simulation_clock


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_daily_temps_by_month(month: int):
    """Return a realistic Northern-Hemisphere temperate daily-temp mapping.

    Returns a dict: {day-of-month: temperature-in-F}.
    Used to stub get_historical_daily_soil_temps so we don't hit the
    network during tests.
    """
    # Rough Northern-Hemisphere temperate soil temps (F). Jan cold, Jul hot.
    monthly_mean = {
        1: 34,  2: 36,  3: 44,  4: 54,  5: 64,  6: 74,
        7: 82,  8: 80,  9: 70, 10: 58, 11: 46, 12: 38,
    }
    base = monthly_mean.get(month, 60)
    return {d: float(base) for d in range(1, 32)}


@pytest.fixture(autouse=True)
def reset_simulation_clock():
    """Ensure each test starts with simulation OFF and clears it after."""
    simulation_clock.set_simulated_date(None)
    yield
    simulation_clock.set_simulated_date(None)


# ---------------------------------------------------------------------------
# BUG 1: validate_planting_conditions must not call live weather when simulating
# ---------------------------------------------------------------------------

def test_simulation_uses_historical_not_live_weather():
    """When simulating, planting-for-today must use historical averages,
    NOT get_soil_temperature_with_adjustments (which uses datetime.now())."""
    simulation_clock.set_simulated_date(date(2024, 1, 1))

    # Arugula-like plant: soil_temp_min = 40°F
    fake_plant = {
        'name': 'Arugula',
        'soil_temp_min': 40,
        'heat_tolerance': 'low',
        'frostTolerance': 'hardy',
    }

    planting_date = datetime(2024, 1, 1)  # same as simulated today

    with patch.object(season_validator, 'get_plant_by_id', return_value=fake_plant), \
         patch.object(season_validator, 'get_historical_daily_soil_temps',
                      side_effect=lambda latitude, longitude, month: _fake_daily_temps_by_month(month)) as mock_hist, \
         patch.object(season_validator, 'get_soil_temperature_with_adjustments') as mock_live:
        warnings = season_validator.validate_planting_conditions(
            plant_id='arugula',
            planting_date=planting_date,
            latitude=42.0,
            longitude=-83.0,
            soil_type='loamy',
            sun_exposure='full-sun',
        )

    # Live weather path MUST NOT be invoked when simulating
    assert mock_live.call_count == 0, \
        "Live soil-temp API must not be called in simulation mode"
    # Historical path MUST be invoked
    assert mock_hist.call_count >= 1

    # For January at 34°F avg, arugula (needs 40°F) should flag soil_temp_low
    types = [w['type'] for w in warnings]
    assert 'soil_temp_low' in types


def test_non_simulation_still_uses_live_weather_for_today():
    """When NOT simulating, today's planting date should still use the
    live soil-temp API."""
    # simulation is off
    today_dt = datetime.combine(date.today(), datetime.min.time())

    fake_plant = {
        'name': 'Arugula',
        'soil_temp_min': 40,
        'heat_tolerance': 'low',
        'frostTolerance': 'hardy',
    }

    with patch.object(season_validator, 'get_plant_by_id', return_value=fake_plant), \
         patch.object(season_validator, 'get_historical_daily_soil_temps',
                      side_effect=lambda latitude, longitude, month: _fake_daily_temps_by_month(month)), \
         patch.object(season_validator, 'get_soil_temperature_with_adjustments',
                      return_value={'final_soil_temp': 55.0}) as mock_live:
        season_validator.validate_planting_conditions(
            plant_id='arugula',
            planting_date=today_dt,
            latitude=42.0,
            longitude=-83.0,
            soil_type='loamy',
            sun_exposure='full-sun',
        )

    assert mock_live.call_count == 1, \
        "Live soil-temp API must still be used in real-time (non-sim) mode for today"


def test_non_simulation_future_date_uses_historical():
    """A future date (>1 day ahead) must use historical averages even when
    simulation is off — this was pre-existing behavior we must not break."""
    today_dt = datetime.combine(date.today() + timedelta(days=30), datetime.min.time())

    fake_plant = {
        'name': 'Arugula',
        'soil_temp_min': 40,
        'heat_tolerance': 'low',
        'frostTolerance': 'hardy',
    }

    with patch.object(season_validator, 'get_plant_by_id', return_value=fake_plant), \
         patch.object(season_validator, 'get_historical_daily_soil_temps',
                      side_effect=lambda latitude, longitude, month: _fake_daily_temps_by_month(month)) as mock_hist, \
         patch.object(season_validator, 'get_soil_temperature_with_adjustments') as mock_live:
        season_validator.validate_planting_conditions(
            plant_id='arugula',
            planting_date=today_dt,
            latitude=42.0,
            longitude=-83.0,
            soil_type='loamy',
            sun_exposure='full-sun',
        )

    assert mock_live.call_count == 0
    assert mock_hist.call_count >= 1


# ---------------------------------------------------------------------------
# BUG 2: calculate_cooler_planting_dates must return only dates >= search_date
# ---------------------------------------------------------------------------

def _parse(d):
    return datetime.strptime(d, '%Y-%m-%d').date() if d else None


def test_cooler_dates_simulated_jan_1_returns_future_only():
    """Simulating Jan 1 2024, the cooler-dates search must return dates
    in 2024+ only, never 2023 (the bug)."""
    simulation_clock.set_simulated_date(date(2024, 1, 1))
    search_date = date(2024, 1, 1)

    with patch.object(season_validator, 'get_historical_daily_soil_temps',
                      side_effect=lambda latitude, longitude, month: _fake_daily_temps_by_month(month)):
        result = season_validator.calculate_cooler_planting_dates(
            plant_name='Arugula',
            soil_temp_min=40,
            latitude=42.0,
            longitude=-83.0,
            current_date=search_date,
            protection_offset=0,
            plant_id='arugula',
            planting_method='seed',
        )

    # Every returned date must be >= search_date
    for key in ('earliest_safe_date', 'optimal_start', 'optimal_end'):
        val = _parse(result.get(key))
        if val is not None:
            assert val >= search_date, \
                f"{key}={val} precedes search_date={search_date} (past-date bug)"

    # optimal_range should not reference the prior year
    if result.get('optimal_range'):
        assert '2023' not in result['optimal_range'], \
            f"optimal_range must not reference the past year: {result['optimal_range']}"


def test_cooler_dates_return_dict_shape_preserved():
    """All five keys of the public API must still be present with same names."""
    search_date = date(2024, 4, 1)

    with patch.object(season_validator, 'get_historical_daily_soil_temps',
                      side_effect=lambda latitude, longitude, month: _fake_daily_temps_by_month(month)):
        result = season_validator.calculate_cooler_planting_dates(
            plant_name='Arugula',
            soil_temp_min=40,
            latitude=42.0,
            longitude=-83.0,
            current_date=search_date,
            protection_offset=0,
            plant_id='arugula',
            planting_method='seed',
        )

    expected_keys = {'earliest_safe_date', 'optimal_start', 'optimal_end',
                     'optimal_range', 'reason'}
    assert set(result.keys()) == expected_keys


def test_cooler_dates_finds_both_spring_and_fall_windows_when_mid_spring():
    """Given a mid-spring search date, the function should find a pre-hot
    ("spring") window AND a post-hot ("fall") window, and the optimal_range
    should mention both separated by ' or '."""
    search_date = date(2024, 4, 15)

    with patch.object(season_validator, 'get_historical_daily_soil_temps',
                      side_effect=lambda latitude, longitude, month: _fake_daily_temps_by_month(month)):
        result = season_validator.calculate_cooler_planting_dates(
            plant_name='Arugula',
            soil_temp_min=40,
            latitude=42.0,
            longitude=-83.0,
            current_date=search_date,
            protection_offset=0,
            plant_id='arugula',
            planting_method='seed',
        )

    # With arugula min=40F, optimal window is 50-60F. In our fake data,
    # May avg = 64F (above optimal but not hot), Sep = 70F (still marginal),
    # Oct = 58F (optimal again). So we should get at least one window.
    assert result['optimal_range'] is not None, \
        f"Expected at least one window, got {result}"

    # Every date should be >= search_date
    for key in ('earliest_safe_date', 'optimal_start', 'optimal_end'):
        val = _parse(result.get(key))
        if val is not None:
            assert val >= search_date, \
                f"{key}={val} precedes search_date={search_date}"


def test_cooler_dates_jan_search_spring_window_before_hot():
    """Starting Jan 1, the spring window should appear before the hot
    period (which in our fake is Jun–Aug). So optimal_start should be
    sometime in spring, not after the hot period."""
    search_date = date(2024, 1, 1)

    with patch.object(season_validator, 'get_historical_daily_soil_temps',
                      side_effect=lambda latitude, longitude, month: _fake_daily_temps_by_month(month)):
        result = season_validator.calculate_cooler_planting_dates(
            plant_name='Arugula',
            soil_temp_min=40,
            latitude=42.0,
            longitude=-83.0,
            current_date=search_date,
            protection_offset=0,
            plant_id='arugula',
            planting_method='seed',
        )

    # With arugula min=40F, optimal = 50-60F. In fake data: Apr avg=54,
    # May avg=64. So optimal_start should be in spring 2024, well before
    # the summer hot period (Jun-Aug 74-82F).
    start = _parse(result['optimal_start'])
    assert start is not None
    assert start.year == 2024
    # Must be >= search_date (the whole point of the fix)
    assert start >= search_date
    # Should be in the spring months (before the hot period kicks in)
    # Our stub has 54°F in April — the first optimal day should be in April.
    assert start.month <= 5, \
        f"Expected pre-hot spring window, got start={start}"


def test_cooler_dates_late_summer_search_finds_fall_window_only():
    """If you search late in summer (August), the spring window is in the
    past and cannot be returned. You should only get the fall window."""
    search_date = date(2024, 8, 1)  # in hot period in our fake

    with patch.object(season_validator, 'get_historical_daily_soil_temps',
                      side_effect=lambda latitude, longitude, month: _fake_daily_temps_by_month(month)):
        result = season_validator.calculate_cooler_planting_dates(
            plant_name='Arugula',
            soil_temp_min=40,
            latitude=42.0,
            longitude=-83.0,
            current_date=search_date,
            protection_offset=0,
            plant_id='arugula',
            planting_method='seed',
        )

    # Every date must be >= search_date
    for key in ('earliest_safe_date', 'optimal_start', 'optimal_end'):
        val = _parse(result.get(key))
        if val is not None:
            assert val >= search_date, \
                f"{key}={val} precedes search_date={search_date}"


def test_cooler_dates_no_windows_in_window_returns_none_cleanly():
    """If the 365-day window has no suitable cool period at all, the
    function should return None for the optional keys rather than crashing."""
    search_date = date(2024, 1, 1)

    # Return uniformly hot data in every month
    def all_hot(latitude, longitude, month):
        return {d: 100.0 for d in range(1, 32)}

    with patch.object(season_validator, 'get_historical_daily_soil_temps',
                      side_effect=all_hot):
        result = season_validator.calculate_cooler_planting_dates(
            plant_name='Arugula',
            soil_temp_min=40,
            latitude=42.0,
            longitude=-83.0,
            current_date=search_date,
            protection_offset=0,
            plant_id='arugula',
            planting_method='seed',
        )

    # Function must still return the expected dict shape
    expected_keys = {'earliest_safe_date', 'optimal_start', 'optimal_end',
                     'optimal_range', 'reason'}
    assert set(result.keys()) == expected_keys
    assert result['optimal_start'] is None
    assert result['optimal_end'] is None
    assert result['earliest_safe_date'] is None
    assert result['reason']  # still provides a human-readable reason


def _warning_types(warnings):
    return {warning['type'] for warning in warnings}


def test_future_historical_validation_cools_shaded_bed():
    """A borderline full-sun planting should become too cold in full shade."""
    simulation_clock.set_simulated_date(date(2024, 4, 1))

    fake_plant = {
        'name': 'Borderline Bean',
        'soil_temp_min': 60,
        'heat_tolerance': 'medium',
        'frostTolerance': 'hardy',
    }

    def may_sixty_four(latitude, longitude, month):
        return {d: 64.0 for d in range(1, 32)}

    with patch.object(season_validator, 'get_plant_by_id', return_value=fake_plant), \
         patch.object(season_validator, 'get_historical_daily_soil_temps', side_effect=may_sixty_four), \
         patch.object(season_validator, 'get_soil_temperature_with_adjustments'):
        full_sun = season_validator.validate_planting_conditions(
            plant_id='bean',
            planting_date=datetime(2024, 5, 1),
            latitude=42.0,
            longitude=-83.0,
            sun_exposure='full-sun',
        )
        full_shade = season_validator.validate_planting_conditions(
            plant_id='bean',
            planting_date=datetime(2024, 5, 1),
            latitude=42.0,
            longitude=-83.0,
            sun_exposure='shade',
        )

    assert 'soil_temp_low' not in _warning_types(full_sun)
    assert 'soil_temp_low' in _warning_types(full_shade)


def test_future_historical_validation_credits_shade_for_heat_sensitive_crops():
    """Shade should reduce too-hot warnings for cool-weather crops."""
    simulation_clock.set_simulated_date(date(2024, 6, 1))

    fake_plant = {
        'name': 'Heat Sensitive Greens',
        'soil_temp_min': 60,
        'heat_tolerance': 'low',
        'frostTolerance': 'hardy',
    }

    def july_eighty_two(latitude, longitude, month):
        return {d: 82.0 for d in range(1, 32)}

    with patch.object(season_validator, 'get_plant_by_id', return_value=fake_plant), \
         patch.object(season_validator, 'get_historical_daily_soil_temps', side_effect=july_eighty_two), \
         patch.object(season_validator, 'get_soil_temperature_with_adjustments'):
        full_sun = season_validator.validate_planting_conditions(
            plant_id='greens',
            planting_date=datetime(2024, 7, 1),
            latitude=42.0,
            longitude=-83.0,
            sun_exposure='full-sun',
        )
        full_shade = season_validator.validate_planting_conditions(
            plant_id='greens',
            planting_date=datetime(2024, 7, 1),
            latitude=42.0,
            longitude=-83.0,
            sun_exposure='shade',
        )

    assert 'soil_temp_high' in _warning_types(full_sun)
    assert 'soil_temp_high' not in _warning_types(full_shade)
