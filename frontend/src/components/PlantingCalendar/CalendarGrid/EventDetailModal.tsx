import React, { useState, useEffect, useCallback } from 'react';
import { X, Pencil, CalendarDays, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { PlantingCalendar } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import PlantIcon from '../../common/PlantIcon';
import { apiGet, apiPut, apiPatch, apiDelete } from '../../../utils/api';
import { EditSeedStartModal, IndoorSeedStart } from '../../IndoorSeedStarts/EditSeedStartModal';

interface EventDetailModalProps {
  isOpen: boolean;
  event: PlantingCalendar | null;
  onClose: () => void;
  gardenBeds?: Array<{ id: number; name: string }>;
  onEventUpdated?: () => void;
  onNavigateToBed?: (bedId: number, date?: string, seedStartId?: number, plantingEventId?: number) => void;
  coldWarning?: 'too_cold' | 'marginal' | 'too_hot';
  soilTempForecast?: Record<string, number>;
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({ isOpen, event, onClose, gardenBeds, onEventUpdated, onNavigateToBed, coldWarning, soilTempForecast }) => {
  const [seedStart, setSeedStart] = useState<IndoorSeedStart | null>(null);
  const [loadingSeedStart, setLoadingSeedStart] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isHarvestCompleted, setIsHarvestCompleted] = useState(false);
  const [togglingComplete, setTogglingComplete] = useState(false);
  const [togglingHarvest, setTogglingHarvest] = useState(false);
  const [variety, setVariety] = useState('');
  const [availableVarieties, setAvailableVarieties] = useState<string[]>([]);
  const [isEditingVariety, setIsEditingVariety] = useState(false);
  const [savingVariety, setSavingVariety] = useState(false);
  const [switchingToDirectSeed, setSwitchingToDirectSeed] = useState(false);
  const [isEditingBed, setIsEditingBed] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const [savingBed, setSavingBed] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isIndoorStart = !!event?.seedStartDate;

  // Fetch linked indoor seed start when event is an indoor start type
  const fetchSeedStart = useCallback(async () => {
    if (!event || !isIndoorStart) {
      setSeedStart(null);
      return;
    }
    setLoadingSeedStart(true);
    try {
      const response = await apiGet(`/api/indoor-seed-starts/by-planting-event/${event.id}`);
      if (response.ok) {
        const data = await response.json();
        setSeedStart(data);
      } else {
        setSeedStart(null);
      }
    } catch {
      setSeedStart(null);
    } finally {
      setLoadingSeedStart(false);
    }
  }, [event, isIndoorStart]);

  const [rescheduleError, setRescheduleError] = useState('');

  const handleReschedule = async () => {
    if (!event || !newDate) return;
    setSavingReschedule(true);
    setRescheduleError('');
    try {
      const newDateMidday = new Date(newDate + 'T12:00:00');
      const payload: Record<string, string> = {};

      // Determine which phase this event represents:
      // 1. Indoor seed start: has seedStartDate but NOT directSeedDate
      // 2. Direct seed: has directSeedDate
      // 3. Transplant only: has transplantDate but no seedStartDate/directSeedDate
      type PhaseKey = 'seedStartDate' | 'directSeedDate' | 'transplantDate';
      let phaseKey: PhaseKey | null = null;
      if (event.seedStartDate && !event.directSeedDate) {
        phaseKey = 'seedStartDate';
      } else if (event.directSeedDate) {
        phaseKey = 'directSeedDate';
      } else if (event.transplantDate) {
        phaseKey = 'transplantDate';
      }

      if (!phaseKey) {
        setRescheduleError('Could not determine which date to update');
        setSavingReschedule(false);
        return;
      }

      // Normalize the original date to midday for accurate day-delta calculation
      const normalizeToMidday = (value: Date | undefined): Date | null => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        const dateOnly = format(parsed, 'yyyy-MM-dd');
        return new Date(dateOnly + 'T12:00:00');
      };

      const originalDate = phaseKey === 'seedStartDate' ? event.seedStartDate
        : phaseKey === 'directSeedDate' ? event.directSeedDate
        : event.transplantDate;

      const normalizedOriginal = normalizeToMidday(originalDate);
      if (!normalizedOriginal) {
        setRescheduleError('Could not determine which date to update');
        setSavingReschedule(false);
        return;
      }

      // Calculate day offset between old and new date
      const msPerDay = 24 * 60 * 60 * 1000;
      const deltaDays = Math.round((newDateMidday.getTime() - normalizedOriginal.getTime()) / msPerDay);

      // Set the primary date being rescheduled
      payload[phaseKey] = newDateMidday.toISOString();

      // Shift dependent dates by the same offset
      const shiftField = (field: 'transplantDate' | 'expectedHarvestDate') => {
        const currentValue = event[field];
        if (!currentValue) return;
        const normalized = normalizeToMidday(currentValue);
        if (!normalized) return;
        const shifted = new Date(normalized);
        shifted.setDate(shifted.getDate() + deltaDays);
        payload[field] = shifted.toISOString();
      };

      if (deltaDays !== 0) {
        if (phaseKey === 'seedStartDate') {
          // Moving seed start → shift transplant and harvest dates too
          shiftField('transplantDate');
          shiftField('expectedHarvestDate');
        } else {
          // Moving direct seed or transplant → shift harvest date
          shiftField('expectedHarvestDate');
        }
      }

      const response = await apiPut(`/api/planting-events/${event.id}`, payload);
      if (response.ok) {
        setIsRescheduling(false);
        if (onEventUpdated) onEventUpdated();
        onClose();
      } else {
        const errData = await response.json().catch(() => ({}));
        setRescheduleError(errData.error || `Failed to reschedule (${response.status})`);
      }
    } catch (err) {
      console.error('Failed to reschedule:', err);
      setRescheduleError('Network error - please try again');
    } finally {
      setSavingReschedule(false);
    }
  };

  useEffect(() => {
    if (isOpen && event) {
      setIsCompleted(!!event.completed || !!event.isComplete);
      setIsHarvestCompleted(!!event.harvestCompleted);
      setVariety(event.variety || '');
      setIsEditingVariety(false);
      setIsEditingBed(false);
      setSelectedBedId(event.gardenBedId ?? null);
      setIsRescheduling(false);
      setRescheduleError('');
      fetchSeedStart();
      // Fetch varieties from user's personal seed inventory
      if (event.plantId) {
        apiGet(`/api/seeds/varieties/${event.plantId}?mySeedsOnly=true`)
          .then(r => r.ok ? r.json() : [])
          .then(setAvailableVarieties)
          .catch(() => setAvailableVarieties([]));
      }
    } else {
      setSeedStart(null);
      setShowEditModal(false);
      setIsEditingVariety(false);
    }
  }, [isOpen, event, fetchSeedStart]);

  const toggleComplete = async () => {
    if (!event) return;
    setTogglingComplete(true);
    try {
      const newCompleted = !isCompleted;
      const response = await apiPut(`/api/planting-events/${event.id}`, {
        completed: newCompleted,
      });
      if (response.ok) {
        setIsCompleted(newCompleted);
        if (onEventUpdated) onEventUpdated();
      }
    } catch (err) {
      console.error('Failed to toggle completion:', err);
    } finally {
      setTogglingComplete(false);
    }
  };

  const toggleHarvestComplete = async () => {
    if (!event) return;
    setTogglingHarvest(true);
    try {
      const newHarvestCompleted = !isHarvestCompleted;
      const response = await apiPut(`/api/planting-events/${event.id}`, {
        harvestCompleted: newHarvestCompleted,
      });
      if (response.ok) {
        setIsHarvestCompleted(newHarvestCompleted);
        if (onEventUpdated) onEventUpdated();
      }
    } catch (err) {
      console.error('Failed to toggle harvest completion:', err);
    } finally {
      setTogglingHarvest(false);
    }
  };

  const hasHarvestPhase = !!event?.expectedHarvestDate;
  const hasPlantingPhase = !!event?.directSeedDate || !!event?.transplantDate;

  const saveVariety = async () => {
    if (!event) return;
    if (event.successionGroupId) {
      const ok = window.confirm(
        'This will update the variety on all succession plantings for this crop, the season plan item, and any placed plants. Continue?'
      );
      if (!ok) return;
    }
    setSavingVariety(true);
    try {
      const response = await apiPatch(`/api/planting-events/${event.id}/variety`, {
        variety: variety || null,
      });
      if (response.ok) {
        setIsEditingVariety(false);
        fetchSeedStart(); // refresh seed start with updated variety
        if (onEventUpdated) onEventUpdated();
      }
    } catch (err) {
      console.error('Failed to update variety:', err);
    } finally {
      setSavingVariety(false);
    }
  };

  const saveBed = async () => {
    if (!event || selectedBedId === event.gardenBedId) {
      setIsEditingBed(false);
      return;
    }
    setSavingBed(true);
    try {
      const response = await apiPut(`/api/planting-events/${event.id}`, {
        gardenBedId: selectedBedId,
      });
      if (response.ok) {
        setIsEditingBed(false);
        if (onEventUpdated) onEventUpdated();
        onClose();
      }
    } catch (err) {
      console.error('Failed to update bed:', err);
    } finally {
      setSavingBed(false);
    }
  };

  const handleSwitchToDirectSeed = async () => {
    if (!event) return;
    const transplantStr = event.transplantDate ? format(event.transplantDate, 'MMM d') : 'the transplant date';
    const ok = window.confirm(
      `This will convert this indoor start to a direct seed planting. The transplant date (${transplantStr}) will become the direct seed date. Any linked seed start record will be removed. Continue?`
    );
    if (!ok) return;
    setSwitchingToDirectSeed(true);
    try {
      const response = await apiPatch(`/api/planting-events/${event.id}/switch-to-direct-seed`, {});
      if (response.ok) {
        if (onEventUpdated) onEventUpdated();
        onClose();
      }
    } catch (err) {
      console.error('Failed to switch to direct seed:', err);
    } finally {
      setSwitchingToDirectSeed(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!event) return;

    const plantData = PLANT_DATABASE.find(p => p.id === event.plantId);
    const plantName = plantData?.name || event.plantId || 'this event';

    let scope: 'single' | 'series' = 'single';
    if (event.successionGroupId) {
      const choice = window.confirm(
        `Delete all events in this "${plantName}" succession series?\n\nClick OK to delete the entire series, or Cancel to go back.`
      );
      if (!choice) return;
      scope = 'series';
    } else {
      const ok = window.confirm(`Delete "${plantName}" planting event? This cannot be undone.`);
      if (!ok) return;
    }

    setDeleting(true);
    try {
      const response = await apiDelete(
        `/api/planting-events/${event.id}${scope === 'series' ? '?scope=series' : ''}`
      );
      if (response.ok) {
        if (onEventUpdated) onEventUpdated();
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete event:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !event) return null;

  const plant = PLANT_DATABASE.find(p => p.id === event.plantId);
  const bedName = gardenBeds?.find(b => b.id === event.gardenBedId)?.name;

  const isDirectSeed = !!event.directSeedDate && !event.seedStartDate;
  const eventLabel = isIndoorStart ? 'Start Indoors & Transplant' : isDirectSeed ? 'Direct Seed' : 'Planting';

  const formatDate = (date?: Date) => {
    if (!date) return null;
    return format(date, 'MMM d, yyyy');
  };

  // Plants list for the edit modal
  const plants = PLANT_DATABASE.map(p => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    daysToMaturity: p.daysToMaturity,
  }));

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-800">Event Details</h3>
              {isCompleted && hasPlantingPhase && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Planted</span>
              )}
              {isHarvestCompleted && hasHarvestPhase && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Harvested</span>
              )}
              {isCompleted && !hasPlantingPhase && !hasHarvestPhase && (
                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">Done</span>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Plant info */}
            {plant && (
              <div className="flex items-center gap-3 pb-3 border-b">
                <PlantIcon plantId={plant.id} plantIcon={plant.icon || ''} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800">{plant.name}</div>
                  {isEditingVariety ? (
                    <div className="flex items-center gap-1 mt-1">
                      <select
                        value={variety}
                        onChange={e => setVariety(e.target.value)}
                        className="text-sm border rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                        autoFocus
                      >
                        <option value="">No variety</option>
                        {availableVarieties.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                      <button
                        onClick={saveVariety}
                        disabled={savingVariety}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                      >
                        {savingVariety ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setIsEditingVariety(false); setVariety(event.variety || ''); }}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div
                      className="text-sm text-gray-500 flex items-center gap-1 cursor-pointer hover:text-blue-600 group"
                      onClick={() => setIsEditingVariety(true)}
                      title="Click to edit variety"
                    >
                      {variety || <span className="italic text-gray-400">No variety</span>}
                      <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>
                <div className="ml-auto">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    isIndoorStart ? 'bg-green-100 text-green-700' :
                    isDirectSeed ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {eventLabel}
                  </span>
                </div>
              </div>
            )}

            {/* Weather Warning Banner */}
            {coldWarning && !isCompleted && (() => {
              const relevantDate = event.directSeedDate ?? event.transplantDate;
              const dateKey = relevantDate ? format(new Date(relevantDate), 'yyyy-MM-dd') : null;
              const soilTemp = dateKey && soilTempForecast ? soilTempForecast[dateKey] : null;
              const isTooCol = coldWarning === 'too_cold';
              const isTooHot = coldWarning === 'too_hot';
              const isMarginal = coldWarning === 'marginal';
              const minSoilTemp = plant?.soilTempMin ?? plant?.germinationTemp?.min;

              const bannerStyle = isTooHot
                ? 'bg-orange-50 border-orange-200'
                : isTooCol ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
              const textColor = isTooHot
                ? 'text-orange-800'
                : isTooCol ? 'text-red-800' : 'text-yellow-800';
              const subTextColor = isTooHot
                ? 'text-orange-700'
                : isTooCol ? 'text-red-700' : 'text-yellow-700';
              const btnStyle = isTooHot
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : isTooCol ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-yellow-600 text-white hover:bg-yellow-700';
              const icon = isTooHot ? '\uD83C\uDF21\uFE0F' : isTooCol ? '\u2744\uFE0F' : '\u26A0\uFE0F';
              const title = isTooHot
                ? 'Too Hot for This Crop'
                : isTooCol ? 'Soil Too Cold for This Date' : 'Marginal Soil Temperature';
              const tempNote = isTooHot
                ? ` (max ~${minSoilTemp != null ? minSoilTemp + 20 : '?'}°F for this crop)`
                : isMarginal && minSoilTemp != null
                  ? ` (optimal: ${minSoilTemp + 5}°F+, min: ${minSoilTemp}°F)`
                  : (plant && minSoilTemp != null ? ` (needs ${minSoilTemp}°F min)` : '');
              const rescheduleLabel = isTooHot
                ? 'Reschedule to Cooler Date'
                : isMarginal ? 'Reschedule Planting Date' : 'Reschedule to Warmer Date';

              return (
                <div className={`p-3 rounded-lg border ${bannerStyle}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">{icon}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${textColor}`}>
                        {title}
                      </p>
                      <p className={`text-xs mt-0.5 ${subTextColor}`}>
                        Forecast soil temp: {soilTemp != null ? `${soilTemp.toFixed(1)}°F` : 'N/A'}
                        {tempNote}
                      </p>
                      {!isRescheduling && (
                        <button
                          onClick={() => {
                            setIsRescheduling(true);
                            setNewDate('');
                          }}
                          className={`mt-2 text-xs px-3 py-1 rounded font-medium ${btnStyle}`}
                        >
                          {rescheduleLabel}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reschedule date picker */}
                  {isRescheduling && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Pick a new date:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button
                          onClick={handleReschedule}
                          disabled={!newDate || savingReschedule}
                          className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingReschedule ? '...' : 'Move'}
                        </button>
                        <button
                          onClick={() => { setIsRescheduling(false); setRescheduleError(''); }}
                          className="text-xs px-3 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                      {rescheduleError && (
                        <p className="text-xs text-red-600 mt-1">{rescheduleError}</p>
                      )}
                      {/* Show soil temps for next few days to help pick */}
                      {soilTempForecast && Object.keys(soilTempForecast).length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] text-gray-500 mb-1">Forecasted soil temps:</p>
                          <div className="flex gap-1 flex-wrap">
                            {Object.entries(soilTempForecast).slice(0, 8).map(([date, temp]) => {
                              const minTemp = plant?.soilTempMin ?? plant?.germinationTemp?.min ?? 0;
                              const isHotCrop = plant?.heatTolerance === 'low';
                              const hotMax = minTemp + 20;
                              const isOverheated = isHotCrop && temp > hotMax;
                              const isWarm = temp >= minTemp + 5 && !isOverheated;
                              const isMarginal = (temp >= minTemp - 5 && !isWarm) || isOverheated;
                              return (
                                <button
                                  key={date}
                                  onClick={() => setNewDate(date)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
                                    newDate === date ? 'ring-2 ring-blue-400' : ''
                                  } ${
                                    isOverheated ? 'bg-orange-50 border-orange-300 text-orange-800' :
                                    isWarm ? 'bg-green-50 border-green-300 text-green-800' :
                                    isMarginal ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                                    'bg-red-50 border-red-300 text-red-800'
                                  }`}
                                >
                                  {format(new Date(date + 'T12:00:00'), 'M/d')} {temp.toFixed(0)}°
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Dates */}
            <div className="space-y-2">
              {event.seedStartDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Seed Start (Indoor):</span>
                  <span className="font-medium">{formatDate(event.seedStartDate)}</span>
                </div>
              )}
              {event.transplantDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Transplant (Outdoor):</span>
                  <span className="font-medium">{formatDate(event.transplantDate)}</span>
                </div>
              )}
              {event.directSeedDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Direct Seed:</span>
                  <span className="font-medium">{formatDate(event.directSeedDate)}</span>
                </div>
              )}
              {event.expectedHarvestDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Expected Harvest:</span>
                  <span className="font-medium">{formatDate(event.expectedHarvestDate)}</span>
                </div>
              )}
            </div>

            {/* Reschedule date picker (general, not weather-triggered) */}
            {isRescheduling && !coldWarning && (
              <div className="p-3 rounded-lg border bg-blue-50 border-blue-200">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Pick a new date:
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    onClick={handleReschedule}
                    disabled={!newDate || savingReschedule}
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingReschedule ? '...' : 'Move'}
                  </button>
                  <button
                    onClick={() => { setIsRescheduling(false); setRescheduleError(''); }}
                    className="text-xs px-3 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
                {rescheduleError && (
                  <p className="text-xs text-red-600 mt-1">{rescheduleError}</p>
                )}
              </div>
            )}

            {/* Details */}
            <div className="space-y-2 pt-2 border-t">
              {event.quantity != null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-medium">{event.quantity} plants</span>
                </div>
              )}
              {(bedName || gardenBeds?.length) && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Garden Bed:</span>
                  {isEditingBed ? (
                    <div className="flex items-center gap-1">
                      <select
                        value={selectedBedId ?? ''}
                        onChange={e => setSelectedBedId(e.target.value ? Number(e.target.value) : null)}
                        className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="">No bed</option>
                        {gardenBeds?.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={saveBed}
                        disabled={savingBed}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        {savingBed ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setIsEditingBed(false); setSelectedBedId(event.gardenBedId ?? null); }}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span
                      className="font-medium text-green-700 flex items-center gap-1 cursor-pointer hover:text-blue-600 group"
                      onClick={() => setIsEditingBed(true)}
                      title="Click to change bed"
                    >
                      {bedName || <span className="italic text-gray-400">No bed</span>}
                      <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  )}
                </div>
              )}
              {event.successionPlanting && event.successionInterval && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Succession:</span>
                  <span className="font-medium">Every {event.successionInterval} days</span>
                </div>
              )}
              {event.completed && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium text-green-600">Completed</span>
                </div>
              )}

              {/* Indoor seed start status */}
              {seedStart && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Seed Start Status:</span>
                  <span className="font-medium capitalize">{seedStart.status}</span>
                </div>
              )}
              {seedStart && seedStart.seedsGerminated != null && seedStart.seedsGerminated > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Germinated:</span>
                  <span className="font-medium">{seedStart.seedsGerminated} of {seedStart.seedsStarted}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {event.notes && (
              <div className="pt-2 border-t">
                <div className="text-gray-600 text-sm mb-1">Notes:</div>
                <div className="text-gray-800 text-sm bg-gray-50 p-2 rounded">{event.notes}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex gap-2 flex-wrap">
            {/* Planting phase toggle (direct seed or transplant) */}
            {!isIndoorStart && !isRescheduling && hasPlantingPhase && (
              <button
                onClick={toggleComplete}
                disabled={togglingComplete}
                className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                  isCompleted
                    ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {togglingComplete ? '...' : isCompleted
                  ? (hasHarvestPhase ? 'Undo Planted' : 'Undo')
                  : (hasHarvestPhase ? 'Planted' : 'Mark Done')}
              </button>
            )}
            {/* Harvest phase toggle (only shown when event has a harvest date) */}
            {!isIndoorStart && !isRescheduling && hasHarvestPhase && (
              <button
                onClick={toggleHarvestComplete}
                disabled={togglingHarvest}
                className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                  isHarvestCompleted
                    ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {togglingHarvest ? '...' : isHarvestCompleted ? 'Undo Harvested' : 'Harvested'}
              </button>
            )}
            {/* Fallback for events with no planting or harvest phase */}
            {!isIndoorStart && !isRescheduling && !hasPlantingPhase && !hasHarvestPhase && (
              <button
                onClick={toggleComplete}
                disabled={togglingComplete}
                className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                  isCompleted
                    ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {togglingComplete ? '...' : isCompleted ? 'Undo' : 'Mark Done'}
              </button>
            )}
            {isIndoorStart && !isCompleted && (
              <button
                onClick={handleSwitchToDirectSeed}
                disabled={switchingToDirectSeed}
                className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 font-medium rounded-lg transition-colors"
              >
                {switchingToDirectSeed ? '...' : 'Switch to Direct Seed'}
              </button>
            )}
            {isIndoorStart && seedStart && seedStart.status !== 'transplanted' &&
             event.gardenBedId && onNavigateToBed && (
              <button
                onClick={() => {
                  const dateStr = event.transplantDate
                    ? format(new Date(event.transplantDate), 'yyyy-MM-dd')
                    : undefined;
                  onNavigateToBed(event.gardenBedId!, dateStr, seedStart.id);
                  onClose();
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Transplant to Bed
              </button>
            )}
            {/* Plant in Bed - for direct seed events with an assigned bed */}
            {!isIndoorStart && !isCompleted && isDirectSeed &&
             event.gardenBedId && onNavigateToBed && (
              <button
                onClick={() => {
                  const dateStr = event.directSeedDate
                    ? format(new Date(event.directSeedDate), 'yyyy-MM-dd')
                    : undefined;
                  onNavigateToBed(event.gardenBedId!, dateStr, undefined, event.id);
                  onClose();
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Plant in Bed
              </button>
            )}
            {isIndoorStart && seedStart && (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Manage Seed Start
              </button>
            )}
            {isIndoorStart && loadingSeedStart && (
              <button disabled className="flex-1 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg">
                Loading...
              </button>
            )}
            {/* Reschedule button - shown for non-completed events with a planting date */}
            {!isRescheduling && !isCompleted && hasPlantingPhase && (
              <button
                onClick={() => { setIsRescheduling(true); setNewDate(''); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center gap-1"
              >
                <CalendarDays size={16} />
                Reschedule
              </button>
            )}
            {!isRescheduling && (
              <button
                onClick={() => handleDelete()}
                disabled={deleting}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg transition-colors flex items-center gap-1 border border-red-200"
              >
                {deleting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                ) : (
                  <Trash2 size={16} />
                )}
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className={`${isIndoorStart && seedStart ? '' : 'flex-1'} px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors`}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Edit Seed Start Modal */}
      {seedStart && (
        <EditSeedStartModal
          isOpen={showEditModal}
          seedStart={seedStart}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchSeedStart(); // refresh seed start data
            if (onEventUpdated) onEventUpdated();
          }}
          plants={plants}
          showSuccess={() => {}} // Toast handled by parent if needed
          showError={(msg) => console.error(msg)}
        />
      )}
    </>
  );
};

export default EventDetailModal;
