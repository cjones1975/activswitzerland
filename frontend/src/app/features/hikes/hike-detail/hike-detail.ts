import { Component, DestroyRef, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { Message } from 'primeng/message';
import { Subject, switchMap, catchError, of } from 'rxjs';
import { Drawer } from '../../../shared/services/drawer';
import { TrailRoutesService } from '../../../shared/services/trail-routes';
import { HikeMarkersService } from '../../../shared/services/hike-markers';
import { TrailThumbnail } from '../../../shared/trail-thumbnail/trail-thumbnail';
import { ElevationChart } from '../../../shared/elevation-chart/elevation-chart';
import { TrailRoute } from '../../../models/trail-route';
import { Destination } from '../../../models/destination';
import { ElevationProfile } from '../../../models/elevation-profile';

export interface HikeDetailPayload {
  route: TrailRoute;
  destination: Destination;
}

@Component({
  selector: 'app-hike-detail',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, TrailThumbnail, ElevationChart, SkeletonModule, Message],
  templateUrl: './hike-detail.html',
  styleUrl: './hike-detail.css',
})
export class HikeDetail implements OnDestroy {
  private drawerSvc = inject(Drawer);
  private trailRoutesService = inject(TrailRoutesService);
  private hikeMarkers = inject(HikeMarkersService);
  private destroyRef = inject(DestroyRef);

  payload = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<HikeDetailPayload>('hike-detail') ?? null;
  });

  downloading = signal(false);

  elevationProfile = signal<ElevationProfile | null>(null);
  elevationLoading = signal(false);
  elevationError = signal(false);

  private elevationTrigger$ = new Subject<TrailRoute>();

  constructor() {
    this.elevationTrigger$.pipe(
      switchMap(route => {
        this.elevationLoading.set(true);
        this.elevationError.set(false);
        return this.trailRoutesService.getElevationProfile('hike', route).pipe(
          catchError(() => of(null)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(profile => {
      this.elevationLoading.set(false);
      if (!profile || profile.points.length < 2) {
        this.elevationError.set(true);
        return;
      }
      this.elevationProfile.set(profile);
    });

    effect(() => {
      const p = this.payload();
      this.elevationProfile.set(null);
      this.elevationError.set(false);
      if (!p) return;
      untracked(() => this.elevationTrigger$.next(p.route));
    });
  }

  downloadGpx(): void {
    const route = this.payload()?.route;
    if (!route) return;
    this.downloading.set(true);
    this.trailRoutesService.downloadGpx('hike', route).subscribe({
      next: blob => {
        this.downloading.set(false);
        this.triggerDownload(blob, route.name);
      },
      error: () => this.downloading.set(false),
    });
  }

  private triggerDownload(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'route'}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  ngOnDestroy(): void {
    this.hikeMarkers.setSelected(null);
  }
}
