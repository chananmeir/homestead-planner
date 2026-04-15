import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { useToday } from '../../contexts/SimulationContext';
import { parseLocalDate } from '../../utils/dateUtils';
import type {
  DashboardToday,
  DashboardSignals,
  HarvestReadyRow,
  IndoorStartDueRow,
  TransplantDueRow,
  FrostRisk,
  RainAlert,
  CompostOverdueRow,
  SeedLowStockRow,
  SeedExpiringRow,
  LivestockActionDueRow,
} from './types';

export interface NeedsAttentionNavHandlers {
  onViewCalendar: () => void;
  onViewHarvests: () => void;
  onViewIndoorStarts: () => void;
  onViewCompost: () => void;
  onViewSeeds: () => void;
  onViewLivestock: () => void;
  onViewWeather: () => void;
  onViewGardenDesigner: () => void;
}

interface SignalRow {
  key: string;
  icon: string;
  tone: Tone;
  title: string;
  subtitle?: string;
  onClick: () => void;
}

type Tone = 'red' | 'yellow' | 'green' | 'blue' | 'gray';

const DEFAULT_VISIBLE = 5;

const toneClasses: Record<Tone, string> = {
  red: 'bg-red-50 border-red-200 hover:bg-red-100 text-red-900',
  yellow: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100 text-yellow-900',
  green: 'bg-green-50 border-green-200 hover:bg-green-100 text-green-900',
  blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-900',
  gray: 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800',
};

const toneIconBg: Record<Tone, string> = {
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-700',
};

const NeedsAttentionPanel: React.FC<NeedsAttentionNavHandlers> = (nav) => {
  const today = useToday();
  const [data, setData] = useState<DashboardToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetch(
          `${API_BASE_URL}/api/dashboard/today?date=${today}`,
          { credentials: 'include' }
        );
        if (cancelled) return;
        if (resp.ok) {
          const json = await resp.json();
          setData(json);
        } else {
          setError("Couldn't load today's signals");
        }
      } catch (err) {
        console.error('[NeedsAttentionPanel] load failed:', err);
        if (!cancelled) setError("Couldn't load today's signals");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [today, reloadKey]);

  const rows: SignalRow[] = useMemo(() => {
    if (!data) return [];
    return buildRows(data.signals, nav);
  }, [data, nav]);

  const visibleRows = expanded ? rows : rows.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = rows.length - visibleRows.length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Needs Attention Today</h2>
          <p className="text-sm text-gray-500 mt-0.5">Your daily signal feed</p>
        </div>
        {!loading && !error && rows.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {rows.length} active
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3" data-testid="needs-attention-loading">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : error ? (
        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="text-sm text-red-800">{error}</div>
          <button
            onClick={() => setReloadKey(k => k + 1)}
            className="text-sm text-red-700 hover:text-red-900 font-medium px-3 py-1 rounded hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-6 text-center">
          <div className="text-3xl mb-2" aria-hidden="true">✨</div>
          <p className="text-sm text-gray-600">All clear — nothing urgent today.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRows.map(row => (
            <button
              key={row.key}
              onClick={row.onClick}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${toneClasses[row.tone]}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 ${toneIconBg[row.tone]}`} aria-hidden="true">
                {row.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{row.title}</div>
                {row.subtitle && (
                  <div className="text-xs opacity-80 truncate">{row.subtitle}</div>
                )}
              </div>
            </button>
          ))}
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-center text-sm text-gray-600 hover:text-green-700 font-medium py-2"
            >
              + {hiddenCount} more
            </button>
          )}
          {expanded && rows.length > DEFAULT_VISIBLE && (
            <button
              onClick={() => setExpanded(false)}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
    <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="h-3 bg-gray-200 rounded w-1/3 animate-pulse mb-2" />
      <div className="h-3 bg-gray-100 rounded w-2/3 animate-pulse" />
    </div>
  </div>
);

/**
 * Build prioritized rows. Order: frost risk -> rain alert -> harvest ready ->
 * indoor starts due -> transplants due -> compost overdue -> seed low stock ->
 * seed expiring -> livestock actions.
 */
function buildRows(
  signals: DashboardSignals,
  nav: NeedsAttentionNavHandlers
): SignalRow[] {
  const rows: SignalRow[] = [];

  if (signals.frostRisk?.atRisk) {
    rows.push(frostRiskRow(signals.frostRisk, nav));
  }
  if (signals.rainAlert?.expected) {
    rows.push(rainAlertRow(signals.rainAlert, nav));
  }
  signals.harvestReady?.forEach((r, i) => rows.push(harvestRow(r, i, nav)));
  signals.indoorStartsDue?.forEach((r, i) => rows.push(indoorStartRow(r, i, nav)));
  signals.transplantsDue?.forEach((r, i) => rows.push(transplantRow(r, i, nav)));
  signals.compostOverdue?.forEach((r, i) => rows.push(compostRow(r, i, nav)));
  signals.seedLowStock?.forEach((r, i) => rows.push(seedLowRow(r, i, nav)));
  signals.seedExpiring?.forEach((r, i) => rows.push(seedExpiringRow(r, i, nav)));
  signals.livestockActionsDue?.forEach((r, i) => rows.push(livestockRow(r, i, nav)));

  return rows;
}

function frostRiskRow(risk: FrostRisk, nav: NeedsAttentionNavHandlers): SignalRow {
  const temp = risk.forecastLowF != null ? `${Math.round(risk.forecastLowF)}°F` : 'forecast low';
  return {
    key: 'frost-risk',
    icon: '❄️',
    tone: 'red',
    title: `Frost risk — ${temp}`,
    subtitle: `Within ${risk.windowHours}h · ${risk.source}`,
    onClick: nav.onViewWeather,
  };
}

function rainAlertRow(rain: RainAlert, nav: NeedsAttentionNavHandlers): SignalRow {
  return {
    key: 'rain-alert',
    icon: '🌧️',
    tone: 'yellow',
    title: `Rain expected — ${rain.inchesExpected.toFixed(2)}"`,
    subtitle: `Within ${rain.windowHours}h`,
    onClick: nav.onViewWeather,
  };
}

/**
 * Build a subtitle by joining only the parts that have content. Using an
 * array + filter avoids template interpolation of `null`/`undefined` — which
 * was the source of the "null plants" dashboard bug (PlantingEvent.quantity
 * is nullable in the backend).
 */
function joinSubtitle(parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => !!p).join(' · ');
}

