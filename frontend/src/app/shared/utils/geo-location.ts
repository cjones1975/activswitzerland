import { Destination } from '../../models/destination';
import { GeoLocation } from '../../models/geo-point';

export function isDestination(loc: GeoLocation): loc is Destination {
  return 'geo' in loc;
}

export function locId(loc: GeoLocation): string {
  return isDestination(loc) ? loc.identifier : loc.id;
}

export function locLat(loc: GeoLocation): number {
  return isDestination(loc) ? loc.geo.latitude : loc.lat;
}

export function locLon(loc: GeoLocation): number {
  return isDestination(loc) ? loc.geo.longitude : loc.lon;
}
