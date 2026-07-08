export type CategoryKey = 'cities' | 'mountains-lakes' | 'nature-parks';

export interface CategoryConfig {
  facets: string;
  title: string;
  subtitle: string;
  pageSubtitle: string;
  cardTitle: string;
  mapIcon: string;
}

export const DESTINATION_CATEGORIES: Record<CategoryKey, CategoryConfig> = {
  cities: {
    facets: 'placetypes:cities',
    title: 'destinations.cityBreaks.title',
    subtitle: 'destinations.cityBreaks.subtitle',
    pageSubtitle: 'destinations.allCities.subtitle',
    cardTitle: 'City',
    mapIcon: 'fa-sharp fa-house-turret',
    
  },
  'mountains-lakes': {
    facets: '[placetypes:mountains,placetypes:mountainpasses,placetypes:glaciers,placetypes:mountainlakes,placetypes:smalllakes,placetypes:biglakes,placetypes:lakes]',
    title: 'destinations.mountains.title',
    subtitle: 'destinations.mountains.subtitle',
    pageSubtitle: 'destinations.mountains.count',
    cardTitle: 'Mountain',
    mapIcon: 'fa-sharp fa-solid fa-mountain',
  },
  'nature-parks': {
    facets: '[placetypes:natureparks,placetypes:wildlifeparks]',
    title: 'destinations.natureParks.title',
    subtitle: 'destinations.natureParks.subtitle',
    pageSubtitle: 'destinations.natureParks.count',
    cardTitle: 'Nature Park',
    mapIcon: 'fa-sharp fa-solid fa-deer',
  },
};
