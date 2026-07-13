import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { GalleriaModule } from 'primeng/galleria';
import { Subject, switchMap } from 'rxjs';
import { Drawer } from '../../../shared/services/drawer';
import { WeatherService } from '../../../shared/services/weather';
import { Destination } from '../../../models/destination';
import { DailyForecast, WeatherPayload } from '../../../models/weather';
import { AttractionVerticalList } from '../../attractions/attraction-vertical-list/attraction-vertical-list';

@Component({
  selector: 'app-destination-detail',
  standalone: true,
  imports: [TranslatePipe, GalleriaModule, AttractionVerticalList],
  templateUrl: './destination-detail.html',
  styleUrl: './destination-detail.css',
})
export class DestinationDetail {
  private drawerSvc = inject(Drawer);
  private weatherService = inject(WeatherService);
  private destroyRef = inject(DestroyRef);

  destination = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<Destination>('destination-detail') ?? null;
  });

  todayWeather = signal<DailyForecast | null>(null);
  weatherLoading = signal(false);

  private weatherTrigger$ = new Subject<{ lat: number; lon: number }>();

  constructor() {
    this.weatherTrigger$.pipe(
      switchMap(({ lat, lon }) => {
        this.weatherLoading.set(true);
        return this.weatherService.getWeather(lat, lon);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (forecast) => {
        this.todayWeather.set(forecast.days[0] ?? null);
        this.weatherLoading.set(false);
      },
      error: () => this.weatherLoading.set(false),
    });

    effect(() => {
      const dest = this.destination();
      if (!dest) { this.todayWeather.set(null); return; }
      untracked(() => this.weatherTrigger$.next({
        lat: dest.geo.latitude,
        lon: dest.geo.longitude,
      }));
    });
  }

  openWeather() {
    const dest = this.destination();
    if (!dest) return;
    const payload: WeatherPayload = {
      lat: dest.geo.latitude,
      lon: dest.geo.longitude,
      locationName: dest.name,
      destination: dest,
    };
    this.drawerSvc.close('destination-detail');
    this.drawerSvc.open('weather', payload);
  }

  openHikes() {
    const dest = this.destination();
    if (!dest) return;
    this.drawerSvc.close('destination-detail');
    this.drawerSvc.open('hikes', dest);
  }

  openBikeRides() {
    const dest = this.destination();
    if (!dest) return;
    this.drawerSvc.close('destination-detail');
    this.drawerSvc.open('bikes', dest);
  }

  openHotels() {
    const dest = this.destination();
    if (!dest) return;
    this.drawerSvc.close('destination-detail');
    this.drawerSvc.open('hotels', dest);
  }
}
