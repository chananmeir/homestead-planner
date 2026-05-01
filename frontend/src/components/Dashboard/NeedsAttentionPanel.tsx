import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { useToday } from '../../contexts/SimulationContext';
import { parseLocalDate } from '../../utils/dateUtils';
import type {
  DashboardToday,
  DashboardSignals,
  DashboardMissed,
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
  // For grouped rows (backend collapsed N same-task events into one row), this
  // carries the full set of signalKeys so snooze/dismiss can fan out one POST
  // per member. When undefined or length 1, the row is a singleton and behaves
  // exactly as before — single POST against `signalKey`.
  //
  // The representative `signalKey` above is always the FIRST element of this
  // array when populated. Click target continues to use the representative;
  // snooze, dismiss, cancel, and undo fan out across grouped keys.
  groupSignalKeys?: string[];
  icon: string;
  tone: Tone;
  title: string;
  subtitle?: string;
  onClick: (() => void) | null;
  secondaryAction?: {
    label: string;
    ariaLabel: string;
    title: string;
    onClick: () => void;
  };
  // True when the row was promoted from `data.missed.*` into the collapsed
  // Missed bucket. Forces tone='gray', drops the `Skip 3d` chip (pointless
  // after aging out), and adds `opacity-60` to the row chrome. Cancel task /
  // Dismiss remain available because those edit real data / snooze state.
  isMissed?: boolean;
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

/**
 * Discriminated union describing which backend entity a "Cancel task" click
 * should target. Returned by {@link getCancellableAction} based on the
 * signalKey prefix emitted by `backend/services/dashboard_service.py`.
 */
type CancellableAction =
  | { kind: 'planting-event'; entityId: number }
  | { kind: 'indoor-seed-start'; entityId: number };

/**
 * Decide whether a row should show "Cancel task" (destructive, soft-deletes
 * the underlying PlantingEvent / IndoorSeedStart) versus the default ×
 * dismiss-forever snooze. Returns null for rows that are not cancellable
 * (weather alerts, harvest reminders, germination checks, etc.).
 *
 * Prefix-order matters: `indoor-iss-` and `indoor-germ-` are both more
 * specific than the bare `indoor-` prefix and MUST be checked first.
 */
function getCancellableAction(signalKey: string): CancellableAction | null {
  if (signalKey.startsWith('indoor-iss-')) {
    const id = parseInt(signalKey.slice('indoor-iss-'.length), 10);
    return Number.isFinite(id) ? { kind: 'indoor-seed-start', entityId: id } : null;
  }
  // Germination-check rows (`indoor-germ-iss-*`, `indoor-germ-pe-*`) are not
  // cancellable — keep them on the default dismiss path.
  if (signalKey.startsWith('indoor-germ-')) return null;
  if (signalKey.startsWith('indoor-')) {
    const id = parseInt(signalKey.slice('indoor-'.length), 10);
    return Number.isFinite(id) ? { kind: 'planting-event', entityId: id } : null;
  }
  if (signalKey.startsWith('direct-seed-')) {
    const id = parseInt(signalKey.slice('direct-seed-'.length), 10);
    return Number.isFinite(id) ? { kind: 'planting-event', entityId: id } : null;
  }
  return null;
}

function cancelUrl(action: CancellableAction): string {
  const base = action.kind === 'planting-event' ? 'planting-events' : 'indoor-seed-starts';
  return `${API_BASE_URL}/api/${base}/${action.entityId}/cancel`;
}

function getCancellableActions(signalKeys: string[]): CancellableAction[] {
  const actions: CancellableAction[] = [];
  const seen = new Set<string>();
  for (const key of signalKeys) {
    const action = getCancellableAction(key);
    if (!action) continue;
    const stableKey = `${action.kind}:${action.entityId}`;
    if (seen.has(stableKey)) continue;
    seen.add(stableKey);
    actions.push(action);
  }
  return actions;
}

/**
 * Build the full set of signalKeys covered by a grouped row, using the
 * backend's `f'{prefix}-{id}'` template. The representative `signalKey` on
 * the row is the FIRST element so callers that don't fan out still hit the
 * representative event.
 *
 * Returns an array of length 1 when the row is a singleton (no grouping
 * present, or only one id). The handler-level fan-out short-circuits a
 * length-1 array to a single POST so behavior is bit-identical to the
 * pre-grouping path.
 *
 * Prefixes are duplicated from `backend/services/dashboard_service.py` —
 * if the backend changes a prefix, this helper must change too.
 */
function buildGroupSignalKeys(
  prefix: string,
  ids: number[] | undefined,
  fallbackKey: string,
): string[] {
  if (!ids || ids.length === 0) return [fallbackKey];
  return ids.map(id => `${prefix}-${id}`);
}

/**
 * Merge two grouped-key arrays into a single deduped array. Used for ISS-path
 * rows that may carry BOTH `plantingEventIds` (with `indoor-` prefix) and
 * `indoorSeedStartIds` (with `indoor-iss-` prefix) — fan-out walks both.
 */
function mergeGroupSignalKeys(a: string[], b: string[]): string[] {
  if (b.length === 0) return a;
  if (a.length === 0) return b;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of a) {
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  for (const k of b) {
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

function uncancelUrl(action: CancellableAction): string {
  const base = action.kind === 'planting-event' ? 'planting-events' : 'indoor-seed-starts';
  return `${API_BASE_URL}/api/${base}/${action.entityId}/uncancel`;
}

const NeedsAttentionPanel: React.FC<NeedsAttentionPanelProps> = ({ onNavigate }) => {
  const today = useToday();
  const [data, setData] = useState<DashboardToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Tracks signalKeys that are in the 5-second "Dismissed · Undo" window.
  // Timers are held in a ref so re-renders don't recreate them.
  const [pendingDismissals, setPendingDismissals] = useState<Set<string>>(new Set());
  const dismissTimersRef = useRef<Map<string, number>>(new Map());
  // When a pending row came from a "Cancel task" click we remember the
  // action so the Undo button can POST to the matching /uncancel endpoint.
  // Keyed by signalKey. Presence here means the strip should render as
  // "Cancelled · Undo" instead of "Dismissed · Undo".
  const pendingCancelsRef = useRef<Map<string, CancellableAction[]>>(new Map());
  // For grouped-row dismissals we capture the full set of signalKeys at
  // dismiss-time so Undo can fan out a DELETE across each member. Keyed by
  // the representative signalKey (= keys[0]). Singletons store a length-1
  // array; the lookup is uniform.
  const pendingDismissKeysRef = useRef<Map<string, string[]>>(new Map());

  // Clear any outstanding dismiss timers on unmount so they don't fire
  // setReloadKey on an unmounted component.
  useEffect(() => {
    const timers = dismissTimersRef.current;
    const cancels = pendingCancelsRef.current;
    const dismissKeys = pendingDismissKeysRef.current;
    return () => {
      timers.forEach(id => window.clearTimeout(id));
      timers.clear();
      cancels.clear();
      dismissKeys.clear();
    };
  }, []);

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

  // Aged-out rows surfaced separately in the collapsed "Missed" section.
  // Empty when the backend payload omits `missed` (older servers, cached
  // responses, or before Slice A ships) — the section is conditionally
  // rendered only when this array is non-empty.
  const missedRows: SignalRow[] = useMemo(() => {
    if (!data || !data.missed) return [];
    return buildMissedRows(data.missed, onNavigate);
  }, [data, onNavigate]);
  const [missedExpanded, setMissedExpanded] = useState(false);

  /**
   * Snooze one or more signalKeys for 3 days. For grouped rows the keys
   * array contains all member events; we fan out one POST per key in
   * parallel via Promise.all. The endpoint accepts a single key per call
   * (see dashboard_bp.py:53-98); per D3 we deferred the bulk-snooze
   * endpoint to a future pass. Reload only fires after every member has
   * resolved so the feed doesn't re-render mid-fan-out.
   */
  const handleSnooze = async (
    signalKeyOrKeys: string | string[],
    e: React.MouseEvent | React.KeyboardEvent,
  ) => {
    e.stopPropagation();
    const keys = Array.isArray(signalKeyOrKeys) ? signalKeyOrKeys : [signalKeyOrKeys];
    if (keys.length === 0) return;
    try {
      const responses = await Promise.all(
        keys.map(key =>
          fetch(`${API_BASE_URL}/api/dashboard/snooze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ signalKey: key, days: 3 }),
          })
        )
      );
      // Reload if at least one succeeded — partial success still hides
      // the snoozed members on next refresh.
      if (responses.some(r => r.ok)) {
        setReloadKey(k => k + 1);
      }
    } catch (err) {
      console.error('[NeedsAttentionPanel] snooze failed:', err);
    }
  };

  /**
   * Dismiss-forever for one or more signalKeys. Fan-out mirrors handleSnooze.
   * The 5-second undo window is keyed by the representative signalKey only;
   * Undo restores all group members because handleUndo also fans out across
   * the same array (stored on the SignalRow at render time).
   */
  const handleDismiss = async (
    signalKeyOrKeys: string | string[],
    e: React.MouseEvent | React.KeyboardEvent,
  ) => {
    e.stopPropagation();
    const keys = Array.isArray(signalKeyOrKeys) ? signalKeyOrKeys : [signalKeyOrKeys];
    if (keys.length === 0) return;
    const representativeKey = keys[0];
    // No-op if already in the pending-dismissed window (guards against double-click).
    if (dismissTimersRef.current.has(representativeKey)) return;
    try {
      const responses = await Promise.all(
        keys.map(key =>
          fetch(`${API_BASE_URL}/api/dashboard/snooze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ signalKey: key, forever: true }),
          })
        )
      );
      if (!responses.some(r => r.ok)) {
        // All members failed: don't enter the pending-dismissed state.
        return;
      }
      const signalKey = representativeKey;
      // Remember the full key set so Undo can fan-out the DELETE.
      pendingDismissKeysRef.current.set(signalKey, keys);
      // Start the 5-second undo window. POST already persisted the snooze,
      // so even if the tab closes the dismiss sticks.
      const timerId = window.setTimeout(() => {
        dismissTimersRef.current.delete(signalKey);
        pendingDismissKeysRef.current.delete(signalKey);
        setPendingDismissals(prev => {
          const next = new Set(prev);
          next.delete(signalKey);
          return next;
        });
        setReloadKey(k => k + 1);
      }, 5000);
      dismissTimersRef.current.set(signalKey, timerId);
      setPendingDismissals(prev => {
        const next = new Set(prev);
        next.add(signalKey);
        return next;
      });
    } catch (err) {
      console.error('[NeedsAttentionPanel] dismiss failed:', err);
    }
  };

  /**
   * Soft-cancel the underlying entity/entities (PlantingEvent or IndoorSeedStart).
   * Mirrors {@link handleDismiss}: on success, enter the 5-second "Cancelled
   * · Undo" window; on failure, leave the row untouched. 404 is treated as
   * success (entity already gone) to keep the UI consistent with backend
   * state. 403 is logged and the row is left alone — ownership mismatches
   * shouldn't happen for authenticated users but if they do we don't want to
   * pretend the cancel worked.
   */
  const handleCancelTask = async (
    signalKey: string,
    actions: CancellableAction[],
    e: React.MouseEvent | React.KeyboardEvent
  ) => {
    e.stopPropagation();
    if (dismissTimersRef.current.has(signalKey)) return;
    if (actions.length === 0) return;
    try {
      const responses = await Promise.all(
        actions.map(action =>
          fetch(cancelUrl(action), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          })
        )
      );
      const anySuccess = responses.some(resp => resp.ok || resp.status === 404);
      if (!anySuccess) {
        // 403 or 5xx: don't enter pending state, just refetch so UI stays in
        // sync with whatever the server thinks is true.
        if (responses.some(resp => resp.status === 403)) setReloadKey(k => k + 1);
        return;
      }
      if (responses.some(resp => resp.status === 403)) {
        console.error('[NeedsAttentionPanel] cancel forbidden', signalKey);
      }
      pendingCancelsRef.current.set(signalKey, actions);
      const timerId = window.setTimeout(() => {
        dismissTimersRef.current.delete(signalKey);
        pendingCancelsRef.current.delete(signalKey);
        setPendingDismissals(prev => {
          const next = new Set(prev);
          next.delete(signalKey);
          return next;
        });
        setReloadKey(k => k + 1);
      }, 5000);
      dismissTimersRef.current.set(signalKey, timerId);
      setPendingDismissals(prev => {
        const next = new Set(prev);
        next.add(signalKey);
        return next;
      });
    } catch (err) {
      console.error('[NeedsAttentionPanel] cancel failed:', err);
    }
  };

  /**
   * Undo a cancel by POSTing to /uncancel. Structure mirrors
   * {@link handleUndo} for dismissals; the only difference is the endpoint
   * (the cancel endpoints are POST-only, not DELETE).
   */
  const handleUncancelTask = async (
    signalKey: string,
    actions: CancellableAction[],
    e: React.MouseEvent | React.KeyboardEvent
  ) => {
    e.stopPropagation();
    const timerId = dismissTimersRef.current.get(signalKey);
    if (timerId != null) {
      window.clearTimeout(timerId);
      dismissTimersRef.current.delete(signalKey);
    }
    pendingCancelsRef.current.delete(signalKey);
    setPendingDismissals(prev => {
      const next = new Set(prev);
      next.delete(signalKey);
      return next;
    });
    try {
      await Promise.all(
        actions.map(action =>
          fetch(uncancelUrl(action), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          })
        )
      );
    } catch (err) {
      console.error('[NeedsAttentionPanel] uncancel failed:', err);
    } finally {
      setReloadKey(k => k + 1);
    }
  };

  const handleUndo = async (signalKey: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    // Cancel the pending refetch timer first so the feed doesn't reload twice.
    const timerId = dismissTimersRef.current.get(signalKey);
    if (timerId != null) {
      window.clearTimeout(timerId);
      dismissTimersRef.current.delete(signalKey);
    }
    // Recover the full key set captured at dismiss time. Fall back to the
    // representative if grouping wasn't recorded (singletons, or stale
    // pending state from a prior session).
    const keysToUndo = pendingDismissKeysRef.current.get(signalKey) ?? [signalKey];
    pendingDismissKeysRef.current.delete(signalKey);
    setPendingDismissals(prev => {
      const next = new Set(prev);
      next.delete(signalKey);
      return next;
    });
    try {
      await Promise.all(
        keysToUndo.map(key =>
          fetch(`${API_BASE_URL}/api/dashboard/snooze`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ signalKey: key }),
          })
        )
      );
    } catch (err) {
      console.error('[NeedsAttentionPanel] undo failed:', err);
    } finally {
      // Always refetch so the UI recovers to server state even if DELETE failed.
      setReloadKey(k => k + 1);
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
      ) : rows.length === 0 && missedRows.length === 0 ? (
        <div className="py-6 text-center">
          <div className="text-3xl mb-2" aria-hidden="true">✨</div>
          <p className="text-sm text-gray-600">All clear — nothing urgent today.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRows.map(row => renderSignalRow(row))}
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
          {/*
            Missed bucket — collapsed by default. Only rendered when at least
            one stale row is present. Uses native <details>/<summary> so the
            open/closed state survives React re-renders without extra state
            and is keyboard-accessible for free. Rows reuse the same deep-link
            and signalKey as their live counterparts.
          */}
          {missedRows.length > 0 && (
            <details
              className="mt-3 border-t border-gray-100 pt-3"
              open={missedExpanded}
              onToggle={(e) => setMissedExpanded((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 py-1 select-none list-none flex items-center gap-2">
                <span
                  className="inline-block transform transition-transform"
                  style={{ transform: missedExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  aria-hidden="true"
                >
                  ▶
                </span>
                <span>Missed ({missedRows.length})</span>
              </summary>
              <div className="space-y-2 mt-2">
                {missedRows.map(row => renderSignalRow(row))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );

  // Renders a single SignalRow — extracted so the primary feed and the Missed
  // bucket can share identical chrome (pending-dismissed strip, Skip 3d chip,
  // Cancel task button, Dismiss button). Declared inside the component so it
  // closes over the snooze/dismiss/cancel handlers and pending state.
  function renderSignalRow(row: SignalRow) {
    const clickable = row.onClick != null;
    const cancelActions = row.signalKey != null
      ? getCancellableActions(row.groupSignalKeys ?? [row.signalKey])
      : [];
    const cancellable = cancelActions.length > 0;
    const isPendingDismiss = row.signalKey != null && pendingDismissals.has(row.signalKey);
    if (isPendingDismiss && row.signalKey) {
      // Replacement "Dismissed · Undo" (or "Cancelled · Undo") strip —
      // keeps the same vertical footprint as the real row so the feed
      // doesn't jump. The pendingCancelsRef lookup tells us which
      // Undo endpoint to call and which label to show.
      const pendingCancelAction = pendingCancelsRef.current.get(row.signalKey);
      const wasCancelled = pendingCancelAction != null;
      return (
        <div
          key={row.key}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border ${
            wasCancelled
              ? 'bg-orange-50 border-orange-200 text-orange-800'
              : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 ${
              wasCancelled ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'
            }`}
            aria-hidden="true"
          >
            {wasCancelled ? '🗑' : '✓'}
          </div>
          <div className="flex-1 min-w-0 text-sm italic">
            {wasCancelled ? 'Cancelled' : 'Dismissed'}
          </div>
          <button
            type="button"
            onClick={(e) =>
              wasCancelled
                ? handleUncancelTask(row.signalKey!, pendingCancelAction!, e)
                : handleUndo(row.signalKey!, e)
            }
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              wasCancelled
                ? handleUncancelTask(row.signalKey!, pendingCancelAction!, e)
                : handleUndo(row.signalKey!, e);
            }}
            className="text-xs font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2 px-2 py-1 rounded hover:bg-blue-50 flex-shrink-0"
          >
            Undo
          </button>
        </div>
      );
    }
    // Missed rows get opacity-60 chrome in addition to their gray tone, even
    // when clickable — signals to the eye that this is archived, not urgent.
    // The existing `!clickable` opacity-60 for disabled rows stays; combining
    // them is harmless (both apply opacity-60).
    const missedDim = row.isMissed ? 'opacity-60' : '';
    const disabledDim = !clickable ? 'opacity-60 cursor-not-allowed' : '';
    return (
      <button
        key={row.key}
        onClick={clickable ? row.onClick! : undefined}
        disabled={!clickable}
        className={`group w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${toneClasses[row.tone]} ${disabledDim} ${missedDim}`.trim()}
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
        {/*
          Skip 3d is hidden for Missed rows — snoozing an aged-out task for
          3 days is pointless. Cancel task / Dismiss remain visible because
          those edit real data (cancels the PlantingEvent) or persist the
          dismissal across future refreshes.
        */}
        {row.signalKey && !row.isMissed && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => handleSnooze(row.groupSignalKeys ?? row.signalKey!, e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSnooze(row.groupSignalKeys ?? row.signalKey!, e);
            }}
            className="text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 hover:!opacity-100 bg-gray-200/60 hover:bg-gray-300/80 text-gray-600 hover:text-gray-800 transition-all flex-shrink-0"
          >
            Skip 3d
          </div>
        )}
        {row.secondaryAction && (
          <div
            role="button"
            tabIndex={0}
            aria-label={row.secondaryAction.ariaLabel}
            title={row.secondaryAction.title}
            onClick={(e) => {
              e.stopPropagation();
              row.secondaryAction?.onClick();
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.stopPropagation();
              row.secondaryAction?.onClick();
            }}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 hover:bg-green-200 text-green-800 font-medium transition-colors flex-shrink-0"
          >
            {row.secondaryAction.label}
          </div>
        )}
        {row.signalKey && cancellable && (
          // Cancel task: destructive — soft-deletes the underlying
          // PlantingEvent or IndoorSeedStart. More prominent styling
          // than the × dismiss button because it affects real data,
          // not just the signal feed.
          <div
            role="button"
            tabIndex={0}
            aria-label="Cancel this task"
            title="Cancel task (removes the planting from your schedule)"
            onClick={(e) => handleCancelTask(row.signalKey!, cancelActions, e)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCancelTask(row.signalKey!, cancelActions, e); }}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 hover:!opacity-100 bg-red-100 hover:bg-red-200 text-red-800 font-medium transition-all flex-shrink-0"
          >
            <span aria-hidden="true">×</span>
            <span>Cancel task</span>
          </div>
        )}
        {row.signalKey && !cancellable && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Dismiss this signal"
            title="Dismiss permanently"
            onClick={(e) => handleDismiss(row.groupSignalKeys ?? row.signalKey!, e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDismiss(row.groupSignalKeys ?? row.signalKey!, e);
            }}
            className="text-xs leading-none w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:!opacity-100 bg-red-100/60 hover:bg-red-200 text-red-700 transition-all flex-shrink-0"
          >
            ×
          </div>
        )}
      </button>
    );
  }
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
 * Build prioritized rows for the PRIMARY (active) feed. Order: frost risk ->
 * rain alert -> harvest ready -> indoor starts due -> transplants due ->
 * direct seed due -> germination checks -> compost overdue -> seed low stock
 * -> seed expiring -> livestock actions.
 *
 * Aged-out rows live in `buildMissedRows()` and render in a separate
 * collapsible section below. The backend pre-filters `signals.*` to active
 * items only and puts stale copies into `data.missed.*`, so this builder
 * doesn't need to re-filter.
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

/**
 * Build gray-toned rows for the collapsed "Missed" bucket. Reuses the live
 * row builders with `isMissed=true`, which forces tone='gray' and flags the
 * row so the render loop hides the `Skip 3d` chip but keeps Cancel task /
 * Dismiss available.
 *
 * Deep-link targets (`NeedsAttentionTarget`) and `signalKey` values are
 * intentionally identical to the live rows so a missed-row click navigates
 * to the same place (Indoor Starts, Calendar, Garden Designer) as its live
 * counterpart would have. See dashboard-stale-needs-attention-plan.md §2.3.
 */
function buildMissedRows(missed: DashboardMissed, onNavigate: NavigateFn): SignalRow[] {
  const rows: SignalRow[] = [];
  missed.indoorStartsDue?.forEach((r, i) => rows.push(indoorStartRow(r, i, onNavigate, true)));
  missed.transplantsDue?.forEach((r, i) => rows.push(transplantRow(r, i, onNavigate, true)));
  missed.directSeedDue?.forEach((r, i) => rows.push(directSeedRow(r, i, onNavigate, true)));
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

/**
 * Returns the trailing `(N)` group-count badge appended to row titles when
 * the backend collapses N same-task PlantingEvents into a single row.
 * Empty string for singletons so the title is byte-identical to the
 * pre-grouping output. The same convention is used by ListView.
 */
function countSuffix(count: number): string {
  if (count <= 1) return '';
  return ` (${count})`;
}

function harvestRow(row: HarvestReadyRow, idx: number, onNavigate: NavigateFn): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const hasId = row.plantingEventId != null;
  const hasBedTarget = hasId && row.bedId != null;
  if (!hasId) warnMissingId('harvest', row);
  // Stale harvests are demoted visually but NEVER hidden — see
  // dashboard-stale-needs-attention-plan.md §2.2 "harvest" row. The backend
  // flips isStale=true after HARVEST_DEMOTION_DAYS; we pick gray vs green
  // from that. Use `=== true` per the standing nullable-field rule even
  // though `!= null` would be fine here — keeps the pattern consistent.
  const tone: Tone = row.isStale === true ? 'gray' : 'green';
  const groupKeys = buildGroupSignalKeys('harvest', row.plantingEventIds, row.signalKey);
  const count = groupKeys.length;
  return {
    key: `harvest-${row.plantingEventId}-${idx}`,
    signalKey: row.signalKey,
    groupSignalKeys: count > 1 ? groupKeys : undefined,
    icon: '🧺',
    tone,
    title: `Harvest ready — ${label}${countSuffix(count)}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      row.bedName,
      row.daysPastExpected > 0 ? `${row.daysPastExpected}d past due` : null,
    ]),
    onClick: hasId ? () => onNavigate({ kind: 'harvest', plantingEventId: row.plantingEventId }) : null,
    secondaryAction: hasBedTarget ? {
      label: 'View bed',
      ariaLabel: `View ${label} in ${row.bedName || 'garden bed'}`,
      title: row.bedName ? `Open ${row.bedName} in Garden Designer` : 'Open garden bed in Garden Designer',
      onClick: () => onNavigate({
        kind: 'harvestBed',
        plantingEventId: row.plantingEventId,
        bedId: row.bedId!,
      }),
    } : undefined,
  };
}

function indoorStartRow(
  row: IndoorStartDueRow,
  idx: number,
  onNavigate: NavigateFn,
  isMissed: boolean = false,
): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const hasId = row.indoorSeedStartId != null || row.plantingEventId != null;
  if (!hasId) warnMissingId('indoorStart', row);
  // Missed rows share the same deep-link target and signalKey as the live
  // row — only the tone + chip visibility differ. Key is prefixed so React
  // doesn't collide a stale row with a fresh one if both were ever present.
  const keyPrefix = isMissed ? 'missed-indoor' : 'indoor';
  // Indoor-start rows can group across BOTH PlantingEvents (`indoor-` prefix)
  // and IndoorSeedStarts (`indoor-iss-` prefix). Merge the two arrays so a
  // single row can fan-out across both ID spaces if backend ever emits both.
  const peKeys = buildGroupSignalKeys('indoor', row.plantingEventIds,
    row.plantingEventId != null ? row.signalKey : '');
  const issKeys = buildGroupSignalKeys('indoor-iss', row.indoorSeedStartIds,
    row.indoorSeedStartId != null ? row.signalKey : '');
  // Drop the empty-string fallbacks that occur when the corresponding side
  // is absent (so we don't end up with stray "" entries).
  const filteredPe = peKeys.filter(k => k !== '');
  const filteredIss = issKeys.filter(k => k !== '');
  const merged = mergeGroupSignalKeys(filteredPe, filteredIss);
  // Final fallback: representative signalKey when neither array yielded keys.
  const groupKeys = merged.length > 0 ? merged : [row.signalKey];
  const count = groupKeys.length;
  return {
    key: `${keyPrefix}-${row.plantingEventId ?? `iss-${row.indoorSeedStartId}`}-${idx}`,
    signalKey: row.signalKey,
    groupSignalKeys: count > 1 ? groupKeys : undefined,
    icon: '🪴',
    tone: isMissed ? 'gray' : 'blue',
    title: `Indoor start due — ${label}${countSuffix(count)}`,
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
    isMissed,
  };
}

function transplantRow(
  row: TransplantDueRow,
  idx: number,
  onNavigate: NavigateFn,
  isMissed: boolean = false,
): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const hasId = row.plantingEventId != null;
  if (!hasId) warnMissingId('transplant', row);
  const keyPrefix = isMissed ? 'missed-transplant' : 'transplant';
  const groupKeys = buildGroupSignalKeys('transplant', row.plantingEventIds, row.signalKey);
  const count = groupKeys.length;
  return {
    key: `${keyPrefix}-${row.plantingEventId}-${idx}`,
    signalKey: row.signalKey,
    groupSignalKeys: count > 1 ? groupKeys : undefined,
    icon: '🌱',
    tone: isMissed ? 'gray' : 'blue',
    title: `Transplant due — ${label}${countSuffix(count)}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      row.bedName,
      formatDate(row.transplantDate),
    ]),
    onClick: hasId
      ? () => onNavigate({ kind: 'transplant', plantingEventId: row.plantingEventId, bedId: row.bedId })
      : null,
    isMissed,
  };
}

function directSeedRow(
  row: DirectSeedDueRow,
  idx: number,
  onNavigate: NavigateFn,
  isMissed: boolean = false,
): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const hasId = row.plantingEventId != null;
  if (!hasId) warnMissingId('directSeed', row);
  const keyPrefix = isMissed ? 'missed-direct-seed' : 'direct-seed';
  const groupKeys = buildGroupSignalKeys('direct-seed', row.plantingEventIds, row.signalKey);
  const count = groupKeys.length;
  return {
    key: `${keyPrefix}-${row.plantingEventId}-${idx}`,
    signalKey: row.signalKey,
    groupSignalKeys: count > 1 ? groupKeys : undefined,
    icon: '\u{1F330}',
    tone: isMissed ? 'gray' : 'blue',
    title: `Direct seed due \u2014 ${label}${countSuffix(count)}`,
    subtitle: joinSubtitle([
      plantsFragment(row.quantity),
      row.bedName,
      formatDate(row.directSeedDate),
    ]),
    onClick: hasId
      ? () => onNavigate({ kind: 'directSeed', plantingEventId: row.plantingEventId, bedId: row.bedId })
      : null,
    isMissed,
  };
}

function germinationRow(row: GerminationCheckRow, idx: number, onNavigate: NavigateFn): SignalRow {
  const label = buildPlantLabel(row.plantName, row.variety);
  const hasId = row.plantingEventId != null;
  if (!hasId) warnMissingId('germinationCheck', row);
  const groupKeys = buildGroupSignalKeys('germination', row.plantingEventIds, row.signalKey);
  const count = groupKeys.length;
  return {
    key: `germination-${row.plantingEventId}-${idx}`,
    signalKey: row.signalKey,
    groupSignalKeys: count > 1 ? groupKeys : undefined,
    icon: '\u{1F331}',
    tone: 'green',
    title: `Check germination \u2014 ${label}${countSuffix(count)}`,
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
  // Indoor germination has dual prefixes:
  //   - ISS path: signalKey = `indoor-germ-iss-{id}`
  //   - PE  path: signalKey = `indoor-germ-pe-{id}`
  // Build both possible groups; merge so a row with both ID arrays fans out.
  const peKeys = buildGroupSignalKeys('indoor-germ-pe', row.plantingEventIds,
    row.plantingEventId != null ? row.signalKey : '');
  const issKeys = buildGroupSignalKeys('indoor-germ-iss', row.indoorSeedStartIds,
    row.indoorSeedStartId != null ? row.signalKey : '');
  const filteredPe = peKeys.filter(k => k !== '');
  const filteredIss = issKeys.filter(k => k !== '');
  const merged = mergeGroupSignalKeys(filteredPe, filteredIss);
  const groupKeys = merged.length > 0 ? merged : [row.signalKey];
  const count = groupKeys.length;
  return {
    key: `indoor-germ-${keySuffix}-${idx}`,
    signalKey: row.signalKey,
    groupSignalKeys: count > 1 ? groupKeys : undefined,
    icon: '\u{1F33F}',
    tone: 'green',
    title: `Check indoor germination \u2014 ${label}${countSuffix(count)}`,
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
