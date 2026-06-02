import { Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { startWith, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DestinationsService } from '../../shared/services/destinations';
import { Destination } from '../../models/destination';
import { MapComponent } from '../../shared/map/map';
import { Drawer } from '../../shared/services/drawer';
import { AttractionMarkersService } from '../../shared/services/attraction-markers';

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
  private translate = inject(TranslateService);
  protected drawer = inject(Drawer);
  private destroyRef = inject(DestroyRef);
  private attractionMarkers = inject(AttractionMarkersService);

  center = signal<[number, number] | undefined>(undefined);
  destination = signal<Destination | null>(null);
  allMarkers = this.attractionMarkers.markers;

  private openDetailTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.route.params.pipe(
      switchMap(params =>
        this.translate.onLangChange.pipe(
          startWith({ lang: localStorage.getItem('app-lang') || 'en' }),
          switchMap(({ lang }) => this.destinationsService.getDestination(params['id'], lang)),
        )
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(dest => {
      this.destination.set(dest);
      if (dest.geo?.latitude && dest.geo?.longitude) {
        this.center.set([dest.geo.longitude, dest.geo.latitude]);
      }
      clearTimeout(this.openDetailTimer);
      this.openDetailTimer = setTimeout(() => this.drawer.open('destination-detail', dest), 100);
    });
  }

  openDetail(): void {
    const dest = this.destination();
    if (dest) this.drawer.open('destination-detail', dest);
  }

  reopenAllAttractions(): void {
    this.drawer.open('all-attractions');
  }

ngOnDestroy(): void {
    clearTimeout(this.openDetailTimer);
    this.drawer.close('destination-detail');
    this.attractionMarkers.clear();
  }
}
