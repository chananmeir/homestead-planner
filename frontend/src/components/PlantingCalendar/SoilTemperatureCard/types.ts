/**
 * TypeScript types for Soil Temperature feature
 */

export type SoilType = 'sandy' | 'loamy' | 'clay';
export type SunExposure = 'full-sun' | 'partial-shade' | 'full-shade';

export interface SoilConfig {
  soilType: SoilType;
  sunExposure: SunExposure;
  hasMulch: boolean;
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
}

export interface CropReadinessMap {
  [plantId: string]: CropReadinessInfo;
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

  // Common fields
  crop_readiness: CropReadinessMap;
  using_mock_data: boolean;
}
