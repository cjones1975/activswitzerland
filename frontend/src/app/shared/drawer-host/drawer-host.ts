import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Drawer, DrawerKey } from '../services/drawer';
import { AttractionMarkersService } from '../services/attraction-markers';
import { DrawerModule } from 'primeng/drawer';
import { TranslatePipe } from '@ngx-translate/core';

// Drawers
import { MenuNav } from '../../shell/menu-nav/menu-nav';
import { AuthLayout } from '../../features/auth/auth-layout/auth-layout';
import { ForgotPassword } from '../../features/auth/forgot-password/forgot-password';
import { DestinationDetail } from '../../features/destinations/destination-detail/destination-detail';
import { AllAttractions } from '../../features/attractions/all-attractions/all-attractions';
import { AttractionDetail, AttractionDetailPayload } from '../../features/attractions/attraction-detail/attraction-detail';
import { Weather } from '../weather/weather';
import { TripPlannerWizard } from '../../features/trip-planner/trip-planner-wizard/trip-planner-wizard';
import { HikesList } from '../../features/hikes/hikes-list/hikes-list';
import { HikeDetail, HikeDetailPayload } from '../../features/hikes/hike-detail/hike-detail';
import { BikesList } from '../../features/bikes/bikes-list/bikes-list';
import { BikeDetail, BikeDetailPayload } from '../../features/bikes/bike-detail/bike-detail';
import { HotelsStub } from '../../features/hotels/hotels-stub/hotels-stub';
import { ActivityPickerPayload } from '../../models/geo-point';
import { WeatherPayload } from '../../models/weather';

@Component({
  selector: 'app-drawer-host',
  standalone: true,
  imports: [CommonModule, DrawerModule, TranslatePipe, MenuNav, AuthLayout, ForgotPassword, DestinationDetail, AllAttractions, AttractionDetail, Weather, TripPlannerWizard, HikesList, HikeDetail, BikesList, BikeDetail, HotelsStub],
  templateUrl: './drawer-host.html',
  styleUrl: './drawer-host.css',
})
export class DrawerHost {
  svc = inject(Drawer);
  private router = inject(Router);
  private attractionMarkers = inject(AttractionMarkersService);

  onVisibleChange(key: DrawerKey, visible: boolean) {
    visible ? this.svc.open(key) : this.svc.close(key);
  }

  onDrawerClose(key: DrawerKey) {
    this.svc.close(key);
  }

  onCollapse(key: DrawerKey) {
    this.svc.collapse(key);
  }

  onDestinationBack() {
    this.svc.close('destination-detail');
    const category = this.router.parseUrl(this.router.url).queryParams['category'];
    this.router.navigate(['/destinations'], category ? { queryParams: { category } } : {});
  }

  onAllAttractionsBack() {
    const payload = this.svc.getPayload<ActivityPickerPayload>('all-attractions');
    if (payload?.mode === 'select') {
      this.svc.close('all-attractions');
      this.svc.open('trip-planner');
    } else {
      this.svc.collapse('all-attractions');
      if (payload?.origin === 'destination-detail') {
        this.svc.open('destination-detail', payload.destination);
      }
    }
    this.attractionMarkers.setSelected(null);
  }

  allAttractionsDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('all-attractions')?.destination?.name ?? '';
  });

  // Trip-planner picker flow (opened in 'select' mode, or reached from a
  // trip-summary map marker) shows no "show on map" affordance — the map
  // behind the trip-planner drawer is a different view than the destination map.
  isAllAttractionsTripPlanner = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('all-attractions')?.mode === 'select';
  });

  attractionDetailSource = computed(() => {
    this.svc.list();
    return this.svc.getPayload<AttractionDetailPayload>('attraction-detail')?.source;
  });

  isAttractionDetailTripPlanner = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail');
    return payload?.mode === 'select' || payload?.source === 'trip-summary';
  });

  onAttractionDetailBack() {
    const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail')!;
    this.svc.close('attraction-detail');
    if (payload.source === 'destination-detail') {
      this.svc.open('destination-detail', payload.destination);
      return;
    }
    if (payload.source === 'trip-summary') {
      this.svc.open('trip-planner');
      return;
    }
    if (payload.source === 'map') {
      return;
    }
    this.svc.open('all-attractions', { destination: payload.destination, mode: payload.mode, stopId: payload.stopId, origin: payload.listOrigin });
  }

  attractionDetailDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<AttractionDetailPayload>('attraction-detail')?.destination?.name ?? '';
  });

  weatherLocationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<WeatherPayload>('weather')?.locationName ?? '';
  });

  onWeatherBack() {
    const payload = this.svc.getPayload<WeatherPayload>('weather');
    this.svc.close('weather');
    if (payload?.destination) {
      this.svc.open('destination-detail', payload.destination);
    }
  }

  onHikesBack() {
    const payload = this.svc.getPayload<ActivityPickerPayload>('hikes');
    this.svc.close('hikes');
    if (payload?.mode === 'select') {
      this.svc.open('trip-planner');
    } else {
      this.svc.open('destination-detail', payload?.destination);
    }
  }

  hikesDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('hikes')?.destination?.name ?? '';
  });

  isHikesTripPlanner = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('hikes')?.mode === 'select';
  });

  isHikeDetailTripPlanner = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<HikeDetailPayload>('hike-detail');
    return payload?.mode === 'select' || payload?.source === 'trip-summary';
  });

  onHikeDetailBack() {
    const payload = this.svc.getPayload<HikeDetailPayload>('hike-detail')!;
    this.svc.close('hike-detail');
    if (payload.source === 'trip-summary') {
      this.svc.open('trip-planner');
      return;
    }
    this.svc.open('hikes', { destination: payload.destination, mode: payload.mode, stopId: payload.stopId });
  }

  onBikesBack() {
    const payload = this.svc.getPayload<ActivityPickerPayload>('bikes');
    this.svc.close('bikes');
    if (payload?.mode === 'select') {
      this.svc.open('trip-planner');
    } else {
      this.svc.open('destination-detail', payload?.destination);
    }
  }

  bikesDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('bikes')?.destination?.name ?? '';
  });

  isBikesTripPlanner = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('bikes')?.mode === 'select';
  });

  isBikeDetailTripPlanner = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<BikeDetailPayload>('bike-detail');
    return payload?.mode === 'select' || payload?.source === 'trip-summary';
  });

  onBikeDetailBack() {
    const payload = this.svc.getPayload<BikeDetailPayload>('bike-detail')!;
    this.svc.close('bike-detail');
    if (payload.source === 'trip-summary') {
      this.svc.open('trip-planner');
      return;
    }
    this.svc.open('bikes', { destination: payload.destination, mode: payload.mode, stopId: payload.stopId });
  }

  onHotelsBack() {
    const payload = this.svc.getPayload<ActivityPickerPayload>('hotels');
    this.svc.close('hotels');
    if (payload?.mode === 'select') {
      this.svc.open('trip-planner');
    } else {
      this.svc.open('destination-detail', payload?.destination);
    }
  }

  hotelsDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('hotels')?.destination?.name ?? '';
  });
}
