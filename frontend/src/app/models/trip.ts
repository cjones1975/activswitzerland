export type TripDateMode = 'dates' | 'days';

export interface TripDateRange {
  mode: TripDateMode;
  startDate?: string;  // ISO yyyy-mm-dd, mode === 'dates'
  endDate?: string;
  startDay?: number;   // 1-based relative day, mode === 'days'
  endDay?: number;
}

export type TripStopRole = 'departure' | 'destination' | 'stop';

export interface TripStop {
  id: string;                      // client-generated uuid
  role: TripStopRole;
  name: string;
  lat: number;
  lon: number;
  externalId?: string;              // present if picked via rail station search
  days: number;                     // whole days spent here; 0 = same-day pass-through (or a non-day departure point like "home")
}

export interface TripSectionStop {
  time:      string;
  station:   string;
  platform?: string;
}

export interface TripSectionJourney {
  name:      string;
  category:  string;
  number:    string;
  direction: string;
}

export interface TripSection {
  type:          'journey' | 'walk';
  departure?:    TripSectionStop;
  arrival?:      TripSectionStop;
  journey?:      TripSectionJourney;
  walkDuration?: number;
}

export interface TripConnection {
  from:             string;
  to:               string;
  departure:        string;
  arrival:          string;
  duration:         string;
  transfers:        number;
  products:         string[];
  routeCoordinates: [number, number][];
  sections?:        TripSection[];
}

// Rail-only: one connection per leg between consecutive stops
export interface TripConnectionLeg {
  fromStopId: string;
  toStopId: string;
  connection?: TripConnection; // absent while unresolved ("Skip for now")
  skipped?: boolean;
}

export type ActivityKind = 'attraction' | 'hike' | 'bike';

export interface TripActivitySelection {
  id: string;
  stopId: string;
  kind: ActivityKind;
  refId: string;
  day: string | number;             // ISO date or relative day #, within the stop's allocated days
  name: string;
  lat?: number; lon?: number;
  distanceKm?: number;               // hike/bike only
  category?: 'national' | 'regional' | 'local';
}

export interface PlannedTrip {
  type: 'road' | 'rail';
  dateMode: TripDateMode;
  range: TripDateRange;              // Step 1's overall range
  stops: TripStop[];                 // Step 2's ordered itinerary
  connections?: TripConnectionLeg[]; // rail only, Step 2 sub-phase
  activities: TripActivitySelection[]; // Step 3
  routeCoordinates?: [number, number][];
  name?: string;
}

export interface SavedTrip extends PlannedTrip {
  _id?: string;
  createdAt?: string;
}
