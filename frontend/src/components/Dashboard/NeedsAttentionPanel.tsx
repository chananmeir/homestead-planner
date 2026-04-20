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
  DirectSeedDueRow,
  GerminationCheckRow,
  IndoorGerminationCheckRow,
  FrostRisk,
  RainAlert,
  CompostOverdueRow,
  SeedLowStockRow,
  SeedExpiringRow,
  LivestockActionDueRow,
  NeedsAttentionTarget,
} from './types';

export interface NeedsAttentionPanelProps {
  onNavigate: (target: NeedsAttentionTarget) => void;
}

interface SignalRow {
  key: string;
  signalKey?: string;
  icon: string;
  tone: Tone;
  title: string;
  subtitle?: string;
  onClick: (() => void) | null;
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

const NeedsAttentionPanel: React.FC<NeedsAttentionPanelProps> = ({ onNavigate }) => {
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
    return buildRows(data.signals, onNavigate);
  }, [data, onNavigate]);

  const handleSnooze = async (signalKey: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    try {
      const resp = await fetch(`${API_BASE_URL}/api/dashboard/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ signalKey, days: 3 }),
      });
      if (resp.ok) {
        setReloadKey(k => k + 1);
      }
    } catch (err) {
      console.error('[NeedsAttentionPanel] snooze failed:', err);
    }
  };

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
          {visibleRows.map(row => {
            const clickable = row.onClick != null;
            return (
              <button
                key={row.key}
                onClick={clickable ? row.onClick! : undefined}
                disabled={!clickable}
                className={`group w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${toneClasses[row.tone]} ${!clickable ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                {row.signalKey && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleSnooze(row.signalKey!, e)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSnooze(row.signalKey!, e); }}
                    className="text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 hover:!opacity-100 bg-gray-200/60 hover:bg-gray-300/80 text-gray-600 hover:text-gray-800 transition-all flex-shrink-0"
                  >
                    Skip 3d
                  </div>
                )}
              </button>
            );
          })}
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

type NavigateFn = (target: NeedsAttentionTarget) => void;

// Warn at most once per missing-id signal kind per session so broken backend
// payloads surface without flooding the console.
const warnedKinds = new Set<string>();
function warnMissingId(kind: string, row: unknown): void {
  if (warnedKinds.has(kind)) return;
  warnedKinds.add(kind);
  console.warn(`[NeedsAttentionPanel] ${kind} row missing required id — row is non-clickable`, row);
}

/**
 * Build prioritized rows. Order: frost risk -> rain alert -> harvest ready ->
 * indoor starts due -> transplants due -> compost overdue -> seed low stock ->
 * seed expiring -> livestock actions.
 */
function buildRows(signals: DashboardSignals, onNavigate: NavigateFn): SignalRow[] {
  const rows: SignalRow[] = [];

  if (signals.frostRisk?.atRisk) {
    rows.push(frostRiskRow(signals.frostRisk, onNavigate));
  }
  if (signals.rainAlert?.expected) {
    rows.push(rainAlertRow(signals.rainAlert, onNavigate));
  }
  signals.harvestReady?.forEach((r, i) => rows.push(harvestRow(r, i, onNavigate)));
  signals.indoorStartsDue?.forEach((r, i) => rows.push(indoorStartRow(r, i, onNavigate)));
  signals.transplantsDue?.forEach((r, i) => rows.push(transplantRow(r, i, onNavigate)));
  signals.directSeedDue?.forEach((r, i) => rows.push(directSeedRow(r, i, onNavigate)));
  signals.germinationCheck?.forEach((r, i) => rows.push(germinationRow(r, i, onNavigate)));
  signals.indoorGerminationCheck?.forEach((r, i) => rows.push(indoorGerminationRow(r, i, onNavigate)));
  signals.compostOverdue?.forEach((r, i) => rows.push(compostRow(r, i, onNavigate)));
  signals.seedLowStock?.forEach((r, i) => rows.push(seedLowRow(r, i, onNavigate)));
  signals.seedExpiring?.forEach((r, i) => rows.push(seedExpiringRow(r, i, onNavigate)));
  signals.livestockActionsDue?.forEach((r, i) => rows.push(livestockRow(r, i, onNavigate)));

  return rows;
}

