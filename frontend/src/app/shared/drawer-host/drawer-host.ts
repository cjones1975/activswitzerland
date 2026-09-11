import { Component, computed, effect, inject, signal } from '@angular/core';
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
import { TripPlannerService } from '../services/trip-planner';
import { ConnectionsDrawer } from '../../features/trip-planner/connections-drawer/connections-drawer';
import { HikesList } from '../../features/hikes/hikes-list/hikes-list';
import { HikeDetail } from '../../features/hikes/hike-detail/hike-detail';
import type { HikeDetailPayload } from '../../features/hikes/hike-detail/hike-detail';
import { BikesList } from '../../features/bikes/bikes-list/bikes-list';
import { BikeDetail } from '../../features/bikes/bike-detail/bike-detail';
import type { BikeDetailPayload } from '../../features/bikes/bike-detail/bike-detail';
import { HotelSearch } from '../../features/hotels/hotel-search/hotel-search';
import { ExploreTripsFilter } from '../../features/explore-trips/explore-trips-filter/explore-trips-filter';
import { AiChatDrawer } from '../../features/ai-chat/ai-chat-drawer/ai-chat-drawer';
import { AiChat } from '../services/ai-chat';
import { ActivityMapMaskOverlay } from '../activity-map-mask/activity-map-mask';
import { ActivityMapMask } from '../services/activity-map-mask';
import { MapMarker } from '../map/map';
import { ActivityPickerPayload } from '../../models/geo-point';
import { WeatherPayload } from '../../models/weather';
import { LangService } from '../services/lang';
import { Breakpoint } from '../services/breakpoint';

@Component({
  selector: 'app-drawer-host',
  standalone: true,
  imports: [CommonModule, DrawerModule, TranslatePipe, MenuNav, AuthLayout, ForgotPassword, DestinationDetail, AllAttractions, AttractionDetail, Weather, ConnectionsDrawer, HikesList, HikeDetail, BikesList, BikeDetail, HotelSearch, ExploreTripsFilter, AiChatDrawer, ActivityMapMaskOverlay],
  templateUrl: './drawer-host.html',
  styleUrl: './drawer-host.css',
})
export class DrawerHost {
  svc = inject(Drawer);
  protected breakpoint = inject(Breakpoint);
  private router = inject(Router);
  private langSvc = inject(LangService);
  private attractionMarkers = inject(AttractionMarkersService);
  private tripPlanner = inject(TripPlannerService);
  private aiChat = inject(AiChat);
  private activityMapMask = inject(ActivityMapMask);

  onVisibleChange(key: DrawerKey, visible: boolean) {
    visible ? this.svc.open(key) : this.svc.close(key);
  }

  onDrawerClose(key: DrawerKey) {
    this.svc.close(key);
    // Next drawer (of any kind) should always start at the default sheet height, not inherit
    // whatever expansion state the previous one was left in.
    this.sheetExpanded.set(false);
  }

  // Mobile bottom sheet (context/features/mobile-drawer-bottom-sheet-spec.md): the up/down caret
  // toggles between the default 75vh height and the full window height. One shared signal, not one
  // per drawer — these seven are mutually exclusive (only one is ever open at a time), matching the
  // same assumption destinations-layout.ts's sidebarDocked/showXMarkers computeds already rely on.
  sheetExpanded = signal(false);

  toggleSheetExpanded(): void {
    this.sheetExpanded.update(v => !v);
  }

  onClearAiChat() {
    this.aiChat.reset();
  }

  onCollapse(key: DrawerKey) {
    this.svc.collapse(key);
  }

  onDestinationBack() {
    this.svc.close('destination-detail');
    // Opened from the AI chat drawer, which can be sitting on any page (not just /search or
    // /destinations) — it's still in the drawer stack underneath, so just reveal it rather than
    // navigating away from wherever the user actually is.
    if (this.svc.isOpen('ai-chat')) {
      return;
    }
    const queryParams = this.router.parseUrl(this.router.url).queryParams;
    if (queryParams['from'] === 'search') {
      this.langSvc.navigate(['search'], { queryParams: { q: queryParams['q'], tab: queryParams['tab'] } });
      return;
    }
    const category = queryParams['category'];
    this.langSvc.navigate(['destinations'], category ? { queryParams: { category } } : {});
  }

