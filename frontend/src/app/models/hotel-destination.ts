export interface HotelDestinationMapping {
  identifier: string;
  name: string;
  category: 'city' | 'village';
  destId: string;
  destType: string;
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
