import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { useToday } from '../../contexts/SimulationContext';
import type { GardenSnapshotResponse, GardenBed } from '../../types';

interface DashboardGardenSnapshotProps {
  onOpenGarden: () => void;
}

const DashboardGardenSnapshot: React.FC<DashboardGardenSnapshotProps> = ({ onOpenGarden }) => {
  const today = useToday();
  const [snapshot, setSnapshot] = useState<GardenSnapshotResponse | null>(null);
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [snapResp, bedsResp] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/garden-planner/garden-snapshot?date=${today}`,
            { credentials: 'include' }
          ),
          fetch(`${API_BASE_URL}/api/garden-beds`, { credentials: 'include' }),
        ]);
        if (cancelled) return;
        if (snapResp.ok) {
          setSnapshot(await snapResp.json());
        } else {
          setError('Could not load snapshot.');
        }
        if (bedsResp.ok) {
          const data = await bedsResp.json();
          setBeds(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setError('Could not load snapshot.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [today]);

  const stats = useMemo(() => {
    const totalBeds = beds.length;
    const bedsWithPlants = snapshot?.summary.bedsWithPlants ?? 0;
    const emptyBeds = Math.max(0, totalBeds - bedsWithPlants);
    const totalPlants = snapshot?.summary.totalPlants ?? 0;
    return { totalBeds, bedsWithPlants, emptyBeds, totalPlants };
  }, [beds, snapshot]);

  const topPlants = useMemo(() => {
    if (!snapshot) return [];
    return Object.entries(snapshot.byPlant)
      .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
      .slice(0, 3);
  }, [snapshot]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Garden Today</h2>
          <p className="text-sm text-gray-500 mt-0.5">Point-in-time inventory</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 flex-1">
          <div className="h-14 bg-gray-50 rounded-lg animate-pulse" />
          <div className="h-14 bg-gray-50 rounded-lg animate-pulse" />
        </div>
      ) : error ? (
        <div className="text-sm text-gray-500">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatTile label="Total plants" value={stats.totalPlants} tone="green" />
            <StatTile label="Beds planted" value={`${stats.bedsWithPlants}/${stats.totalBeds}`} tone="blue" />
          </div>

          <div className="flex-1">
            <div className="text-xs uppercase text-gray-500 font-medium tracking-wide mb-2">
              Top crops in ground
            </div>
            {topPlants.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">
                Nothing in the ground today.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {topPlants.map(([key, entry]) => (
                  <li key={key} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <span className="text-gray-900 font-medium">{entry.plantName}</span>
                      {entry.variety && (
                        <span className="text-gray-500"> · {entry.variety}</span>
                      )}
                    </div>
                    <span className="text-gray-700 font-semibold tabular-nums ml-2">
                      {entry.totalQuantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={onOpenGarden}
          className="text-sm text-green-700 hover:text-green-800 font-medium"
        >
          Open Garden →
        </button>
      </div>
    </div>
  );
};

type StatTone = 'green' | 'blue' | 'yellow' | 'red' | 'gray';

const StatTile: React.FC<{ label: string; value: string | number; tone: StatTone }> = ({ label, value, tone }) => {
  const tones: Record<StatTone, string> = {
    green: 'bg-green-50 border-green-100 text-green-900',
    blue: 'bg-blue-50 border-blue-100 text-blue-900',
    yellow: 'bg-yellow-50 border-yellow-100 text-yellow-900',
    red: 'bg-red-50 border-red-100 text-red-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
};

export default DashboardGardenSnapshot;
