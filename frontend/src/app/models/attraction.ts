export interface AttractionGeo {
  latitude: number;
  longitude: number;
}

export interface AttractionClassification {
  name?: string;
  title?: string;
  values?: { name: string; title: string }[];
}

export interface AttractionLanguage {
  alternateName: string;
}

export interface AttractionEvent {
  audience?: { audienceType?: string };
  minimumAttendeeCapacity?: number;
  maximumAttendeeCapacity?: number;
}

export interface AttractionPrice {
  minPrice?: number;
  priceCurrency?: string;
}

export interface AttractionAddress {
  name?: string;
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
  telephone?: string;
  email?: string;
  url?: string;
}

export interface Attraction {
  identifier: string;
  name: string;
  abstract: string;
  photo: string;
  image?: { url: string }[];
  geo: AttractionGeo;
  url?: string;
  description?: string;
  classification?: AttractionClassification[];
  availableLanguage?: AttractionLanguage[];
  event?: AttractionEvent;
  price?: AttractionPrice;
  address?: AttractionAddress[];
}

export interface AttractionsMeta {
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

export interface AttractionsResponse {
  success: boolean;
  data: {
    meta?: AttractionsMeta;
    data: Attraction[];
  };
}
