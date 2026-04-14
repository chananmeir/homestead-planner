import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { useActivePlan } from '../../contexts/ActivePlanContext';
import type { GardenPlan } from '../../types';

interface PlansSectionProps {
  onManagePlans: () => void;
}

const PlansSection: React.FC<PlansSectionProps> = ({ onManagePlans }) => {
  const { activePlan, setActivePlan } = useActivePlan();
  const [plans, setPlans] = useState<GardenPlan[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const resp = await fetch(`${API_BASE_URL}/api/garden-plans`, { credentials: 'include' });
        if (!cancelled && resp.ok) {
          const data = await resp.json();
          setPlans(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('[PlansSection] load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activePlan?.id]);

  const otherPlans = plans.filter(p => p.id !== activePlan?.id);
  const sorted = [...otherPlans].sort((a, b) => {
    // Newest first by updatedAt, falling back to year
    const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (aUpdated !== bUpdated) return bUpdated - aUpdated;
    return (b.year || 0) - (a.year || 0);
  });
  const visible = showAll ? sorted : sorted.slice(0, 4);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Plans</h2>
        <button
          onClick={onManagePlans}
          className="text-sm text-gray-600 hover:text-green-700 font-medium"
        >
          Manage all →
        </button>
      </div>

      {activePlan && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-800 border border-green-200 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Active
          </span>
          <span className="text-gray-900 font-medium truncate">{activePlan.name}</span>
          <span className="text-gray-500">· {activePlan.year}</span>
        </div>
      )}

      <div className="text-xs uppercase text-gray-500 font-medium tracking-wide mb-2">
        Other plans
      </div>

      {loading ? (
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-8 w-28 bg-gray-100 rounded-full animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-sm text-gray-500">No other plans yet.</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {visible.map(plan => (
              <button
                key={plan.id}
                onClick={() => setActivePlan(plan)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-green-50 hover:border-green-300 text-sm text-gray-700 hover:text-green-800 transition-colors"
                title={`Make ${plan.name} active`}
              >
                <span className="font-medium truncate max-w-[160px]">{plan.name}</span>
                <span className="text-xs text-gray-500">{plan.year}</span>
              </button>
            ))}
          </div>
          {sorted.length > 4 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="mt-3 text-xs text-gray-600 hover:text-green-700 font-medium"
            >
              {showAll ? 'Show fewer' : `Show all (${sorted.length})`}
            </button>
          )}
        </>
      )}

      <div className="mt-5 pt-5 border-t border-gray-100">
        <button
          onClick={onManagePlans}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Plan
        </button>
      </div>
    </div>
  );
};

export default PlansSection;
