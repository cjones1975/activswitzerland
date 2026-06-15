import { Attraction } from './attraction';

export interface TripStop {
  stationId: string;
  name: string;
  lat: number;
  lon: number;
}

export interface TripConnection {
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  transfers: number;
  products: string[];
  routeCoordinates: [number, number][];
}

export interface PlannedTrip {
  type: 'road' | 'rail';
  stops: TripStop[];
  name?: string;
  connections?: TripConnection[];
  selectedConnection?: TripConnection;
  attractions?: Attraction[];
  routeCoordinates?: [number, number][];
  attractionSelections?: Record<string, string[]>; // stationId -> selected attraction identifiers
}

export interface SavedTrip {
  _id?: string;
  name: string;
  type: 'road' | 'rail';
  stops: TripStop[];
  attractionIds: string[];
  routeCoordinates: [number, number][];
  createdAt?: string;
}
