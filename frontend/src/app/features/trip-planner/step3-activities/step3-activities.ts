import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Drawer, DrawerKey } from '../../../shared/services/drawer';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { ActivityKind, TripStop, TripActivitySelection } from '../../../models/trip';
import { GeoPoint } from '../../../models/geo-point';
import { stopDayRanges } from '../../../shared/utils/date-range';

interface ActivityCategory {
  kind: ActivityKind;
  icon: string;
  labelKey: string;
  drawerKey: DrawerKey;
}

const CATEGORIES: ActivityCategory[] = [
  { kind: 'attraction', icon: '/assets/attraction.png', labelKey: 'trip.planner.step3.placesToVisit', drawerKey: 'all-attractions' },
  { kind: 'hike', icon: '/assets/hike.png', labelKey: 'trip.planner.step3.hikingTrails', drawerKey: 'hikes' },
  { kind: 'bike', icon: '/assets/bike.png', labelKey: 'trip.planner.step3.bikingTrails', drawerKey: 'bikes' },
];

@Component({
  selector: 'app-step3-activities',
  standalone: true,
  imports: [CommonModule, TranslatePipe, Button],
  templateUrl: './step3-activities.html',
  styleUrl: './step3-activities.css',
})
export class Step3Activities {
  private drawerSvc = inject(Drawer);
  plannerSvc = inject(TripPlannerService);

  private readonly trip = toSignal(this.plannerSvc.trip$, { initialValue: this.plannerSvc.snapshot });

  readonly categories = CATEGORIES;

  readonly visibleStops = computed(() => this.trip().stops.filter(s => s.days > 0));
  readonly stopDayLabels = computed(() => stopDayRanges(this.trip().stops));

  activitiesFor(stop: TripStop, kind: ActivityKind): TripActivitySelection[] {
    this.trip();
    return this.plannerSvc.getActivitiesForStop(stop.id).filter(a => a.kind === kind);
  }

  allActivitiesFor(stop: TripStop): TripActivitySelection[] {
    this.trip();
    return this.plannerSvc.getActivitiesForStop(stop.id);
  }

  categoryFor(kind: ActivityKind): ActivityCategory | undefined {
    return this.categories.find(c => c.kind === kind);
  }

  openPicker(stop: TripStop, category: ActivityCategory): void {
    const point: GeoPoint = { id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon };
    this.drawerSvc.open(category.drawerKey, { destination: point, mode: 'select', stopId: stop.id });
  }

  openHotels(stop: TripStop): void {
    const point: GeoPoint = { id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon };
    this.drawerSvc.open('hotels', { destination: point, mode: 'select', stopId: stop.id });
  }

  removeActivity(activity: TripActivitySelection): void {
    this.plannerSvc.removeActivity(activity.id);
  }

  back(): void {
    this.plannerSvc.prevStep();
  }

  continue(): void {
    this.plannerSvc.nextStep();
  }
}
