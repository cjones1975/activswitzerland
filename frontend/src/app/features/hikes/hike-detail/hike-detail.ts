import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Drawer } from '../../../shared/services/drawer';
import { TrailRoutesService } from '../../../shared/services/trail-routes';
import { HikeMarkersService } from '../../../shared/services/hike-markers';
import { TrailThumbnail } from '../../../shared/trail-thumbnail/trail-thumbnail';
import { TrailRoute } from '../../../models/trail-route';
import { Destination } from '../../../models/destination';

export interface HikeDetailPayload {
  route: TrailRoute;
  destination: Destination;
}

@Component({
  selector: 'app-hike-detail',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, TrailThumbnail],
  templateUrl: './hike-detail.html',
  styleUrl: './hike-detail.css',
})
export class HikeDetail implements OnDestroy {
  private drawerSvc = inject(Drawer);
  private trailRoutesService = inject(TrailRoutesService);
  private hikeMarkers = inject(HikeMarkersService);

  payload = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<HikeDetailPayload>('hike-detail') ?? null;
  });

  downloading = signal(false);

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
