/**
 * TypeScript types for Soil Temperature feature
 */

export type SoilType = 'sandy' | 'loamy' | 'clay';
export type SunExposure = 'full-sun' | 'partial-shade' | 'full-shade';

export interface SoilConfig {
  soilType: SoilType;
  sunExposure: SunExposure;
  hasMulch: boolean;
  gardenBedId?: number;
}

export interface SoilAdjustments {
  soil_type: number;
  sun_exposure: number;
  mulch: number;
}

export interface CropReadinessInfo {
  status: 'ready' | 'marginal' | 'too_cold';
  min_temp: number;
  current_temp: number;
  name: string;
  depth_cm?: number;
  depth_label?: string;
}

export interface CropReadinessMap {
  [plantId: string]: CropReadinessInfo;
}

export interface DailyReadiness {
  date: string;
  soilTemp: number | null;
  status: 'ready' | 'marginal' | 'too_cold';
}

export interface FrostRiskDay {
  date: string;
  forecastLow: number;
  effectiveLow: number;
  killTemp: number;
}

export interface CropReadinessForecastInfo {
  status: 'ready' | 'marginal' | 'too_cold';
  min_temp: number;
  name: string;
  germination_days: number;
  daily_readiness: DailyReadiness[];
  depth_cm?: number;
  depth_label?: string;
  frostRisk?: boolean;
  frostRiskDays?: FrostRiskDay[];
  frostTolerance?: string;
}

export interface DirectSowOnlyInfo {
  name: string;
  soil_temp_min: number;
}

export interface DirectSowOnlyMap {
  [plantId: string]: DirectSowOnlyInfo;
}

export interface CropReadinessForecastMap {
  [plantId: string]: CropReadinessForecastInfo;
}

export interface SoilTempForecastDay {
  date: string;
  soilTemp: number;
  minSoilTemp: number;
  maxSoilTemp: number;
}

export interface DepthTempInfo {
  finalSoilTemp: number;
  baseTemp: number;
}

export interface TempsByDepth {
  [depthCm: string]: DepthTempInfo;
}

export interface ForecastByDepth {
  [depthCm: string]: SoilTempForecastDay[];
}

export interface SoilTempResponse {
  // Legacy fields (backward compatibility)
  air_temp: number;
  estimated_soil_temp: number;
  soil_adjustments: SoilAdjustments;

  // New Open-Meteo fields
  base_temp?: number;              // Base temperature from API (measured or air)
  final_soil_temp?: number;        // Final temperature after adjustments
  method?: 'measured' | 'estimated' | 'mock';  // Data source method
  source?: string;                 // Human-readable data source

  // Protection offset from season extension
  protection_offset?: number;
  protection_label?: string;

  // Common fields
  crop_readiness: CropReadinessMap;
  using_mock_data: boolean;

  // Multi-depth data
  temps_by_depth?: TempsByDepth;
  forecast_by_depth?: ForecastByDepth;

  // Forecast fields
  soil_temp_forecast?: SoilTempForecastDay[];
  crop_readiness_forecast?: CropReadinessForecastMap;
  crop_readiness_transplant?: CropReadinessForecastMap;
  directSowOnly?: DirectSowOnlyMap;
  frostDataUnavailable?: boolean;
}
