/**
 * Types for the `GET /api/dashboard/today` endpoint.
 * All fields mirror the backend camelCase payload exactly.
 */

export interface HarvestReadyRow {
  plantingEventId: number;
  plantName: string;
  variety?: string | null;
  bedId?: number | null;
  bedName?: string | null;
  quantity: number;
  daysPastExpected: number;
}

export interface IndoorStartDueRow {
  plantingEventId: number;
  plantName: string;
  variety?: string | null;
  seedStartDate: string;
  quantity: number;
}

export interface TransplantDueRow {
  plantingEventId: number;
  plantName: string;
  variety?: string | null;
  transplantDate: string;
  quantity: number;
  bedId?: number | null;
  bedName?: string | null;
}

export interface FrostRisk {
  atRisk: boolean;
  forecastLowF?: number | null;
  windowHours: number;
  source: string;
}

export interface RainAlert {
  expected: boolean;
  inchesExpected: number;
  windowHours: number;
}

export interface CompostOverdueRow {
  pileId: number;
  pileName: string;
  daysSinceLastTurn: number;
  turnFrequencyDays: number;
}

export interface SeedLowStockRow {
  seedId: number;
  plantName: string;
  variety?: string | null;
  quantityRemaining: number;
}

export interface SeedExpiringRow {
  seedId: number;
  plantName: string;
  variety?: string | null;
  expiresOn: string;
  daysUntilExpiry: number;
}

export interface LivestockActionDueRow {
  type: string;
  label: string;
  animal?: string | null;
}

export interface DashboardSignals {
  harvestReady: HarvestReadyRow[];
  indoorStartsDue: IndoorStartDueRow[];
  transplantsDue: TransplantDueRow[];
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
