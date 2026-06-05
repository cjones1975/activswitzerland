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
}

export interface PlannedTrip {
  type: 'road' | 'rail';
  stops: TripStop[];
  connections?: TripConnection[];
  selectedConnection?: TripConnection;
  attractions?: Attraction[];
  routeCoordinates?: [number, number][];
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
