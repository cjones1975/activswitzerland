import { Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { DestinationsService } from '../../shared/services/destinations';
import { Destination } from '../../models/destination';
import { MapComponent, MapMarker } from '../../shared/map/map';
import { Drawer } from '../../shared/services/drawer';

@Component({
  selector: 'app-destinations-layout',
  standalone: true,
  imports: [MapComponent, TranslatePipe],
  templateUrl: './destinations-layout.html',
  styleUrl: './destinations-layout.css',
})
export class DestinationsLayout implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private destinationsService = inject(DestinationsService);
  protected drawer = inject(Drawer);
  private destroyRef = inject(DestroyRef);

  marker = signal<MapMarker[]>([]);
  center = signal<[number, number] | undefined>(undefined);
  destination = signal<Destination | null>(null);

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
      setTimeout(() => this.drawer.open('destination-detail', dest), 100);
    });
  }

  openDetail(): void {
    const dest = this.destination();
    if (dest) this.drawer.open('destination-detail', dest);
  }

  ngOnDestroy(): void {
    this.drawer.close('destination-detail');
  }
}
