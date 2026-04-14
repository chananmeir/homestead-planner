"""
Simulation Clock Module

Dev-only time override for testing seasonal features.
When simulation is OFF (default), all functions return real datetime.
When simulation is ON, all functions return the simulated date/time.

This module is process-global (not per-user). It is intended for
single-developer local testing, not multi-user production use.
"""
from datetime import datetime, date, timedelta
from typing import Optional

# Module-level state -- None means "use real time"
_simulated_date: Optional[date] = None


def set_simulated_date(d: Optional[date]) -> None:
    """Set the simulated date, or None to disable simulation."""
    global _simulated_date
    _simulated_date = d


def get_simulated_date() -> Optional[date]:
    """Return the simulated date, or None if simulation is off."""
    return _simulated_date


def is_simulating() -> bool:
    """Return True if simulation mode is active."""
    return _simulated_date is not None


def advance_days(n: int = 1) -> date:
    """Advance the simulated date by n days. Raises if not simulating."""
    global _simulated_date
    if _simulated_date is None:
        raise RuntimeError("Cannot advance days when simulation is off")
    _simulated_date = _simulated_date + timedelta(days=n)
    return _simulated_date


def get_now() -> datetime:
    """
    Drop-in replacement for datetime.now().
    Returns simulated datetime (at noon) if simulating, else real now.
    """
    if _simulated_date is not None:
        return datetime.combine(_simulated_date, datetime.min.time().replace(hour=12))
    return datetime.now()


def get_utc_now() -> datetime:
    """
    Drop-in replacement for datetime.utcnow().
    Returns simulated datetime (at noon UTC) if simulating, else real utcnow.
    """
    if _simulated_date is not None:
        return datetime.combine(_simulated_date, datetime.min.time().replace(hour=12))
    return datetime.utcnow()


def get_today() -> date:
    """
    Drop-in replacement for date.today().
    Returns simulated date if simulating, else real today.
    """
    if _simulated_date is not None:
        return _simulated_date
    return date.today()
