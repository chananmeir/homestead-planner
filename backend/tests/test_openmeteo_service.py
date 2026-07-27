import numpy as np

import openmeteo_service


class FakeSession:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


class FakeVariable:
    def __init__(self, values):
        self._values = values

    def ValuesAsNumpy(self):
        return np.array(self._values, dtype=float)


class FakeHourly:
    def __init__(self, variables, start_time=1_785_571_200):
        self._variables = variables
        self._start_time = start_time

    def Variables(self, index):
        return FakeVariable(self._variables[index])

    def Time(self):
        return self._start_time


class FakeWeatherResponse:
    def __init__(self, variables):
        self._hourly = FakeHourly(variables)

    def Hourly(self):
        return self._hourly


def test_weather_api_uses_per_call_client_timeout_and_closes_session(monkeypatch):
    clients = []

    class FakeClient:
        def __init__(self):
            self.session = FakeSession()
            self.calls = []
            clients.append(self)

        def weather_api(self, url, params, **kwargs):
            self.calls.append((url, params, kwargs))
            return ['ok']

    monkeypatch.setattr(openmeteo_service.openmeteo_requests, 'Client', FakeClient)

    result = openmeteo_service._weather_api('https://example.test', {'latitude': 43.1})

    assert result == ['ok']
    assert len(clients) == 1
    assert clients[0].calls[0][2]['timeout'] == openmeteo_service.OPENMETEO_TIMEOUT_SECONDS
    assert clients[0].session.closed is True


def test_current_soil_temperature_uses_in_memory_cache(monkeypatch):
    openmeteo_service._openmeteo_cache.clear()
    clients = []

    class FakeClient:
        def __init__(self):
            self.session = FakeSession()
            clients.append(self)

        def weather_api(self, url, params, **kwargs):
            return [FakeWeatherResponse([[52.34]])]

    monkeypatch.setattr(openmeteo_service.openmeteo_requests, 'Client', FakeClient)

    first = openmeteo_service.get_soil_temperature_openmeteo(43.0731, -87.9647)
    second = openmeteo_service.get_soil_temperature_openmeteo(43.0731, -87.9647)

    assert first == (52.34, False)
    assert second == (52.34, False)
    assert len(clients) == 1


def test_multi_depth_current_soil_temperature_uses_single_bounded_call(monkeypatch):
    openmeteo_service._openmeteo_cache.clear()
    captured = {}

    class FakeClient:
        def __init__(self):
            self.session = FakeSession()

        def weather_api(self, url, params, **kwargs):
            captured['params'] = params
            captured['kwargs'] = kwargs
            return [FakeWeatherResponse([[41.0], [45.0], [47.0]])]

    monkeypatch.setattr(openmeteo_service.openmeteo_requests, 'Client', FakeClient)

    temps, using_mock = openmeteo_service.get_soil_temperatures_multi_depth(43.0731, -87.9647)

    assert using_mock is False
    assert captured['params']['hourly'] == 'soil_temperature_0cm,soil_temperature_6cm,soil_temperature_18cm'
    assert captured['kwargs']['timeout'] == openmeteo_service.OPENMETEO_TIMEOUT_SECONDS
    assert temps == {0: 41.0, 6: 45.0, 18: 47.0}
