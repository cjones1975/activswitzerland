import { Component, DestroyRef, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectButton } from 'primeng/selectbutton';
import { Message } from 'primeng/message';
import { LangService } from '../../../shared/services/lang';
import { Drawer } from '../../../shared/services/drawer';
import { TrailRoutesService } from '../../../shared/services/trail-routes';
import { BikeMarkersService, TrailCategoryFilter } from '../../../shared/services/bike-markers';
import { TrailThumbnail } from '../../../shared/trail-thumbnail/trail-thumbnail';
import { TrailRoute } from '../../../models/trail-route';
import { Destination } from '../../../models/destination';
import { BikeDetailPayload } from '../bike-detail/bike-detail';

@Component({
  selector: 'app-bikes-list',
  standalone: true,
  imports: [DecimalPipe, FormsModule, SkeletonModule, SelectButton, Message, TranslatePipe, TrailThumbnail],
  templateUrl: './bikes-list.html',
  styleUrl: './bikes-list.css',
})
export class BikesList implements OnDestroy {
  private drawerSvc = inject(Drawer);
  private trailRoutesService = inject(TrailRoutesService);
  // Protected: filter state (radiusKm/selectedCategory) lives on this service,
  // not this component, so it survives the drawer destroying/recreating this
  // component on open/close — see bike-markers.ts for why.
  protected bikeMarkers = inject(BikeMarkersService);
  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  private destroyRef = inject(DestroyRef);

  destination = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<Destination>('bikes') ?? null;
  });

  radiusOptions = [5, 10, 20, 30];

  categoryOptions: { label: string; value: TrailCategoryFilter }[] = [
    { label: 'bikes.category.all', value: 'all' },
    { label: 'bikes.category.national', value: 'national' },
    { label: 'bikes.category.regional', value: 'regional' },
    { label: 'bikes.category.local', value: 'local' },
  ];

  routes = signal<TrailRoute[]>([]);
  filteredRoutes = computed(() => {
    const category = this.bikeMarkers.selectedCategory();
    return category === 'all' ? this.routes() : this.routes().filter(r => r.category === category);
  });

  loading = signal(false);
  loadError = signal(false);
  skeletons = Array(6);

  constructor() {
    effect(() => {
      const dest = this.destination();
      if (!dest) return;
      untracked(() => {
        this.bikeMarkers.resetFiltersForDestination(dest);
        this.load();
      });
    });

    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.destination()) this.load();
    });
  }

  private load(): void {
    const dest = this.destination();
    if (!dest?.geo?.latitude || !dest?.geo?.longitude) return;

    this.loading.set(true);
    this.loadError.set(false);
    this.trailRoutesService.getRoutes('bike', dest.geo.latitude, dest.geo.longitude, this.langSvc.current, this.bikeMarkers.radiusKm() * 1000).subscribe({
      next: routes => {
        this.routes.set(routes);
        this.bikeMarkers.set(routes);
        this.bikeMarkers.setHasRoutes(routes.length > 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  onRadiusChange(km: number): void {
    this.bikeMarkers.radiusKm.set(km);
    this.load();
  }

  onRouteClick(route: TrailRoute): void {
    const dest = this.destination();
    if (!dest) return;
    this.bikeMarkers.setSelected(`bike-${route.routeNumber}`);
    const payload: BikeDetailPayload = { route, destination: dest };
    this.drawerSvc.open('bike-detail', payload);
    // Only the detail drawer needs collapsing to reveal the map now — no need
    // to also collapse this list underneath it.
    this.drawerSvc.collapse('bikes');
  }

  ngOnDestroy(): void {
    this.bikeMarkers.clear();
  }
}
