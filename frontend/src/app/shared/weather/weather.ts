import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Subject, switchMap } from 'rxjs';
import { Drawer } from '../services/drawer';
import { WeatherService } from '../services/weather';
import { ForecastViewModel, DailyForecast, WeatherPayload } from '../../models/weather';

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weather.html',
  styleUrl: './weather.css',
})
export class Weather {
  private drawerSvc = inject(Drawer);
  private weatherService = inject(WeatherService);
  private destroyRef = inject(DestroyRef);

  payload = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<WeatherPayload>('weather') ?? null;
  });

  forecast = signal<ForecastViewModel | null>(null);
  loading = signal(false);
  error = signal(false);

  private fetchTrigger$ = new Subject<{ lat: number; lon: number }>();

  today = computed(() => this.forecast()?.days[0] ?? null);

  todayMaxPrecipProb = computed(() => {
    const day = this.today();
    if (!day) return 0;
    const probs = day.hourly.map(h => h.precipitationProb ?? 0);
    return Math.round(Math.max(...probs));
  });

  todayAvgWind = computed(() => {
    const day = this.today();
    if (!day) return 0;
    const speeds = day.hourly.map(h => h.windSpeedKmh ?? 0);
    return Math.round(speeds.reduce((a, b) => a + b, 0) / (speeds.length || 1));
  });

  globalTempMin = computed(() => {
    const days = this.forecast()?.days;
    if (!days?.length) return 0;
    return Math.min(...days.map(d => d.minTemp));
  });

  globalTempMax = computed(() => {
    const days = this.forecast()?.days;
    if (!days?.length) return 0;
    return Math.max(...days.map(d => d.maxTemp));
  });

  constructor() {
    this.fetchTrigger$.pipe(
      switchMap(({ lat, lon }) => {
        this.loading.set(true);
        this.error.set(false);
        return this.weatherService.getWeather(lat, lon);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (data) => {
        this.forecast.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });

    effect(() => {
      const p = this.payload();
      if (!p) { this.forecast.set(null); return; }
      untracked(() => this.fetchTrigger$.next({ lat: p.lat, lon: p.lon }));
    });
  }

  tempBarLeft(day: DailyForecast): number {
    const range = this.globalTempMax() - this.globalTempMin();
    if (range === 0) return 0;
    return ((day.minTemp - this.globalTempMin()) / range) * 100;
  }

  tempBarWidth(day: DailyForecast): number {
    const range = this.globalTempMax() - this.globalTempMin();
    if (range === 0) return 100;
    return ((day.maxTemp - day.minTemp) / range) * 100;
  }

  dayMaxPrecipProb(day: DailyForecast): number {
    if (!day.hourly.length) return 0;
    return Math.round(Math.max(...day.hourly.map(h => h.precipitationProb ?? 0)));
  }

  dayAvgWind(day: DailyForecast): number {
    if (!day.hourly.length) return 0;
    const speeds = day.hourly.map(h => h.windSpeedKmh ?? 0);
    return Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length);
  }

  formatDayName(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en', { weekday: 'short' });
  }

  formatFullDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  formatDaylight(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }

  isToday(day: DailyForecast): boolean {
    return day === this.today();
  }
}