function frostRiskRow(risk: FrostRisk, onNavigate: NavigateFn): SignalRow {
  const temp = risk.forecastLowF != null ? `${Math.round(risk.forecastLowF)}°F` : 'forecast low';
  return {
    key: 'frost-risk',
    signalKey: risk.signalKey,
    icon: '❄️',
    tone: 'red',
    title: `Frost risk — ${temp}`,
    subtitle: `Within ${risk.windowHours}h · ${risk.source}`,
    onClick: () => onNavigate({ kind: 'weatherFrost' }),
  };
}

function rainAlertRow(rain: RainAlert, onNavigate: NavigateFn): SignalRow {
  return {
    key: 'rain-alert',
    signalKey: rain.signalKey,
    icon: '🌧️',
    tone: 'yellow',
    title: `Rain expected — ${rain.inchesExpected.toFixed(2)}"`,
    subtitle: `Within ${rain.windowHours}h`,
    onClick: () => onNavigate({ kind: 'weatherRain' }),
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

function harvestRow(row: HarvestReadyRow, idx: number, onNavigate: NavigateFn): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const hasId = row.plantingEventId != null;
  if (!hasId) warnMissingId('harvest', row);
  return {
    key: `harvest-${row.plantingEventId}-${idx}`,
    signalKey: row.signalKey,
    icon: '🧺',
    tone: 'green',
    title: `Harvest ready — ${label}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      row.bedName,
      row.daysPastExpected > 0 ? `${row.daysPastExpected}d past due` : null,
    ]),
    onClick: hasId ? () => onNavigate({ kind: 'harvest', plantingEventId: row.plantingEventId }) : null,
  };
}

function indoorStartRow(row: IndoorStartDueRow, idx: number, onNavigate: NavigateFn): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const hasId = row.indoorSeedStartId != null || row.plantingEventId != null;
  if (!hasId) warnMissingId('indoorStart', row);
  return {
    key: `indoor-${row.plantingEventId ?? `iss-${row.indoorSeedStartId}`}-${idx}`,
    signalKey: row.signalKey,
    icon: '🪴',
    tone: 'blue',
    title: `Indoor start due — ${label}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      formatDate(row.seedStartDate),
    ]),
    onClick: hasId
      ? () => onNavigate({
          kind: 'indoorStart',
          indoorSeedStartId: row.indoorSeedStartId,
          plantingEventId: row.plantingEventId,
        })
      : null,
  };
}

function transplantRow(row: TransplantDueRow, idx: number, onNavigate: NavigateFn): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const hasId = row.plantingEventId != null;
  if (!hasId) warnMissingId('transplant', row);
  return {
    key: `transplant-${row.plantingEventId}-${idx}`,
    signalKey: row.signalKey,
    icon: '🌱',
    tone: 'blue',
    title: `Transplant due — ${label}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      row.bedName,
      formatDate(row.transplantDate),
    ]),
    onClick: hasId
      ? () => onNavigate({ kind: 'transplant', plantingEventId: row.plantingEventId, bedId: row.bedId })
      : null,
  };
}

function directSeedRow(row: DirectSeedDueRow, idx: number, onNavigate: NavigateFn): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const hasId = row.plantingEventId != null;
  if (!hasId) warnMissingId('directSeed', row);
  return {
    key: `direct-seed-${row.plantingEventId}-${idx}`,
    signalKey: row.signalKey,
    icon: '\u{1F330}',
    tone: 'blue',
    title: `Direct seed due \u2014 ${label}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      row.bedName,
      formatDate(row.directSeedDate),
    ]),
    onClick: hasId
      ? () => onNavigate({ kind: 'directSeed', plantingEventId: row.plantingEventId, bedId: row.bedId })
      : null,
  };
}

