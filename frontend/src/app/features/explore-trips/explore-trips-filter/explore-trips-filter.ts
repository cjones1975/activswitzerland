import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SelectButton } from 'primeng/selectbutton';
import { Slider } from 'primeng/slider';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Button } from 'primeng/button';
import { Drawer } from '../../../shared/services/drawer';

export interface ExploreTripsFilters {
  type: 'all' | 'road' | 'rail';
  order: 'desc' | 'asc';
  sortByLikes: boolean;
  minDistance: number;
  maxDistance: number;
}

// Stable references (not recreated per call) — ExploreTrips reads this through a `computed()`
// that Angular only re-notifies on actual value/reference change, so identical filter state
// (e.g. Reset clicked twice, or an unrelated drawer opening/closing elsewhere in the app) must
// resolve to the *same* object to avoid spuriously re-triggering a refetch there.
export const DEFAULT_EXPLORE_TRIPS_FILTERS: ExploreTripsFilters = {
  type: 'all',
  order: 'desc',
  sortByLikes: false,
  minDistance: 0,
  maxDistance: 1000,
};

const DRAWER_KEY = 'explore-trips-filter';

@Component({
  selector: 'app-explore-trips-filter',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SelectButton, Slider, ToggleSwitch, Button],
  templateUrl: './explore-trips-filter.html',
  styleUrl: './explore-trips-filter.css',
})
export class ExploreTripsFilter implements OnInit {
  private drawerSvc = inject(Drawer);

  readonly typeOptions: ExploreTripsFilters['type'][] = ['all', 'road', 'rail'];
  readonly orderOptions: ExploreTripsFilters['order'][] = ['desc', 'asc'];

  type = signal<ExploreTripsFilters['type']>(DEFAULT_EXPLORE_TRIPS_FILTERS.type);
  order = signal<ExploreTripsFilters['order']>(DEFAULT_EXPLORE_TRIPS_FILTERS.order);
  sortByLikes = signal(DEFAULT_EXPLORE_TRIPS_FILTERS.sortByLikes);
  distanceRange = signal<[number, number]>([DEFAULT_EXPLORE_TRIPS_FILTERS.minDistance, DEFAULT_EXPLORE_TRIPS_FILTERS.maxDistance]);

  // Seeded from whatever ExploreTrips currently has applied (passed in as the drawer's open
  // payload) rather than always resetting to defaults, so reopening the filter sheet shows the
  // traveler's last choices.
  ngOnInit(): void {
    const current = this.drawerSvc.getPayload<ExploreTripsFilters>(DRAWER_KEY) ?? DEFAULT_EXPLORE_TRIPS_FILTERS;
    this.type.set(current.type);
    this.order.set(current.order);
    this.sortByLikes.set(current.sortByLikes);
    this.distanceRange.set([current.minDistance, current.maxDistance]);
  }

  apply(): void {
    const [minDistance, maxDistance] = this.distanceRange();
    const filters: ExploreTripsFilters = {
      type: this.type(),
      order: this.order(),
      sortByLikes: this.sortByLikes(),
      minDistance,
      maxDistance,
    };
    this.drawerSvc.setPayload(DRAWER_KEY, filters);
    this.drawerSvc.closePreservingPayload(DRAWER_KEY);
  }

  resetFilters(): void {
    this.drawerSvc.setPayload(DRAWER_KEY, DEFAULT_EXPLORE_TRIPS_FILTERS);
    this.drawerSvc.closePreservingPayload(DRAWER_KEY);
  }
}
