import { Destination } from './destination';

/** Minimal named location — used where a full MySwitzerland catalogue Destination isn't available (e.g. a free-text trip stop). */
export interface GeoPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export type GeoLocation = Destination | GeoPoint;

export interface ActivityPickerPayload {
  destination: GeoLocation;
  mode?: 'view' | 'select';   // default 'view'
  stopId?: string;             // set when mode === 'select'
  /** Where this list was opened from, for 'view' mode back-nav: 'destination-detail' reopens it on back, 'map' just collapses. */
  origin?: 'destination-detail' | 'map';
}
