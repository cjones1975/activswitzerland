export interface ElevationPoint {
  distanceKm: number;
  elevation: number;
}

export interface ElevationProfile {
  points: ElevationPoint[];
  ascentM: number;
  descentM: number;
  minElevation: number;
  maxElevation: number;
}

export interface ElevationProfileResponse {
  success: boolean;
  data: ElevationProfile;
}
