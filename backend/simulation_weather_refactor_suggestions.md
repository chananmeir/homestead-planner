# Refactor suggestions for `simulation_weather.py`

This document lists small, low-risk refactors to reduce code size and duplication while preserving behavior. No code changes will be made automatically — these are recommendations you can apply incrementally.

## Goals

- Reduce duplicated request parameter blocks and repeated JSON parsing logic.
- Keep behavior identical (same returned keys and error handling).
- Make the file easier to maintain and slightly shorter.

## Small, safe refactors (high value, low risk)

1. Extract shared archive request params into one helper

- Why: Both functions build identical `params` dicts. Extracting reduces lines and centralizes future changes.
- Suggestion: add `_archive_params(lat, lon, start_date, end_date)` returning the dict.

2. Extract a single fetch helper for the archive API

- Why: Request, status check and .json() repeated in both functions.
- Suggestion: add `_fetch_archive_daily(lat, lon, start_date, end_date, timeout=10)` that calls requests.get, raise_for_status and returns `response.json().get('daily', {})`.

3. Simplify forecast list assembly with small local helpers

- Why: Repeated `.get(name, [default] * n)` logic can be reduced into a `get_list = lambda name, default: daily.get(name, [default] * n)` and then iterate `for i, t in enumerate(daily['time'])`.
- Benefit: Fewer lines and clearer mapping from API fields to forecast items.

4. Consolidate identical fallbacks to delegate functions

- Why: When archive returns no data or an exception occurs, both functions call the original `get_current_weather` or `get_forecast`. Keep those early-return checks identical and centralized where possible.

## Example snippets (illustrative only)

_helper for params_

```python
def _archive_params(lat, lon, start_date, end_date):
    return {
        'latitude': lat,
        'longitude': lon,
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'daily': ['weather_code', 'temperature_2m_max', 'temperature_2m_min',
                  'precipitation_sum', 'wind_speed_10m_max'],
        'temperature_unit': 'fahrenheit',
        'wind_speed_unit': 'mph',
        'precipitation_unit': 'inch',
        'timezone': 'auto'
    }
```

_fetch helper_

```python
def _fetch_archive_daily(lat, lon, start_date, end_date, timeout=10):
    resp = requests.get(ARCHIVE_API_URL, params=_archive_params(lat, lon, start_date, end_date), timeout=timeout)
    resp.raise_for_status()
    return resp.json().get('daily', {})
```

_simplified forecast loop_

```python
times = daily['time']
n = len(times)
get_list = lambda name, default: daily.get(name, [default] * n)
forecast = []
for i, dt in enumerate(times):
    highs = get_list('temperature_2m_max', 50)
    lows = get_list('temperature_2m_min', 30)
    p = get_list('precipitation_sum', 0)
    w = get_list('wind_speed_10m_max', 0)
    code = get_list('weather_code', 0)[i]
    cond, _ = _map_weather_code(int(code) if code is not None else 0)
    high = highs[i] or 50
    low = lows[i] or 30
    forecast.append({...})
```

## Tests and verification

- Add a very small unit test for each public function that mocks `requests.get` to return a controlled JSON payload and asserts the returned structure (keys, types).
- Smoke-check by running the module in a REPL for one simulated date and one forecast call.

## Edge cases & notes

- The archive API can omit fields; preserve the current defensive patterns like `daily.get("precipitation_sum", [0])[i] or 0` to avoid None/KeyError.
- Keep exception handling as-is (catch broad Exception and fall back to delegate functions) unless you want to surface errors for debugging.
- Avoid changing returned key names or numeric rounding — tests will catch regressions.

## Estimated line savings

- Extracting the params and fetch helpers and simplifying the forecast loop should reduce ~30-50 lines depending on style.

## Risk assessment

- Low risk: All changes are internal refactoring; public function signatures and return shapes remain unchanged.
- Medium risk if you try to aggressively DRY return dict construction — do that only with tests in place.

## Suggested next steps (one-minute tasks)

- Create the two helper functions shown above and replace duplicated blocks. Run unit tests.
- Add 2 quick tests mocking `requests.get` for: (1) single-day archive response and (2) multi-day archive response.

---

 