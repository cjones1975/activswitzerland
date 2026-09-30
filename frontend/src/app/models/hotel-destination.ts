export interface HotelDestinationMapping {
  identifier: string;
  name: string;
  category: 'city' | 'village';
  destId: string;
  destType: string;
  /** GetYourGuide location ID; absent for destinations with no Experiences section. */
  gygLocationId?: number;
}

export interface HotelDeeplinkParams {
  identifier: string;
  checkin: string;
  checkout: string;
  groupAdults: number;
  groupChildren: number;
  noRooms: number;
  currency: string;
  lang: string;
}
