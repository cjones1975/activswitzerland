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
import { MapComponent } from '../../../shared/map/map';
import { ElevationChart } from '../../../shared/elevation-chart/elevation-chart';
import { TrailRoute, trailCategoryColor } from '../../../models/trail-route';
import { GeoLocation } from '../../../models/geo-point';
import { ElevationProfile } from '../../../models/elevation-profile';

export interface HikeDetailPayload {
  route: TrailRoute;
  destination: GeoLocation;
  mode?: 'view' | 'select';
  stopId?: string;
  source?: 'trip-summary';
}

@Component({
  selector: 'app-hike-detail',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, MapComponent, ElevationChart, SkeletonModule, Message],
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

  // Route line + color for the small embedded map, mirroring destinations-layout.ts's
  // trailRoute/trailColor computeds for the full-page map's own selected-route line.
  trailLines = computed<[number, number][][]>(() => {
    const stages = this.payload()?.route.stages ?? [];
    return stages.flatMap(s => s.geometryWgs84?.coordinates ?? []);
  });

  trailColor = computed(() => trailCategoryColor(this.payload()?.route.category ?? 'local'));

  fitBoundsCoords = computed<[number, number][]>(() => this.trailLines().flat());

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
