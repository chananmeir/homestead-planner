/**
 * Types for the `GET /api/dashboard/today` endpoint.
 * All fields mirror the backend camelCase payload exactly.
 */

export interface HarvestReadyRow {
  signalKey: string;
  plantingEventId: number;
  // NEW (row-grouping, Apr 2026). When the backend collapses N events that
  // share (date, plantId, variety, bedId) into a single row, this carries
  // the full id list so snooze/dismiss can fan out one POST per id. Always
  // length 1 for singletons. Optional for backward compat with older payloads
  // — frontend defaults to `[plantingEventId]` when absent.
  plantingEventIds?: number[];
  plantName: string;
  variety?: string | null;
  bedId?: number | null;
  bedName?: string | null;
  // PlantingEvent.quantity is a nullable Integer column in the backend;
  // the API faithfully passes null through. UI must guard before rendering.
  // For grouped rows the backend returns the SUM across the group.
  quantity: number | null;
  daysPastExpected: number;
  // Optional. When true, the harvest is older than HARVEST_DEMOTION_DAYS
  // (backend constant). UI demotes the visual tone to gray but — per the
  // stale-needs-attention finding — NEVER hides the row, because a harvest
  // that wasn't logged is still real inventory data the user may back-date.
  isStale?: boolean;
}

export interface IndoorStartDueRow {
  signalKey: string;
  // Either plantingEventId (event-driven) or indoorSeedStartId (standalone
  // seed-start record) will be populated — sometimes both, when an
  // IndoorSeedStart is linked to an outdoor PlantingEvent.
  plantingEventId: number | null;
  indoorSeedStartId?: number | null;
  // NEW (row-grouping, Apr 2026). Same semantics as HarvestReadyRow above.
  // For ISS-path indoor starts the row may carry indoorSeedStartIds INSTEAD
  // of (or in addition to) plantingEventIds — fan-out walks both arrays.
  plantingEventIds?: number[];
  indoorSeedStartIds?: number[];
  plantName: string;
  variety?: string | null;
  seedStartDate: string;
  quantity: number | null;
}

export interface TransplantDueRow {
  signalKey: string;
  plantingEventId: number;
  plantingEventIds?: number[];
  plantName: string;
  variety?: string | null;
  transplantDate: string;
  quantity: number | null;
  bedId?: number | null;
  bedName?: string | null;
}

export interface DirectSeedDueRow {
  signalKey: string;
  plantingEventId: number;
  plantingEventIds?: number[];
  plantName: string;
  variety?: string | null;
  directSeedDate: string;
  quantity: number | null;
  bedId?: number | null;
  bedName?: string | null;
}

export interface GerminationCheckRow {
  signalKey: string;
  plantingEventId: number;
  plantingEventIds?: number[];
  plantName: string;
  variety?: string | null;
  directSeedDate: string;
  expectedGerminationDate: string;
  germinationDays: number;
  quantity: number | null;
  bedId?: number | null;
  bedName?: string | null;
}

export interface IndoorGerminationCheckRow {
  signalKey: string;
  // Either or both may be set: indoorSeedStartId is preferred when present,
  // plantingEventId is the fallback path. At least one will always be populated.
  plantingEventId: number | null;
  indoorSeedStartId: number | null;
  // NEW (row-grouping, Apr 2026). Same semantics as IndoorStartDueRow —
  // ISS-path rows may carry indoorSeedStartIds; PE-path rows carry
  // plantingEventIds. Both optional for backward compat.
  plantingEventIds?: number[];
  indoorSeedStartIds?: number[];
  plantName: string;
  variety?: string | null;
  seedStartDate: string;            // ISO date
  expectedGerminationDate: string;  // ISO date
  germinationDays: number;
  quantity: number | null;
}

export interface FrostRisk {
  signalKey: string;
  atRisk: boolean;
  forecastLowF?: number | null;
  windowHours: number;
  source: string;
}

export interface RainAlert {
  signalKey: string;
  expected: boolean;
  inchesExpected: number;
  windowHours: number;
}

export interface CompostOverdueRow {
  signalKey: string;
  pileId: number;
  pileName: string;
  daysSinceLastTurn: number;
  turnFrequencyDays: number;
}

export interface SeedLowStockRow {
  signalKey: string;
  seedId: number;
  plantName: string;
  variety?: string | null;
  quantityRemaining: number;
}

export interface SeedExpiringRow {
  signalKey: string;
  seedId: number;
  plantName: string;
  variety?: string | null;
  expiresOn: string;
  daysUntilExpiry: number;
}

export interface LivestockActionDueRow {
  signalKey: string;
  type: string;
  label: string;
  animal?: string | null;
}

export interface DashboardSignals {
  harvestReady: HarvestReadyRow[];
  indoorStartsDue: IndoorStartDueRow[];
  transplantsDue: TransplantDueRow[];
  directSeedDue: DirectSeedDueRow[];
  germinationCheck: GerminationCheckRow[];
  indoorGerminationCheck: IndoorGerminationCheckRow[];
  frostRisk: FrostRisk;
  rainAlert: RainAlert;
  compostOverdue: CompostOverdueRow[];
  seedLowStock: SeedLowStockRow[];
  seedExpiring: SeedExpiringRow[];
  livestockActionsDue: LivestockActionDueRow[];
}

export interface DashboardTodayMeta {
  generatedAt: string;
  userTimezone: string;
}

/**
 * Aged-out rows surfaced in the collapsed "Missed" bucket below the primary
 * feed. The bucket is populated by the backend after applying per-type
 * staleness filters (STALE_INDOOR_START_DAYS etc. in dashboard_service.py).
 * Only the three bucketable types are present here — germination checks drop
 * silently when stale, and harvests stay in `signals.harvestReady` with
 * `isStale=true`. See dashboard-stale-needs-attention-plan.md §2.3.
 *
 * Row shapes are identical to their live counterparts in `DashboardSignals`,
 * so the frontend reuses the same row builders with an `isMissed` flag for
 * tone + chip changes.
 */
export interface DashboardMissed {
  indoorStartsDue: IndoorStartDueRow[];
  transplantsDue: TransplantDueRow[];
  directSeedDue: DirectSeedDueRow[];
}

export interface DashboardToday {
  date: string;
  signals: DashboardSignals;
  // Optional in the type so older cached/mocked payloads without the key
  // don't crash the panel. Runtime code defaults to empty lists.
  missed?: DashboardMissed;
  meta: DashboardTodayMeta;
}

export type NeedsAttentionTarget =
  | { kind: 'harvest'; plantingEventId: number }
  | { kind: 'harvestBed'; plantingEventId: number; bedId: number }
  | { kind: 'indoorStart'; indoorSeedStartId?: number | null; plantingEventId?: number | null }
  | { kind: 'transplant'; plantingEventId: number; bedId?: number | null }
  | { kind: 'directSeed'; plantingEventId: number; bedId?: number | null }
  | { kind: 'germinationCheck'; plantingEventId: number; bedId?: number | null }
  | { kind: 'indoorGerminationCheck'; indoorSeedStartId?: number | null; plantingEventId?: number | null }
  | { kind: 'compost'; pileId: number }
  | { kind: 'seedLow'; seedId: number }
  | { kind: 'seedExpiring'; seedId: number }
  | { kind: 'livestock'; type: string }
  | { kind: 'weatherFrost' }
  | { kind: 'weatherRain' };
