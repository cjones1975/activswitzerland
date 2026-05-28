import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { DestinationsService } from '../../shared/services/destinations';
import { Destination } from '../../models/destination';
import { MapComponent, MapMarker } from '../../shared/map/map';
import { DestinationDetail } from '../../features/destinations/destination-detail/destination-detail';

@Component({
  selector: 'app-destinations-layout',
  standalone: true,
  imports: [MapComponent, DestinationDetail],
  templateUrl: './destinations-layout.html',
  styleUrl: './destinations-layout.css',
})
export class DestinationsLayout implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destinationsService = inject(DestinationsService);
  private destroyRef = inject(DestroyRef);

  destination = signal<Destination | null>(null);
  drawerOpen = false;
  marker = signal<MapMarker[]>([]);
  center = signal<[number, number] | undefined>(undefined);

  ngOnInit(): void {
    const lang = localStorage.getItem('app-lang') || 'en';
    this.route.params.pipe(
      switchMap(params => this.destinationsService.getDestination(params['id'], lang)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(dest => {
      this.destination.set(dest);
      if (dest.geo?.latitude && dest.geo?.longitude) {
        this.center.set([dest.geo.longitude, dest.geo.latitude]);
        this.marker.set([{ lng: dest.geo.longitude, lat: dest.geo.latitude, label: dest.name }]);
      }
      setTimeout(() => (this.drawerOpen = true), 50);
    });
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    setTimeout(() => this.router.navigate(['/destinations']), 350);
  }
}
