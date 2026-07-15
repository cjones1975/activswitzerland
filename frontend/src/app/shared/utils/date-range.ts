import { TripDateRange } from '../../models/trip';

/** Inclusive day count spanned by a range (a range from a date/day to itself is a valid 1-day trip). Null if incomplete. */
export function tripDayCount(range: TripDateRange): number | null {
  if (range.mode === 'days') {
    return range.startDay != null && range.endDay != null && range.endDay >= range.startDay
      ? range.endDay - range.startDay + 1
      : null;
  }
  if (!range.startDate || !range.endDate) return null;
  const diff = Math.round((Date.parse(range.endDate) - Date.parse(range.startDate)) / 86400000);
  return diff >= 0 ? diff + 1 : null;
}
