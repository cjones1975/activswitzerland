export interface AttractionGeo {
  latitude: number;
  longitude: number;
}

export interface Attraction {
  identifier: string;
  name: string;
  abstract: string;
  photo: string;
  image?: { url: string }[];
  geo: AttractionGeo;
  url?: string;
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
