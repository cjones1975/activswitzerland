export type TrailCategory = 'national' | 'regional' | 'local';

// geo.admin.ch reports individual stages as LineString or MultiLineString
// depending on whether the stage has a gap; the backend normalizes both to
// MultiLineString so the frontend only deals with one shape.
export interface TrailGeometry {
  type: 'MultiLineString';
  coordinates: [number, number][][];
}

export interface TrailStage {
  stageId: string;
  geometry: TrailGeometry;       // LV95 easting/northing meters
  geometryWgs84: TrailGeometry;  // lon/lat
}

export interface TrailRoute {
  routeNumber: string | number;
  name: string;
  category: TrailCategory;
  distanceKm: number;
  distanceMiles: number;
  stages: TrailStage[];
}

export interface TrailRoutesResponse {
  success: boolean;
  count: number;
  radiusMeters: number;
  data: TrailRoute[];
}

// Mirrors SchweizMobil's real-world trail signage: red for national routes,
// blue for regional, amber for local.
export function trailCategoryColor(category: TrailCategory): string {
  switch (category) {
    case 'national': return '#e53e3e';
    case 'regional': return '#2563eb';
    default: return '#d97706';
  }
}
