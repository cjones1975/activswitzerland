import { Component, DestroyRef, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { Message } from 'primeng/message';
import { Subject, switchMap, catchError, of } from 'rxjs';
import { Drawer } from '../../../shared/services/drawer';
import { TrailRoutesService } from '../../../shared/services/trail-routes';
import { BikeMarkersService } from '../../../shared/services/bike-markers';
import { TrailThumbnail } from '../../../shared/trail-thumbnail/trail-thumbnail';
import { ElevationChart } from '../../../shared/elevation-chart/elevation-chart';
import { TrailRoute } from '../../../models/trail-route';
import { GeoLocation } from '../../../models/geo-point';
import { ElevationProfile } from '../../../models/elevation-profile';

export interface BikeDetailPayload {
  route: TrailRoute;
  destination: GeoLocation;
  mode?: 'view' | 'select';
  stopId?: string;
}

@Component({
  selector: 'app-bike-detail',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, TrailThumbnail, ElevationChart, SkeletonModule, Message],
  templateUrl: './bike-detail.html',
  styleUrl: './bike-detail.css',
})
export class BikeDetail implements OnDestroy {
  private drawerSvc = inject(Drawer);
  private trailRoutesService = inject(TrailRoutesService);
  private bikeMarkers = inject(BikeMarkersService);
  private destroyRef = inject(DestroyRef);

  payload = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<BikeDetailPayload>('bike-detail') ?? null;
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
        return this.trailRoutesService.getElevationProfile('bike', route).pipe(
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
    this.trailRoutesService.downloadGpx('bike', route).subscribe({
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
    this.bikeMarkers.setSelected(null);
  }
}
