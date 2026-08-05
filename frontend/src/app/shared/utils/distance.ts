const EARTH_RADIUS_KM = 6371;

function haversineKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Mirrors `backend/src/utils/geo.js`'s `routeDistanceKm` — used client-side in Step 4, before a
 * trip has been saved and gained a server-computed `distanceKm`. */
export function routeDistanceKm(coords: [number, number][]): number {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) total += haversineKm(coords[i], coords[i + 1]);
  return Math.round(total * 10) / 10;
}

export function kmToMi(km: number): number {
  return km * 0.621371;
}

/** "150 km / 93 mi" */
export function formatDistance(km: number): string {
  return `${Math.round(km)} km / ${Math.round(kmToMi(km))} mi`;
}
