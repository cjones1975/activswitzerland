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
import { TripPlanner } from '../../features/trip-planner/trip-planner';
import { ThingsToDo } from '../../features/trip-planner/things-to-do/things-to-do';
import { Destination } from '../../models/destination';
import { WeatherPayload } from '../../models/weather';
import { TripStop } from '../../models/trip';

@Component({
  selector: 'app-drawer-host',
  standalone: true,
  imports: [CommonModule, DrawerModule, TranslatePipe, MenuNav, AuthLayout, ForgotPassword, DestinationDetail, AllAttractions, AttractionDetail, Weather, TripPlanner, ThingsToDo],
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
    const dest = this.svc.getPayload<Destination>('all-attractions');
    this.svc.close('all-attractions');
    this.svc.open('destination-detail', dest);
    this.attractionMarkers.setSelected(null);
  }

  allAttractionsDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<Destination>('all-attractions')?.name ?? '';
  });

  attractionDetailSource = computed(() => {
    this.svc.list();
    return this.svc.getPayload<AttractionDetailPayload>('attraction-detail')?.source;
  });

  onAttractionDetailBack() {
    const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail')!;
    this.svc.close('attraction-detail');
    if (payload.source === 'things-to-do') {
      this.svc.open('things-to-do', { stop: payload.stop });
      return;
    }
    if (payload.source === 'trip-planner') {
      this.svc.open('trip-planner');
      return;
    }
    if (payload.source === 'destination-detail') {
      this.svc.open('destination-detail', payload.destination);
      return;
    }
    this.svc.open('all-attractions', payload.destination);
  }

  attractionDetailDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<AttractionDetailPayload>('attraction-detail')?.destination?.name ?? '';
  });

  thingsToDoTitle = computed(() => {
    this.svc.list();
    const stop = this.svc.getPayload<{ stop: TripStop }>('things-to-do')?.stop;
    return stop?.name ?? '';
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
}
