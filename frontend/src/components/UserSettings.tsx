import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch, apiPost } from '../utils/api';
import { Button, useToast } from './common';
import type { Property } from '../types';

interface SettingFieldSchema {
  type: 'int';
  label: string;
  defaultValue: number;
  min?: number | null;
  max?: number | null;
  unit?: string | null;
}

interface SettingsSchema {
  dashboard: {
    snoozeDefaultDays: SettingFieldSchema;
    seedLowStockPackets: SettingFieldSchema;
    seedExpiryWindowDays: SettingFieldSchema;
  };
  compost: {
    turnReminderDays: SettingFieldSchema;
  };
}

interface SettingsValues {
  dashboard: {
    snoozeDefaultDays: number;
    seedLowStockPackets: number;
    seedExpiryWindowDays: number;
  };
  compost: {
    turnReminderDays: number;
  };
}

interface SettingsPayload {
  values: SettingsValues;
  schema: SettingsSchema;
}

interface LocationPayload {
  hasLocation: boolean;
  property: Property | null;
}

const DEFAULT_SCHEMA: SettingsSchema = {
  dashboard: {
    snoozeDefaultDays: { type: 'int', label: 'Default snooze', defaultValue: 3, min: 1, max: 30, unit: 'days' },
    seedLowStockPackets: { type: 'int', label: 'Low seed stock', defaultValue: 2, min: 0, max: 20, unit: 'packets' },
    seedExpiryWindowDays: { type: 'int', label: 'Seed expiry window', defaultValue: 30, min: 1, max: 365, unit: 'days' },
  },
  compost: {
    turnReminderDays: { type: 'int', label: 'Compost turn reminder', defaultValue: 7, min: 1, max: 60, unit: 'days' },
  },
};

const defaultsFromSchema = (schema: SettingsSchema): SettingsValues => ({
  dashboard: {
    snoozeDefaultDays: schema.dashboard.snoozeDefaultDays.defaultValue,
    seedLowStockPackets: schema.dashboard.seedLowStockPackets.defaultValue,
    seedExpiryWindowDays: schema.dashboard.seedExpiryWindowDays.defaultValue,
  },
  compost: {
    turnReminderDays: schema.compost.turnReminderDays.defaultValue,
  },
});

