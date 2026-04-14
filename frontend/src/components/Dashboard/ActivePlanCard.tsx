import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { useActivePlan } from '../../contexts/ActivePlanContext';
import { useNow } from '../../contexts/SimulationContext';
import { PLANT_DATABASE } from '../../data/plantDatabase';
import type { PlantingEvent, GardenBed } from '../../types';

const humanizePlantId = (id: string): string =>
  id.replace(/-\d+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const resolvePlantName = (plantId?: string | null): string => {
  if (!plantId) return 'Planting';
  const match = PLANT_DATABASE.find(p => p.id === plantId);
  return match ? match.name : humanizePlantId(plantId);
};

interface ActivePlanCardProps {
  onOpenGarden: () => void;
  onViewCalendar: () => void;
  onAddEvent: () => void;
  onManagePlans: () => void;
}

interface NextEventSummary {
  label: string;
  date: string;
  daysAway: number;
}

const ActivePlanCard: React.FC<ActivePlanCardProps> = ({
  onOpenGarden,
  onViewCalendar,
  onAddEvent,
  onManagePlans,
}) => {
  const { activePlan, loading: planLoading } = useActivePlan();
  const now = useNow();

  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [events, setEvents] = useState<PlantingEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activePlan) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const [bedsResp, eventsResp] = await Promise.all([
          fetch(`${API_BASE_URL}/api/garden-beds`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/planting-events`, { credentials: 'include' }),
        ]);
        if (cancelled) return;
        if (bedsResp.ok) {
          const bedsData = await bedsResp.json();
          setBeds(Array.isArray(bedsData) ? bedsData : []);
        }
        if (eventsResp.ok) {
          const eventsData = await eventsResp.json();
          setEvents(Array.isArray(eventsData) ? eventsData : []);
        }
      } catch (err) {
        console.error('[ActivePlanCard] load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [activePlan]);

  const stats = useMemo(() => {
    if (!activePlan) return { bedCount: 0, totalPlants: 0, upcomingCount: 0 };
    const bedCount = beds.length;
    const totalPlants = (activePlan.items || []).reduce(
      (sum, item) => sum + (item.plantEquivalent || 0),
      0
    );
    const upcomingCount = events.filter(ev => {
      const dateStr = ev.transplantDate || ev.directSeedDate || ev.seedStartDate;
      if (!dateStr) return false;
      // API returns ISO datetime; if switched to date-only, use parseLocalDate
      const d = new Date(dateStr);
      return d >= now && !ev.isComplete && !ev.completed;
    }).length;
    return { bedCount, totalPlants, upcomingCount };
  }, [activePlan, beds, events, now]);

  const nextEvent: NextEventSummary | null = useMemo(() => {
    if (!events.length) return null;
    const upcoming = events
      .filter(ev => {
        const dateStr = ev.transplantDate || ev.directSeedDate || ev.seedStartDate;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d >= now && !ev.isComplete && !ev.completed;
      })
      .map(ev => {
        const dateStr = (ev.transplantDate || ev.directSeedDate || ev.seedStartDate) as string;
        return { ev, dateStr, date: new Date(dateStr) };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (!upcoming.length) return null;
    const first = upcoming[0];
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysAway = Math.max(0, Math.round((first.date.getTime() - now.getTime()) / msPerDay));
    const typeLabel = first.ev.eventType && first.ev.eventType !== 'planting'
      ? first.ev.eventType.charAt(0).toUpperCase() + first.ev.eventType.slice(1)
      : first.ev.transplantDate
        ? 'Transplant'
        : first.ev.directSeedDate
          ? 'Direct sow'
          : 'Seed start';
    const name = first.ev.variety || resolvePlantName(first.ev.plantId);
    return {
      label: `${typeLabel} — ${name}`,
      date: first.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      daysAway,
    };
  }, [events, now]);

  if (planLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="animate-pulse h-4 w-64 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!activePlan) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">No active plan yet</h2>
            <p className="text-gray-600 mt-1">
              Create a season plan to start tracking what to grow, where, and when.
            </p>
          </div>
          <button
            onClick={onManagePlans}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            Create Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-green-700 uppercase tracking-wide mb-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              Active Plan
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{activePlan.name}</h2>
            <div className="text-sm text-gray-500 mt-1">
              {activePlan.year}
              {activePlan.season ? ` · ${activePlan.season}` : ''}
            </div>
          </div>
          <button
            onClick={onOpenGarden}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
          >
            Open Garden
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <Stat label="Beds" value={stats.bedCount} loading={loading} />
          <Stat label="Planned Plants" value={stats.totalPlants} loading={loading} />
          <Stat label="Upcoming Events" value={stats.upcomingCount} loading={loading} />
          <Stat label="Plan Items" value={activePlan.items?.length ?? 0} />
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="text-xs uppercase text-gray-500 font-medium tracking-wide mb-1">
            Next up
          </div>
          {nextEvent ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-gray-900 font-medium">{nextEvent.label}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-600">{nextEvent.date}</span>
              <span className="text-gray-400 text-sm">
                ({nextEvent.daysAway === 0 ? 'today' : `in ${nextEvent.daysAway} day${nextEvent.daysAway === 1 ? '' : 's'}`})
              </span>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              No upcoming events scheduled. Export your plan to the calendar to see what's next.
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
        <button
          onClick={onViewCalendar}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-white hover:text-green-700 rounded-md transition-colors"
        >
          View Calendar
        </button>
        <button
          onClick={onAddEvent}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-white hover:text-green-700 rounded-md transition-colors"
        >
          Add Event
        </button>
        <button
          onClick={onManagePlans}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-white hover:text-green-700 rounded-md transition-colors ml-auto"
        >
          Manage plans →
        </button>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; loading?: boolean }> = ({ label, value, loading }) => (
  <div>
    <div className="text-xs uppercase text-gray-500 font-medium tracking-wide">{label}</div>
    {loading ? (
      <div className="animate-pulse h-7 w-12 bg-gray-100 rounded mt-1" />
    ) : (
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
    )}
  </div>
);

export default ActivePlanCard;
