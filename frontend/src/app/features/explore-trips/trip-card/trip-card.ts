import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';
import { MapComponent, MapMarker } from '../../../shared/map/map';
import { Auth } from '../../../core/services/auth';
import { Drawer } from '../../../shared/services/drawer';
import { ExploreTripsService } from '../../../shared/services/explore-trips';
import { LangService } from '../../../shared/services/lang';
import { PublicTrip } from '../../../models/trip';
import { tripDayCount, formatDdMmYyyy } from '../../../shared/utils/date-range';
import { formatDistance } from '../../../shared/utils/distance';
import { localizedName, localizedReview } from '../../../shared/utils/localized-text';
import { TripTimeline } from '../trip-timeline/trip-timeline';
import { ACTIVITY_GROUPS } from '../../trip-planner/step4-summary/step4-summary';

@Component({
  selector: 'app-trip-card',
  standalone: true,
  imports: [TranslatePipe, Tag, MapComponent, TripTimeline],
  templateUrl: './trip-card.html',
  styleUrl: './trip-card.css',
})
export class TripCard implements OnInit {
  @Input({ required: true }) trip!: PublicTrip;

  private auth = inject(Auth);
  private drawerSvc = inject(Drawer);
  private tripsSvc = inject(ExploreTripsService);
  protected langSvc = inject(LangService);

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

  // No click event on activities per the brief — MapComponent already supports non-clickable
  // markers. Icons match the same attraction/hike/bike image set used everywhere else in the app
  // (see trip-planner-layout.ts's ACTIVITY_MARKER_STYLE for the on-map convention this mirrors,
  // and step4-summary.ts's ACTIVITY_GROUPS for the identical icon assets reused here).
  readonly activityMarkers = computed<MapMarker[]>(() =>
    this.trip.activities
      .filter(a => a.lat != null && a.lon != null)
      .map(a => ({
        lng: a.lon!, lat: a.lat!, id: a.id, clickable: false,
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
}
