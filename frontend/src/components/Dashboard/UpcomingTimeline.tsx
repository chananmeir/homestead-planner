import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { useNow } from '../../contexts/SimulationContext';
import { PLANT_DATABASE } from '../../data/plantDatabase';
import type { PlantingEvent, GardenBed } from '../../types';

const humanizePlantId = (id: string): string =>
  id.replace(/-\d+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const resolvePlantName = (plantId?: string | null): string => {
  if (!plantId) return '(no name)';
  const match = PLANT_DATABASE.find(p => p.id === plantId);
  return match ? match.name : humanizePlantId(plantId);
};

interface UpcomingTimelineProps {
  onViewCalendar: () => void;
}

interface TimelineRow {
  id: number;
  date: Date;
  dateLabel: string;
  typeLabel: string;
  title: string;
  bedName?: string;
  typeColor: string;
}

const UpcomingTimeline: React.FC<UpcomingTimelineProps> = ({ onViewCalendar }) => {
  const now = useNow();
  const [events, setEvents] = useState<PlantingEvent[]>([]);
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayKey = now.toDateString();
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const start = new Date(todayKey);
        const end = new Date(todayKey);
        end.setDate(end.getDate() + 14);
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const [eventsResp, bedsResp] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/planting-events?start_date=${startStr}&end_date=${endStr}`,
            { credentials: 'include' }
          ),
          fetch(`${API_BASE_URL}/api/garden-beds`, { credentials: 'include' }),
        ]);

        if (cancelled) return;

        if (eventsResp.ok) {
          const data = await eventsResp.json();
          setEvents(Array.isArray(data) ? data : []);
        } else {
          setError('Could not load upcoming events.');
        }
        if (bedsResp.ok) {
          const bedData = await bedsResp.json();
          setBeds(Array.isArray(bedData) ? bedData : []);
        }
      } catch (err) {
        if (!cancelled) setError('Could not load upcoming events.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [todayKey]);

  const rows: TimelineRow[] = useMemo(() => {
    const bedById = new Map(beds.map(b => [b.id, b.name]));
    return events
      .map((ev): TimelineRow | null => {
        const dateStr = ev.transplantDate || ev.directSeedDate || ev.seedStartDate;
        if (!dateStr) return null;
        // API returns ISO datetime; if switched to date-only, use parseLocalDate
        const d = new Date(dateStr);
        if (d < now) return null;

        let typeLabel = 'Planting';
        let typeColor = 'bg-green-100 text-green-800';
        if (ev.eventType && ev.eventType !== 'planting') {
          typeLabel = ev.eventType.charAt(0).toUpperCase() + ev.eventType.slice(1);
          const colorMap: Record<string, string> = {
            mulch: 'bg-amber-100 text-amber-800',
            fertilizing: 'bg-purple-100 text-purple-800',
            irrigation: 'bg-blue-100 text-blue-800',
            'maple-tapping': 'bg-orange-100 text-orange-800',
          };
          typeColor = colorMap[ev.eventType] || typeColor;
        } else if (ev.transplantDate) {
          typeLabel = 'Transplant';
          typeColor = 'bg-emerald-100 text-emerald-800';
        } else if (ev.directSeedDate) {
          typeLabel = 'Direct sow';
          typeColor = 'bg-green-100 text-green-800';
        } else if (ev.seedStartDate) {
          typeLabel = 'Seed start';
          typeColor = 'bg-lime-100 text-lime-800';
        }

        const title = ev.variety || resolvePlantName(ev.plantId);
        const bedName = ev.gardenBedId ? bedById.get(ev.gardenBedId) : undefined;

        return {
          id: ev.id,
          date: d,
          dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          typeLabel,
          title,
          bedName,
          typeColor,
        };
      })
      .filter((r): r is TimelineRow => r !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 7);
  }, [events, beds, now]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Upcoming · Next 14 days</h2>
          <p className="text-sm text-gray-500 mt-0.5">Planting events &amp; tasks</p>
        </div>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-gray-500">{error}</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-gray-400 text-3xl mb-2">📅</div>
            <p className="text-sm text-gray-500">No events in the next 14 days.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map(row => (
              <li key={row.id} className="py-2.5 flex items-center gap-3">
                <div className="w-16 flex-shrink-0 text-xs font-medium text-gray-500">
                  {row.dateLabel}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${row.typeColor}`}>
                  {row.typeLabel}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">{row.title}</div>
                  {row.bedName && (
                    <div className="text-xs text-gray-500 truncate">{row.bedName}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={onViewCalendar}
          className="text-sm text-green-700 hover:text-green-800 font-medium"
        >
          See full calendar →
        </button>
      </div>
    </div>
  );
};

export default UpcomingTimeline;
