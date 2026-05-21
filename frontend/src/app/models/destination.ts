export interface DestinationGeo {
  '@type': string;
  latitude: number;
  longitude: number;
}

export interface Destination {
  '@context': string;
  '@type': string;
  identifier: string;
  name: string;
  abstract: string;
  url: string;
  photo: string;
  geo: DestinationGeo;
  links: { self: string };
}

export interface DestinationsMeta {
  language: string;
  apiVersion: string;
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

export interface DestinationsResponse {
  success: boolean;
  data: {
    meta: DestinationsMeta;
    links: { self: string };
    data: Destination[];
  };
}
