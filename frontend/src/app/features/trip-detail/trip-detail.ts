import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, startWith, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';
import { MapComponent, MapMarker } from '../../shared/map/map';
import { LangService } from '../../shared/services/lang';
import { SeoService } from '../../shared/services/seo';
import { ExploreTripsService } from '../../shared/services/explore-trips';
import { PublicTrip } from '../../models/trip';
import { tripDayCount, formatDdMmYyyy } from '../../shared/utils/date-range';
import { formatDistance } from '../../shared/utils/distance';
import { TripTimeline } from '../explore-trips/trip-timeline/trip-timeline';
import { ACTIVITY_GROUPS } from '../trip-planner/step4-summary/step4-summary';

// Standalone SSR landing page for one public trip, reached via its immutable slug —
// see context/features/trip-detail-pages-spec.md. Reuses trip-card's front-face data
// (map, header, stats) and trip-timeline as-is; no flip/like interaction, which only
// make sense in the /explore-trips grid-browsing context this page is separate from.
@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [TranslatePipe, RouterLink, Tag, MapComponent, TripTimeline],
  templateUrl: './trip-detail.html',
  styleUrl: './trip-detail.css',
})
export class TripDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private tripsSvc = inject(ExploreTripsService);
  private translate = inject(TranslateService);
  protected langSvc = inject(LangService);
  private seo = inject(SeoService);
  private destroyRef = inject(DestroyRef);

  readonly formatDistance = formatDistance;

  trip = signal<PublicTrip | null>(null);
  notFound = signal(false);

  readonly dayCount = computed(() => {
    const trip = this.trip();
    return trip ? tripDayCount(trip.range) : null;
  });

  readonly formattedDateRange = computed(() => {
    const trip = this.trip();
    if (!trip) return null;
    const { startDate, endDate } = trip.range;
    return trip.dateMode === 'dates' && startDate && endDate
      ? `${formatDdMmYyyy(startDate)} — ${formatDdMmYyyy(endDate)}`
      : null;
  });

  // Same non-clickable marker convention trip-card's front face already uses.
  readonly activityMarkers = computed<MapMarker[]>(() => {
    const trip = this.trip();
    if (!trip) return [];
    return trip.activities
      .filter(a => a.lat != null && a.lon != null)
      .map(a => ({
        lng: a.lon!, lat: a.lat!, id: a.id, clickable: false,
        image: ACTIVITY_GROUPS.find(g => g.kind === a.kind)!.icon,
      }));
  });

  readonly stopPoints = computed<[number, number][]>(() => {
    const trip = this.trip();
    return trip ? trip.stops.map(s => [s.lon, s.lat]) : [];
  });

  ngOnInit(): void {
    this.route.params.pipe(
      switchMap(params => this.translate.onLangChange.pipe(
        startWith({ lang: this.langSvc.current }),
        switchMap(() => this.tripsSvc.getTripBySlug(params['slug']).pipe(
          // Caught here, not left to subscribe's error callback — an uncaught error there
          // would tear down the whole subscription, silently breaking future param/lang
          // changes (same reasoning as destinations-layout.ts's identical pattern).
          catchError(() => {
            this.trip.set(null);
            this.notFound.set(true);
            this.seo.set({
              title: this.translate.instant('tripDetail.notFoundTitle'),
              description: this.translate.instant('tripDetail.notFoundTitle'),
              noindex: true,
            });
            this.seo.setStructuredData(null);
            return of(null);
          }),
        )),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(trip => {
      if (!trip) return;
      this.notFound.set(false);
      this.trip.set(trip);
      const description = this.buildDescription(trip);
      const name = trip.name ?? ''; // always present on a saved/published trip; `name` is only optional pre-save
      this.seo.set({ title: name, description });
      this.seo.setStructuredData({
        '@context': 'https://schema.org',
        '@type': 'TouristTrip',
        name,
        description,
        url: this.seo.currentUrl(),
        itinerary: trip.stops.map(s => ({
          '@type': 'Place',
          name: s.name,
          geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lon },
        })),
      });
    });
  }

  private buildDescription(trip: PublicTrip): string {
    if (trip.review?.trim()) return trip.review.trim().slice(0, 160);
    const stopNames = trip.stops.map(s => s.name).join(', ');
    const days = this.dayCount();
    return days
      ? this.translate.instant('tripDetail.descriptionWithDuration', { count: days, stops: stopNames })
      : this.translate.instant('tripDetail.descriptionNoDuration', { stops: stopNames });
  }
}
