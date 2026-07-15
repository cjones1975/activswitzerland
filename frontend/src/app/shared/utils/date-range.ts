import { PlannedTrip, TripDateRange, TripStop } from '../../models/trip';

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

/**
 * "Day N" / "Days N–M" per stop, derived by walking the itinerary and accumulating days spent.
 * A 0-day stop (same-day pass-through, or a non-day departure point like "home") doesn't get an
 * exclusive day of its own — it's labeled with whatever day is already "current" at that point:
 * Day 0 if nothing has been allocated yet, otherwise the same day as the stop before it.
 */
export function stopDayRanges(stops: TripStop[]): Map<string, { start: number; end: number }> {
  const ranges = new Map<string, { start: number; end: number }>();
  let currentDay = 0;
  for (const stop of stops) {
    if (stop.days > 0) {
      const start = currentDay + 1;
      const end = currentDay + stop.days;
      ranges.set(stop.id, { start, end });
      currentDay = end;
    } else {
      ranges.set(stop.id, { start: currentDay, end: currentDay });
    }
  }
  return ranges;
}

export interface StopDayOption {
  value: string | number;  // ISO date in 'dates' mode, relative day # in 'days' mode — what gets stored on TripActivitySelection.day
  dayNumber: number;       // 1-based day-of-trip, for display labels regardless of mode
}

/** Concrete day choices a stop's activities can be assigned to. */
export function stopDayOptions(trip: PlannedTrip, stopId: string): StopDayOption[] {
  const range = stopDayRanges(trip.stops).get(stopId);
  if (!range || range.end < range.start) return [];

  const days: number[] = [];
  for (let d = range.start; d <= range.end; d++) days.push(d);

  if (trip.dateMode !== 'dates' || !trip.range.startDate) {
    return days.map(d => ({ value: d, dayNumber: d }));
  }

  const start = Date.parse(trip.range.startDate);
  return days.map(d => {
    const date = new Date(start + (d - 1) * 86400000);
    return { value: date.toISOString().slice(0, 10), dayNumber: d };
  });
}

/** "2026-07-22" -> "22-07-2026" */
export function formatDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/** Translation key + params for a day choice's display label — "Day N" in 'days' mode, "Day N - DD-MM-YYYY" in 'dates' mode. */
export function dayChoiceLabelParams(trip: PlannedTrip, option: StopDayOption): { key: string; params: Record<string, unknown> } {
  if (trip.dateMode === 'dates' && typeof option.value === 'string') {
    return { key: 'trip.planner.step3.dayDateLabel', params: { day: option.dayNumber, date: formatDdMmYyyy(option.value) } };
  }
  return { key: 'trip.planner.step2.dayLabel', params: { start: option.dayNumber } };
}
