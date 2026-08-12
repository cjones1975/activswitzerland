import { Lang } from '../services/lang';

export interface LocalizableTrip {
  name?: string;
  review?: string;
  nameTranslations?: { de?: string; fr?: string; it?: string };
  reviewTranslations?: { de?: string; fr?: string; it?: string };
}

export function localizedName(trip: LocalizableTrip, lang: Lang): string {
  if (lang === 'en') return trip.name ?? '';
  return trip.nameTranslations?.[lang] || trip.name || '';
}

export function localizedReview(trip: LocalizableTrip, lang: Lang): string {
  if (lang === 'en') return trip.review ?? '';
  return trip.reviewTranslations?.[lang] || trip.review || '';
}