  onAllAttractionsBack() {
    const payload = this.svc.getPayload<ActivityPickerPayload>('all-attractions');
    if (payload?.mode === 'select') {
      this.svc.close('all-attractions');
      this.tripPlanner.showWizard();
    } else {
      // Mobile bottom sheet no longer calls this method at all — its X is a plain onDrawerClose()
      // (see drawer-host.html). This chevron-only path only ever runs at tablet width now, where
      // collapse-and-preserve is still the right behavior, unchanged.
      this.svc.collapse('all-attractions');
      if (payload?.origin === 'destination-detail') {
        this.svc.open('destination-detail', payload.destination);
      } else if (payload?.origin === 'ai-chat') {
        this.svc.open('ai-chat');
      }
    }
    this.attractionMarkers.setSelected(null);
  }

  allAttractionsDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('all-attractions')?.destination?.name ?? '';
  });

  // Trip-planner picker flow (opened in 'select' mode, or reached from a
  // trip-summary map marker) shows no "show on map" affordance — the wizard
  // isn't a drawer over this map, it's a different page's content entirely.
  // Same reasoning for the 'ai-chat' origin: there's no real map behind the list there either.
  isAllAttractionsTripPlanner = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<ActivityPickerPayload>('all-attractions');
    return payload?.mode === 'select' || payload?.origin === 'ai-chat';
  });

  onAllAttractionsViewOnMap(): void {
    const isTripPlanner = this.svc.getPayload<ActivityPickerPayload>('all-attractions')?.mode === 'select';
    this.activityMapMask.open({
      ...this.activityMapReturnConfig(isTripPlanner),
      onReturn: () => {}, // nothing to reopen — the list is still there, untouched, under the mask
      onMarkerClick: (marker) => this.onActivityMapMarkerClick(marker),
    });
  }

  // Shared by both the list's "view all on map" and a single attraction's "view on map" — a
  // marker tap always means "open that attraction's detail", regardless of which one opened the
  // mask. Reads mode/destination/stopId from all-attractions' own payload since that drawer stays
  // in the stack (never closed, just covered) the whole time the mask or attraction-detail is up.
  private onActivityMapMarkerClick(marker: MapMarker): void {
    const attraction = this.attractionMarkers.attractionMap().get(marker.id ?? '');
    const listPayload = this.svc.getPayload<ActivityPickerPayload>('all-attractions');
    const destination = listPayload?.destination;
    if (!attraction || !destination) return;
    this.activityMapMask.close();
    if (listPayload?.mode === 'select') {
      this.svc.open('attraction-detail', { attraction, destination, source: 'all-attractions', mode: 'select', stopId: listPayload.stopId });
    } else {
      this.svc.open('attraction-detail', { attraction, destination, source: 'all-attractions', listOrigin: 'ai-chat' });
    }
  }

  private activityMapReturnConfig(isTripPlanner: boolean): { returnIcon: string; returnLabelKey: string } {
    return isTripPlanner
      ? { returnIcon: 'fa-solid fa-route', returnLabelKey: 'activityMap.backToPlanner' }
      : { returnIcon: 'fa-solid fa-sparkles', returnLabelKey: 'aiChat.backToChat' };
  }

  attractionDetailSource = computed(() => {
    this.svc.list();
    return this.svc.getPayload<AttractionDetailPayload>('attraction-detail')?.source;
  });

  // Also covers the 'search' and 'explore-trips' sources: neither /search nor /explore-trips has a
  // map view behind it, so there's nothing for "show on map" to reveal there either.
  isAttractionDetailTripPlanner = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail');
    return payload?.mode === 'select' || payload?.listOrigin === 'ai-chat' || payload?.source === 'trip-summary' || payload?.source === 'search' || payload?.source === 'explore-trips';
  });

  // Of isAttractionDetailTripPlanner's cases, only trip-planner select mode and the ai-chat list
  // have a single real point worth showing full-screen — trip-summary/search/explore-trips are
  // left as they were (no map affordance at all) rather than extended in this pass.
  attractionDetailWantsMask = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail');
    return payload?.mode === 'select' || payload?.listOrigin === 'ai-chat';
  });

  onAttractionDetailViewOnMap(): void {
    const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail');
    const attraction = payload?.attraction;
    if (!attraction) return;
    this.activityMapMask.open({
      activeMarkerId: attraction.identifier,
      ...this.activityMapReturnConfig(payload?.mode === 'select'),
      onReturn: () => this.onAttractionDetailBack(),
      onMarkerClick: (marker) => this.onActivityMapMarkerClick(marker),
    });
  }

  onAttractionDetailBack() {
    const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail')!;
    this.svc.close('attraction-detail');
    if (payload.source === 'destination-detail') {
      this.svc.open('destination-detail', payload.destination);
      return;
    }
    if (payload.source === 'trip-summary') {
      this.tripPlanner.showWizard();
      return;
    }
    if (payload.source === 'map') {
      return;
    }
    if (payload.source === 'search') {
      this.langSvc.navigate(['search'], { queryParams: { q: payload.searchQuery, tab: payload.searchTab ?? 'things' } });
      return;
    }
    if (payload.source === 'explore-trips') {
      this.langSvc.navigate(['explore-trips']);
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
      this.tripPlanner.showWizard();
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

  // Also covers the 'search' and 'ai-chat' sources: neither /search nor the AI chat drawer has a
  // map view behind it either, same reasoning as isAttractionDetailTripPlanner above.
  isHikeDetailTripPlanner = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<HikeDetailPayload>('hike-detail');
    return payload?.mode === 'select' || payload?.source === 'trip-summary' || payload?.source === 'search' || payload?.source === 'explore-trips' || payload?.source === 'ai-chat';
  });

  hikeDetailSource = computed(() => {
    this.svc.list();
    return this.svc.getPayload<HikeDetailPayload>('hike-detail')?.source;
  });

  onHikeDetailBack() {
    const payload = this.svc.getPayload<HikeDetailPayload>('hike-detail')!;
    this.svc.close('hike-detail');
    if (payload.source === 'trip-summary') {
      this.tripPlanner.showWizard();
      return;
    }
    if (payload.source === 'search') {
      this.langSvc.navigate(['search'], { queryParams: { q: payload.searchQuery, tab: payload.searchTab } });
      return;
    }
    if (payload.source === 'explore-trips') {
      this.langSvc.navigate(['explore-trips']);
      return;
    }
    if (payload.source === 'ai-chat') {
      this.svc.open('ai-chat');
      return;
    }
    this.svc.open('hikes', { destination: payload.destination, mode: payload.mode, stopId: payload.stopId });
  }

  onBikesBack() {
    const payload = this.svc.getPayload<ActivityPickerPayload>('bikes');
    this.svc.close('bikes');
    if (payload?.mode === 'select') {
      this.tripPlanner.showWizard();
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

  // Also covers the 'search' and 'ai-chat' sources: neither /search nor the AI chat drawer has a
  // map view behind it either, same reasoning as isAttractionDetailTripPlanner above.
  isBikeDetailTripPlanner = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<BikeDetailPayload>('bike-detail');
    return payload?.mode === 'select' || payload?.source === 'trip-summary' || payload?.source === 'search' || payload?.source === 'explore-trips' || payload?.source === 'ai-chat';
  });

  bikeDetailSource = computed(() => {
    this.svc.list();
    return this.svc.getPayload<BikeDetailPayload>('bike-detail')?.source;
  });

  onBikeDetailBack() {
    const payload = this.svc.getPayload<BikeDetailPayload>('bike-detail')!;
    this.svc.close('bike-detail');
    if (payload.source === 'trip-summary') {
      this.tripPlanner.showWizard();
      return;
    }
    if (payload.source === 'search') {
      this.langSvc.navigate(['search'], { queryParams: { q: payload.searchQuery, tab: payload.searchTab } });
      return;
    }
    if (payload.source === 'explore-trips') {
      this.langSvc.navigate(['explore-trips']);
      return;
    }
    if (payload.source === 'ai-chat') {
      this.svc.open('ai-chat');
      return;
    }
    this.svc.open('bikes', { destination: payload.destination, mode: payload.mode, stopId: payload.stopId });
  }

  onHotelsBack() {
    const payload = this.svc.getPayload<ActivityPickerPayload>('hotels');
    this.svc.close('hotels');
    this.svc.open('destination-detail', payload?.destination);
  }

  hotelsDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('hotels')?.destination?.name ?? '';
  });

  // Dismissing this drawer without hitting Apply/Reset (X button, backdrop tap) must not lose
  // ExploreTrips' currently-applied filters — see Drawer.closePreservingPayload().
  onExploreTripsFilterVisibleChange(visible: boolean): void {
    if (visible) {
      this.svc.open('explore-trips-filter');
      return;
    }
    this.svc.closePreservingPayload('explore-trips-filter');
  }

  /**
   * A `[modal]` binding that only recomputes while `key`'s drawer is actually open, never during
   * its close transition. Needed because `Drawer.close()` deletes the drawer's payload in the same
   * synchronous call that hides it — a naive `[modal]="isXTripPlanner() || ..."` binding (reading
   * that payload reactively) flips to a new value in the very same change-detection cycle that sets
   * `[visible]="false"`. PrimeNG's `p-drawer` only removes its scrim mask via `hide()`'s
   * `if (this.modal) this.disableModality()` — if Angular has already pushed the new (stale-false)
   * `modal` value into the component before that animation-driven `hide()` call reads it, the mask
   * is never removed: left in the DOM, invisible, permanently blocking clicks on whatever renders
   * underneath. Found via live testing: closing a trip-planner Activities picker left the docked
   * wizard behind it unclickable. Holding the value steady while `isOpen(key)` is false sidesteps
   * the race — what it's left at during close doesn't matter, since the drawer is hiding either way.
   */
  private stickyModal(key: DrawerKey, isTripPlannerMode: () => boolean) {
    const modal = signal(true);
    effect(() => {
      if (this.svc.isOpen(key)) {
        // Non-modal at desktop split-view (docked sidebar, existing) AND at mobile (bottom sheet,
        // context/features/mobile-drawer-bottom-sheet-spec.md — the visible map slice above the
        // sheet stays interactive) — modal everywhere in between (tablet width, unchanged), and
        // always modal in trip-planner mode regardless of width (a different, untouched feature).
        modal.set(isTripPlannerMode() || (!this.breakpoint.isDesktopSplitView() && !this.breakpoint.isMobile()));
      }
    });
    return modal;
  }

  allAttractionsModal = this.stickyModal('all-attractions', () => this.isAllAttractionsTripPlanner());
  attractionDetailModal = this.stickyModal('attraction-detail', () => this.isAttractionDetailTripPlanner());
  hikesModal = this.stickyModal('hikes', () => this.isHikesTripPlanner());
  hikeDetailModal = this.stickyModal('hike-detail', () => this.isHikeDetailTripPlanner());
  bikesModal = this.stickyModal('bikes', () => this.isBikesTripPlanner());
  bikeDetailModal = this.stickyModal('bike-detail', () => this.isBikeDetailTripPlanner());

  // Mobile bottom sheet (context/features/mobile-drawer-bottom-sheet-spec.md): below
  // Breakpoint.MOBILE_MAX_WIDTH these seven drawers render as a fixed-height sheet with the map
  // visible above, instead of a full-screen left slide — EXCEPT when in "trip planner mode" (the
  // existing isXTripPlanner computeds above, which also cover the search/explore-trips/trip-summary
  // sources with no real map behind them) — those stay the full-screen modal they've always been, at
  // every width, since they're a different feature this redesign doesn't touch.
  allAttractionsMobileSheet = computed(() => this.breakpoint.isMobile() && !this.isAllAttractionsTripPlanner());
  attractionDetailMobileSheet = computed(() => this.breakpoint.isMobile() && !this.isAttractionDetailTripPlanner());
  hikesMobileSheet = computed(() => this.breakpoint.isMobile() && !this.isHikesTripPlanner());
  hikeDetailMobileSheet = computed(() => this.breakpoint.isMobile() && !this.isHikeDetailTripPlanner());
  bikesMobileSheet = computed(() => this.breakpoint.isMobile() && !this.isBikesTripPlanner());
  bikeDetailMobileSheet = computed(() => this.breakpoint.isMobile() && !this.isBikeDetailTripPlanner());
  // destination-detail has no trip-planner-picker variant, so no gate needed beyond isMobile itself.
  destinationDetailMobileSheet = computed(() => this.breakpoint.isMobile());
}