function plantsFragment(quantity: number | null | undefined): string | null {
  // Omit when null/undefined (unknown) or 0/negative (noise). Per CLAUDE.md
  // we use `!= null` explicitly rather than a falsy check.
  if (quantity == null) return null;
  if (quantity <= 0) return null;
  return `${quantity} plants`;
}

function harvestRow(row: HarvestReadyRow, idx: number, nav: NeedsAttentionNavHandlers): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  return {
    key: `harvest-${row.plantingEventId}-${idx}`,
    icon: '🧺',
    tone: 'green',
    title: `Harvest ready — ${label}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      row.bedName,
      row.daysPastExpected > 0 ? `${row.daysPastExpected}d past due` : null,
    ]),
    onClick: nav.onViewHarvests,
  };
}

function indoorStartRow(row: IndoorStartDueRow, idx: number, nav: NeedsAttentionNavHandlers): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  return {
    key: `indoor-${row.plantingEventId}-${idx}`,
    icon: '🪴',
    tone: 'blue',
    title: `Indoor start due — ${label}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      formatDate(row.seedStartDate),
    ]),
    onClick: nav.onViewIndoorStarts,
  };
}

function transplantRow(row: TransplantDueRow, idx: number, nav: NeedsAttentionNavHandlers): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  return {
    key: `transplant-${row.plantingEventId}-${idx}`,
    icon: '🌱',
    tone: 'blue',
    title: `Transplant due — ${label}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      row.bedName,
      formatDate(row.transplantDate),
    ]),
    onClick: nav.onViewCalendar,
  };
}

function compostRow(row: CompostOverdueRow, idx: number, nav: NeedsAttentionNavHandlers): SignalRow {
  return {
    key: `compost-${row.pileId}-${idx}`,
    icon: '♻️',
    tone: 'yellow',
    title: `Compost overdue — ${row.pileName}`,
    subtitle: `${row.daysSinceLastTurn}d since last turn (every ${row.turnFrequencyDays}d)`,
    onClick: nav.onViewCompost,
  };
}

function seedLowRow(row: SeedLowStockRow, idx: number, nav: NeedsAttentionNavHandlers): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const tone: Tone = row.quantityRemaining <= 1 ? 'red' : 'yellow';
  return {
    key: `seed-low-${row.seedId}-${idx}`,
    icon: '🌾',
    tone,
    title: `Low seed stock — ${label}`,
    subtitle: `${row.quantityRemaining} remaining`,
    onClick: nav.onViewSeeds,
  };
}

function seedExpiringRow(row: SeedExpiringRow, idx: number, nav: NeedsAttentionNavHandlers): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  return {
    key: `seed-exp-${row.seedId}-${idx}`,
    icon: '⏳',
    tone: 'yellow',
    title: `Seed expiring — ${label}`,
    subtitle: `${row.daysUntilExpiry}d left · ${formatDate(row.expiresOn)}`,
    onClick: nav.onViewSeeds,
  };
}

function livestockRow(row: LivestockActionDueRow, idx: number, nav: NeedsAttentionNavHandlers): SignalRow {
  return {
    key: `livestock-${row.type}-${idx}`,
    icon: '🐔',
    tone: 'blue',
    title: row.label,
    subtitle: row.animal ?? undefined,
    onClick: nav.onViewLivestock,
  };
}

function buildPlantLabel(plantName: string, variety?: string | null): string {
  if (variety) return `${plantName} (${variety})`;
  return plantName;
}

function formatDate(dateStr: string): string {
  // Backend sends date-only (YYYY-MM-DD) for these fields; parse as local.
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default NeedsAttentionPanel;
