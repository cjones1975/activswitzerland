import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';
import { MapComponent, MapMarker } from '../../../shared/map/map';
import { RouteThumbnail } from '../../../shared/route-thumbnail/route-thumbnail';
import { Auth } from '../../../core/services/auth';
import { AttractionsService } from '../../../shared/services/attractions';
import { Drawer } from '../../../shared/services/drawer';
import { ExploreMapMask } from '../../../shared/services/explore-map-mask';
import { ExploreTripsService } from '../../../shared/services/explore-trips';
import { LangService } from '../../../shared/services/lang';
import { TrailRoutesService } from '../../../shared/services/trail-routes';
import { GeoPoint } from '../../../models/geo-point';
import { PublicTrip } from '../../../models/trip';
import { tripDayCount, formatDdMmYyyy } from '../../../shared/utils/date-range';
import { formatDistance } from '../../../shared/utils/distance';
import { localizedName, localizedReview } from '../../../shared/utils/localized-text';
import { TripTimeline } from '../trip-timeline/trip-timeline';
import { ACTIVITY_GROUPS } from '../../trip-planner/step4-summary/step4-summary';
import { AttractionDetailPayload } from '../../attractions/attraction-detail/attraction-detail';
import { HikeDetailPayload } from '../../hikes/hike-detail/hike-detail';
import { BikeDetailPayload } from '../../bikes/bike-detail/bike-detail';

@Component({
  selector: 'app-trip-card',
  standalone: true,
  imports: [TranslatePipe, Tag, MapComponent, RouteThumbnail, TripTimeline],
  templateUrl: './trip-card.html',
  styleUrl: './trip-card.css',
})
export class TripCard implements OnInit {
  @Input({ required: true }) trip!: PublicTrip;

  private auth = inject(Auth);
  private attractionsService = inject(AttractionsService);
  private drawerSvc = inject(Drawer);
  private tripsSvc = inject(ExploreTripsService);
  private trailRoutesService = inject(TrailRoutesService);
  protected langSvc = inject(LangService);
  protected mapMaskSvc = inject(ExploreMapMask);

  readonly formatDistance = formatDistance;
  readonly localizedName = localizedName;
  readonly localizedReview = localizedReview;

  flipped = signal(false);
  reviewOpen = signal(true);
  reviewMaskOpen = signal(false);
  readonly reviewPreviewLimit = 300;

  // Seeded from the input once (the trip list only ever grows via append, never replaces an
  // already-rendered card's data — see explore-trips.ts's loadMore), then updated locally after
  // a successful like toggle for immediate feedback.
  likeCount = signal(0);
  likedByMe = signal(false);

  readonly dayCount = computed(() => tripDayCount(this.trip.range));
  readonly formattedDateRange = computed(() => {
    const { startDate, endDate } = this.trip.range;
    return this.trip.dateMode === 'dates' && startDate && endDate
      ? `${formatDdMmYyyy(startDate)} — ${formatDdMmYyyy(endDate)}`
      : null;
  });

  // Feeds both the static thumbnail (icons only, not interactive there — see RouteThumbnail) and
  // the real map inside the "View map" mask, where markers ARE clickable: `label` (shown as a
  // popup) + `clickable: true` (adds the popup's arrow button, see map.ts's addMarker) together
  // make MapComponent emit `markerClick` on tap, same mechanism trip-planner-layout.ts's
  // onActivityMarkerClick already relies on. Icons match the same attraction/hike/bike image set
  // used everywhere else in the app (see trip-planner-layout.ts's ACTIVITY_MARKER_STYLE for the
  // on-map convention this mirrors, and step4-summary.ts's ACTIVITY_GROUPS for the identical icon
  // assets reused here).
  readonly activityMarkers = computed<MapMarker[]>(() =>
    this.trip.activities
      .filter(a => a.lat != null && a.lon != null)
      .map(a => ({
        lng: a.lon!, lat: a.lat!, id: a.id, clickable: true, label: a.name,
        image: ACTIVITY_GROUPS.find(g => g.kind === a.kind)!.icon,
      })),
  );

  // Every stop, numbered — same convention MapComponent already applies elsewhere in the app
  // (Step 4 summary, trip planner) rather than just start/end.
  readonly stopPoints = computed<[number, number][]>(() =>
    this.trip.stops.map(s => [s.lon, s.lat]),
  );

  ngOnInit(): void {
    this.likeCount.set(this.trip.likeCount);
    this.likedByMe.set(this.trip.likedByMe);
  }

  toggleFlip(): void {
    this.flipped.set(!this.flipped());
  }

  toggleReview(): void {
    this.reviewOpen.set(!this.reviewOpen());
  }

  reviewIsLong(): boolean {
    return this.localizedReview(this.trip, this.langSvc.current).length > this.reviewPreviewLimit;
  }

  reviewPreview(): string {
    const text = this.localizedReview(this.trip, this.langSvc.current);
    return text.length > this.reviewPreviewLimit ? text.slice(0, this.reviewPreviewLimit).trimEnd() + '…' : text;
  }

  openReviewMask(): void {
    this.reviewMaskOpen.set(true);
  }

  closeReviewMask(): void {
    this.reviewMaskOpen.set(false);
  }

  toggleLike(): void {
    if (!this.auth.isLoggedIn()) {
      this.drawerSvc.open('auth');
      return;
    }
    this.tripsSvc.toggleLike(this.trip._id!).subscribe(({ likeCount, liked }) => {
      this.likeCount.set(likeCount);
      this.likedByMe.set(liked);
    });
  }

  // Same lookup-then-open pattern as trip-planner-layout.ts's onActivityMarkerClick, but sourced
  // as 'explore-trips' (not 'trip-summary') so the drawer's header hides the "show on map" icon —
  // there's no full map underneath this card grid to reveal — and its back button returns here
  // instead of to the trip planner. Wired to the real map inside the "View map" mask, not the
  // static thumbnail — the thumbnail stays non-interactive.
  onActivityMarkerClick(marker: MapMarker): void {
    const activity = this.trip.activities.find(a => a.id === marker.id);
    if (!activity) return;
    const stop = this.trip.stops.find(s => s.id === activity.stopId);
    if (!stop) return;
    const destination: GeoPoint = { id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon };
    const lang = this.langSvc.current;

    if (activity.kind === 'attraction') {
      this.attractionsService.getAttraction(activity.refId, lang).subscribe(attraction => {
        const payload: AttractionDetailPayload = { attraction, destination, source: 'explore-trips' };
        this.drawerSvc.open('attraction-detail', payload);
      });
      return;
    }

    const kind = activity.kind;
    const bikeType = kind === 'bike' ? (activity.bikeType ?? 'road') : undefined;
    this.trailRoutesService.getRoutes(kind, stop.lat, stop.lon, lang, undefined, bikeType).subscribe(routes => {
      const route = routes.find(r => String(r.routeNumber) === activity.refId);
      if (!route) return;
      if (kind === 'hike') {
        const payload: HikeDetailPayload = { route, destination, source: 'explore-trips' };
        this.drawerSvc.open('hike-detail', payload);
      } else {
        const payload: BikeDetailPayload = { route, destination, source: 'explore-trips' };
        this.drawerSvc.open('bike-detail', payload);
      }
    });
  }
}
