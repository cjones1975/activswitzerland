import { TripConnection, TripSection } from '../../models/trip';

/** Shapes shared between `TransportService`'s `/connections` response and the AI chat's
 * `get_transit_connections` tool result — both ultimately come from the same backend OJP mapping
 * (`ojp.js`'s `mapLeg()`), just reached via different routes (a real HTTP endpoint vs. an
 * in-process tool call), so both need the same raw-to-TripSection transform. */

export interface PassListStation {
  name: string;
  coordinate?: { x: number; y: number };
}

export interface SectionStop {
  station: { name: string };
  departure?: string;
  arrival?: string;
  platform?: string;
}

export interface SectionJourney {
  name: string;
  category: string;
  number: string;
  to: string;
  passList?: { station: PassListStation }[];
}

export interface SectionWalk {
  duration: number;
}

export interface ConnectionSection {
  departure?: SectionStop;
  arrival?: SectionStop;
  journey?: SectionJourney;
  walk?: SectionWalk;
}

export interface ConnectionResult {
  from: { departure: string; station: { name: string } };
  to: { arrival: string; station: { name: string } };
  duration: string;
  transfers: number;
  products: string[];
  sections: ConnectionSection[];
}

/** No `routeCoordinates` — callers that need the route polyline (the trip planner's map) extract
 * it separately; this is for consumers (the AI chat card) that only need times/legs. */
export function mapConnectionResult(c: ConnectionResult): TripConnection {
  return {
    from: c.from.station.name,
    to: c.to.station.name,
    departure: c.from.departure,
    arrival: c.to.arrival,
    duration: c.duration,
    transfers: c.transfers,
    products: c.products ?? [],
    routeCoordinates: [],
    sections: mapSections(c.sections ?? []),
  };
}

export function mapSections(sections: ConnectionSection[]): TripSection[] {
  return sections
    .filter(s => s.journey || s.walk)
    .map(s => {
      if (s.walk) {
        return { type: 'walk' as const, walkDuration: s.walk.duration };
      }
      return {
        type: 'journey' as const,
        departure: {
          time: s.departure?.departure ?? '',
          station: s.departure?.station.name ?? '',
          platform: s.departure?.platform,
        },
        arrival: {
          time: s.arrival?.arrival ?? '',
          station: s.arrival?.station.name ?? '',
          platform: s.arrival?.platform,
        },
        journey: {
          name: s.journey!.name,
          category: s.journey!.category,
          number: s.journey!.number,
          direction: s.journey!.to,
        },
      };
    });
}