function germinationRow(row: GerminationCheckRow, idx: number, onNavigate: NavigateFn): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const hasId = row.plantingEventId != null;
  if (!hasId) warnMissingId('germinationCheck', row);
  return {
    key: `germination-${row.plantingEventId}-${idx}`,
    signalKey: row.signalKey,
    icon: '\u{1F331}',
    tone: 'green',
    title: `Check germination \u2014 ${label}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      row.bedName,
      `seeded ${formatDate(row.directSeedDate)}`,
    ]),
    onClick: hasId
      ? () => onNavigate({ kind: 'germinationCheck', plantingEventId: row.plantingEventId, bedId: row.bedId })
      : null,
  };
}

function indoorGerminationRow(row: IndoorGerminationCheckRow, idx: number, onNavigate: NavigateFn): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const keySuffix = row.indoorSeedStartId != null
    ? `iss-${row.indoorSeedStartId}`
    : `pe-${row.plantingEventId}`;
  const hasId = row.indoorSeedStartId != null || row.plantingEventId != null;
  if (!hasId) warnMissingId('indoorGerminationCheck', row);
  return {
    key: `indoor-germ-${keySuffix}-${idx}`,
    signalKey: row.signalKey,
    icon: '\u{1F33F}',
    tone: 'green',
    title: `Check indoor germination \u2014 ${label}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      `started ${formatDate(row.seedStartDate)}`,
    ]),
    onClick: hasId
      ? () => onNavigate({
          kind: 'indoorGerminationCheck',
          indoorSeedStartId: row.indoorSeedStartId,
          plantingEventId: row.plantingEventId,
        })
      : null,
  };
}

function compostRow(row: CompostOverdueRow, idx: number, onNavigate: NavigateFn): SignalRow {
  const hasId = row.pileId != null;
  if (!hasId) warnMissingId('compost', row);
  return {
    key: `compost-${row.pileId}-${idx}`,
    signalKey: row.signalKey,
    icon: '♻️',
    tone: 'yellow',
    title: `Compost overdue — ${row.pileName}`,
    subtitle: `${row.daysSinceLastTurn}d since last turn (every ${row.turnFrequencyDays}d)`,
    onClick: hasId ? () => onNavigate({ kind: 'compost', pileId: row.pileId }) : null,
  };
}

function seedLowRow(row: SeedLowStockRow, idx: number, onNavigate: NavigateFn): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const tone: Tone = row.quantityRemaining <= 1 ? 'red' : 'yellow';
  const hasId = row.seedId != null;
  if (!hasId) warnMissingId('seedLow', row);
  return {
    key: `seed-low-${row.seedId}-${idx}`,
    signalKey: row.signalKey,
    icon: '🌾',
    tone,
    title: `Low seed stock — ${label}`,
    subtitle: `${row.quantityRemaining} remaining`,
    onClick: hasId ? () => onNavigate({ kind: 'seedLow', seedId: row.seedId }) : null,
  };
}

function seedExpiringRow(row: SeedExpiringRow, idx: number, onNavigate: NavigateFn): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const hasId = row.seedId != null;
  if (!hasId) warnMissingId('seedExpiring', row);
  return {
    key: `seed-exp-${row.seedId}-${idx}`,
    signalKey: row.signalKey,
    icon: '⏳',
    tone: 'yellow',
    title: `Seed expiring — ${label}`,
    subtitle: `${row.daysUntilExpiry}d left · ${formatDate(row.expiresOn)}`,
    onClick: hasId ? () => onNavigate({ kind: 'seedExpiring', seedId: row.seedId }) : null,
  };
}

function livestockRow(row: LivestockActionDueRow, idx: number, onNavigate: NavigateFn): SignalRow {
  return {
    key: `livestock-${row.type}-${idx}`,
    signalKey: row.signalKey,
    icon: '🐔',
    tone: 'blue',
    title: row.label,
    subtitle: row.animal ?? undefined,
    onClick: () => onNavigate({ kind: 'livestock', type: row.type }),
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
