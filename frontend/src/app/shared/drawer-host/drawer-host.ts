import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Drawer, DrawerKey } from '../services/drawer';
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
import { Destination } from '../../models/destination';
import { WeatherPayload } from '../../models/weather';

@Component({
  selector: 'app-drawer-host',
  standalone: true,
  imports: [CommonModule, DrawerModule, TranslatePipe, MenuNav, AuthLayout, ForgotPassword, DestinationDetail, AllAttractions, AttractionDetail, Weather, TripPlanner],
  templateUrl: './drawer-host.html',
  styleUrl: './drawer-host.css',
})
export class DrawerHost {
  svc = inject(Drawer);
  private router = inject(Router);

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
    this.router.navigate(['/destinations']);
  }

  onAllAttractionsBack() {
    const dest = this.svc.getPayload<Destination>('all-attractions');
    this.svc.close('all-attractions');
    this.svc.open('destination-detail', dest);
  }

  attractionDetailBackKey = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail');
    return payload?.source === 'destination-detail'
      ? 'attractions.backToDestination'
      : 'attractions.backToAttractions';
  });

  onAttractionDetailBack() {
    const { destination } = this.svc.getPayload<AttractionDetailPayload>('attraction-detail')!;
    this.svc.close('attraction-detail');
    this.svc.open('all-attractions', destination);
  }

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
