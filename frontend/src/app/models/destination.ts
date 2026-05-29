export interface DestinationGeo {
  '@type': string;
  latitude: number;
  longitude: number;
}

export interface DestinationImage {
  '@type'?: string;
  url: string;
  name?: string;
  keywords?: string;
  encodingFormat?: string;
  width?: number;
  height?: number;
}

export interface Destination {
  '@context': string;
  '@type': string;
  identifier: string;
  name: string;
  abstract: string;
  description?: string;
  url: string;
  photo: string;
  image?: DestinationImage[];
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