const UserSettings: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [schema, setSchema] = useState<SettingsSchema>(DEFAULT_SCHEMA);
  const [values, setValues] = useState<SettingsValues>(() => defaultsFromSchema(DEFAULT_SCHEMA));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationSaving, setLocationSaving] = useState(false);
  const [location, setLocation] = useState<LocationPayload>({ hasLocation: false, property: null });
  const [zipCode, setZipCode] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      try {
        const response = await apiGet('/api/settings');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load settings');
        }
        if (!cancelled) {
          const payload = data as SettingsPayload;
          setSchema(payload.schema);
          setValues(payload.values);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading settings:', error);
          showError(error instanceof Error ? error.message : 'Failed to load settings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [showError]);

  useEffect(() => {
    let cancelled = false;

    const loadLocation = async () => {
      setLocationLoading(true);
      try {
        const response = await apiGet('/api/properties/location');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load garden location');
        }
        if (!cancelled) {
          const payload = data as LocationPayload;
          setLocation(payload);
          setZipCode(payload.property?.zipCode || '');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading garden location:', error);
          showError(error instanceof Error ? error.message : 'Failed to load garden location');
        }
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    };

    loadLocation();
    return () => {
      cancelled = true;
    };
  }, [showError]);

  const fields = useMemo(() => ([
    {
      section: 'dashboard' as const,
      field: 'snoozeDefaultDays' as const,
      title: 'Default snooze',
      detail: 'Used when a dashboard row is snoozed without a custom duration.',
      schema: schema.dashboard.snoozeDefaultDays,
    },
    {
      section: 'dashboard' as const,
      field: 'seedLowStockPackets' as const,
      title: 'Low seed stock',
      detail: 'Dashboard alert threshold for seed inventory packet counts.',
      schema: schema.dashboard.seedLowStockPackets,
    },
    {
      section: 'dashboard' as const,
      field: 'seedExpiryWindowDays' as const,
      title: 'Seed expiry window',
      detail: 'Dashboard alert window for seed packets nearing expiration.',
      schema: schema.dashboard.seedExpiryWindowDays,
    },
    {
      section: 'compost' as const,
      field: 'turnReminderDays' as const,
      title: 'Compost turn reminder',
      detail: 'Dashboard alert threshold for compost piles that need turning.',
      schema: schema.compost.turnReminderDays,
    },
  ]), [schema]);

  const updateValue = (
    section: keyof SettingsValues,
    field: string,
    nextValue: number,
  ) => {
    setValues(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: nextValue,
      },
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiPatch('/api/settings', { values });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }
      const payload = data as SettingsPayload;
      setSchema(payload.schema);
      setValues(payload.values);
      showSuccess('Settings saved');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setValues(defaultsFromSchema(schema));
  };

  const saveLocation = async () => {
    const normalizedZip = zipCode.trim();
    if (!/^\d{5}$/.test(normalizedZip)) {
      showError('Enter a 5-digit ZIP code');
      return;
    }

    setLocationSaving(true);
    try {
      const response = await apiPost('/api/properties/location', { zipCode: normalizedZip });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save garden location');
      }
      const payload = data as LocationPayload;
      setLocation(payload);
      setZipCode(payload.property?.zipCode || normalizedZip);
      showSuccess('Garden location saved');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to save garden location');
    } finally {
      setLocationSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
            <p className="mt-1 text-sm text-gray-600">
              Personal preferences for dashboard reminders and homestead alerts.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Garden Location</h2>
          <p className="mt-1 text-sm text-gray-600">
            Used for frost dates and soil-temperature feedback.
          </p>
        </div>

        {locationLoading ? (
          <div className="p-4 text-sm text-gray-500">Loading garden location...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="block">
              <span className="block text-sm font-semibold text-gray-900">ZIP code</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="mt-2 w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </label>
            <Button type="button" variant="primary" onClick={saveLocation} loading={locationSaving}>
              Save Location
            </Button>
          </div>
        )}

        {location.property && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            <span className="font-semibold">Saved:</span>{' '}
            {location.property.zipCode ? `ZIP ${location.property.zipCode}` : location.property.address || location.property.name}
            {location.property.zone ? ` | Zone ${location.property.zone}` : ''}
            {location.property.latitude != null && location.property.longitude != null
              ? ` | ${location.property.latitude.toFixed(2)}, ${location.property.longitude.toFixed(2)}`
              : ''}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading settings...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(item => {
                const currentValue = values[item.section][item.field as keyof typeof values[typeof item.section]];
                return (
                  <label
                    key={`${item.section}.${item.field}`}
                    className="block border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors"
                  >
                    <span className="block text-sm font-semibold text-gray-900">{item.title}</span>
                    <span className="block text-sm text-gray-600 mt-1">{item.detail}</span>
                    <span className="mt-4 flex items-center gap-3">
                      <input
                        type="number"
                        min={item.schema.min ?? undefined}
                        max={item.schema.max ?? undefined}
                        value={currentValue}
                        onChange={(e) => updateValue(item.section, item.field, Number(e.target.value))}
                        className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                      <span className="text-sm text-gray-500">{item.schema.unit}</span>
                    </span>
                    {(item.schema.min != null || item.schema.max != null) && (
                      <span className="block text-xs text-gray-500 mt-2">
                        Range {item.schema.min ?? 0}–{item.schema.max ?? 'unlimited'} {item.schema.unit}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end border-t border-gray-100 pt-5">
              <Button
                type="button"
                variant="secondary"
                onClick={resetToDefaults}
                disabled={saving}
              >
                Reset Defaults
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Save Settings
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export default UserSettings;
