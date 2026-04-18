/**
 * Types for the `GET /api/dashboard/today` endpoint.
 * All fields mirror the backend camelCase payload exactly.
 */

export interface HarvestReadyRow {
  signalKey: string;
  plantingEventId: number;
  plantName: string;
  variety?: string | null;
  bedId?: number | null;
  bedName?: string | null;
  // PlantingEvent.quantity is a nullable Integer column in the backend;
  // the API faithfully passes null through. UI must guard before rendering.
  quantity: number | null;
  daysPastExpected: number;
}

export interface IndoorStartDueRow {
  signalKey: string;
  // Either plantingEventId (event-driven) or indoorSeedStartId (standalone
  // seed-start record) will be populated — sometimes both, when an
  // IndoorSeedStart is linked to an outdoor PlantingEvent.
  plantingEventId: number | null;
  indoorSeedStartId?: number | null;
  plantName: string;
  variety?: string | null;
  seedStartDate: string;
  quantity: number | null;
}

export interface TransplantDueRow {
  signalKey: string;
  plantingEventId: number;
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

export interface DashboardToday {
  date: string;
  signals: DashboardSignals;
  meta: DashboardTodayMeta;
}
