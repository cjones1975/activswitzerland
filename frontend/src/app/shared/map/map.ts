import {
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  AfterViewInit,
  OnDestroy,
  Output,
  ElementRef,
  ViewChild,
  SimpleChanges,
  inject,
} from '@angular/core';
import maplibregl, { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl';

export interface MapMarker {
  lng: number;
  lat: number;
  label?: string;
  icon?: string;
  color?: string;
  className?: string;
  id?: string;
  highlight?: boolean;
  clickable?: boolean;
  /** Show the label popup immediately on add, not just after a click. Clicking still toggles it (default maplibre-gl marker/popup behavior). */
  openByDefault?: boolean;
  /** Asset path to a PNG/image icon. Takes precedence over `icon`/`color` when set. */
  image?: string;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class MapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() markers: MapMarker[] = [];
  @Input() zoom = 10;
  @Input() center?: [number, number];
  @Input() style = 'https://tiles.openfreemap.org/styles/bright';
  @Input() activeMarker?: { lng: number; lat: number; zoom?: number; id?: string };
  @Input() tripRoute: [number, number][] | null = null;
  @Input() tripType: 'road' | 'rail' | null = null;
  @Input() tripStopPoints: [number, number][] = [];
  @Input() fitBounds: [number, number][] | null = null;
  // Array of separate line segments (not one continuous line) — a route can
  // have gaps/discontinuities, and joining them end-to-end would draw a
  // straight line across the gap.
  @Input() trailRoute: [number, number][][] | null = null;
  @Input() trailColor = '#d97706';
  // "See all stages" nationwide overview for a multi-day hike/bike route:
  // the full stage-by-stage line plus one numbered marker per stage, kept
  // independent of trailRoute/tripRoute so it can be shown or hidden on its
  // own regardless of what else is on the map.
  @Input() stageOverviewLines: [number, number][][] | null = null;
  @Input() stageOverviewStages: { lng: number; lat: number; stageNumber: number }[] = [];
  @Input() stageOverviewColor = '#d97706';

  @Output() markerClick = new EventEmitter<MapMarker>();

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private ngZone = inject(NgZone);
  private map?: MapLibreMap;
  private markerInstances = new Map<string, { marker: Marker; el: HTMLElement }>();
  private popupInstances = new Map<string, Popup>();
  private mapLoaded = false;

  ngAfterViewInit(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: this.style,
      center: this.center ?? this.calcCenter(),
      zoom: this.zoom,
      // rollEnabled: true,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl({
    visualizePitch: true,
    //visualizeRoll: true,
    showZoom: true,
    showCompass: true
}), 'bottom-right');

    this.map.on('load', () => {
      this.map?.resize();
      this.mapLoaded = true;
      this.syncMarkers();
      this.syncTripRoute();
      this.syncTrailRoute();
      this.syncStageOverview();
      if (this.fitBounds && this.fitBounds.length >= 2) {
        this.applyFitBounds(this.fitBounds, false);
      } else if (this.center) {
        this.map?.flyTo({ center: this.center, zoom: this.zoom, duration: 800 });
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['markers'] && this.mapLoaded) {
      this.syncMarkers();
    }
    if (changes['center'] && this.mapLoaded && this.center) {
      this.map?.flyTo({ center: this.center, zoom: this.zoom, duration: 800 });
    }
    if (changes['activeMarker'] && this.mapLoaded) {
      if (this.activeMarker) {
        this.activateMarker(this.activeMarker);
      } else {
        this.deactivateMarker();
      }
    }
    if ((changes['tripRoute'] || changes['tripType'] || changes['tripStopPoints']) && this.mapLoaded) {
      this.syncTripRoute();
    }
    if ((changes['trailRoute'] || changes['trailColor']) && this.mapLoaded) {
      this.syncTrailRoute();
    }
    if ((changes['stageOverviewLines'] || changes['stageOverviewStages'] || changes['stageOverviewColor']) && this.mapLoaded) {
      this.syncStageOverview();
    }
    if (changes['fitBounds'] && this.mapLoaded && this.fitBounds && this.fitBounds.length >= 2) {
      this.applyFitBounds(this.fitBounds, true);
    }
  }

  private applyFitBounds(coords: [number, number][], animate: boolean): void {
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0])
    );
    this.map?.fitBounds(bounds, { padding: 60, duration: animate ? 800 : 0 });
  }

  private calcCenter(): [number, number] {
    if (!this.markers.length) return [8.2275, 46.8182];
    const lngs = this.markers.map(m => m.lng);
    const lats = this.markers.map(m => m.lat);
    return [
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
      (Math.min(...lats) + Math.max(...lats)) / 2,
    ];
  }

  private markerKey(m: MapMarker): string {
    return m.id ?? `${m.lng},${m.lat}`;
  }

  private buildMarkerEl(marker: MapMarker): HTMLElement {
    if (marker.image) {
      const img = document.createElement('img');
      img.src = marker.image;
      img.className = `map-marker-image${marker.highlight ? ' marker-selected' : ''}${marker.className ? ' ' + marker.className : ''}`;
      return img;
    }
    const el = document.createElement('i');
    el.className = `${marker.icon ?? 'fa-solid fa-bullseye'} map-marker-icon${marker.highlight ? ' marker-selected' : ''}${marker.className ? ' ' + marker.className : ''}`;
    el.style.color = marker.highlight ? '#e53e3e' : (marker.color ?? '');
    return el;
  }

  private addMarker(marker: MapMarker): void {
    const key = this.markerKey(marker);
    const el = this.buildMarkerEl(marker);

    const container = document.createElement('div');
    container.className = 'map-marker-container';
    if (marker.className) container.classList.add(...marker.className.split(' ').filter(Boolean));
    container.dataset['customClass'] = marker.className ?? '';
    container.appendChild(el);

    const instance = new maplibregl.Marker({ element: container, anchor: 'center' }).setLngLat([marker.lng, marker.lat]);

    if (marker.label) {
      const popupHtml = marker.clickable
        ? `<button class="popup-btn" type="button"><span class="popup-name">${marker.label}</span><i class="fa-solid fa-circle-arrow-right popup-arrow"></i></button>`
        : `<span class="popup-name">${marker.label}</span>`;

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: true,
        offset: 20,
        className: marker.className,
      }).setHTML(popupHtml);

      if (marker.clickable) {
        popup.on('open', () => {
          const btn = popup.getElement()?.querySelector('.popup-btn') as HTMLElement | null;
          if (btn) {
            btn.addEventListener('click', () => {
              popup.remove();
              this.ngZone.run(() => this.markerClick.emit(marker));
            });
          }
        });
      }

      this.popupInstances.set(key, popup);
      instance.setPopup(popup);
    }

    instance.addTo(this.map!);
    if (marker.openByDefault && marker.label) {
      instance.togglePopup();
    }
    this.markerInstances.set(key, { marker: instance, el });
  }

  private syncMarkers(): void {
    const incoming = new Map(this.markers.map(m => [this.markerKey(m), m]));

    // Remove stale markers
    for (const [key, { marker }] of this.markerInstances) {
      if (!incoming.has(key)) {
        marker.remove();
        this.popupInstances.get(key)?.remove();
        this.popupInstances.delete(key);
        this.markerInstances.delete(key);
      }
    }

    // Update existing or add new
    for (const [key, m] of incoming) {
      if (this.markerInstances.has(key)) {
        const { marker, el } = this.markerInstances.get(key)!;
        if (m.image) {
          (el as HTMLImageElement).src = m.image;
          el.className = `map-marker-image${m.highlight ? ' marker-selected' : ''}${m.className ? ' ' + m.className : ''}`;
        } else {
          el.className = `${m.icon ?? 'fa-solid fa-bullseye'} map-marker-icon${m.highlight ? ' marker-selected' : ''}${m.className ? ' ' + m.className : ''}`;
          el.style.color = m.highlight ? '#e53e3e' : (m.color ?? '');
        }
        const container = marker.getElement();
        const prevClass = container.dataset['customClass'] ?? '';
        if (prevClass) container.classList.remove(...prevClass.split(' ').filter(Boolean));
        if (m.className) container.classList.add(...m.className.split(' ').filter(Boolean));
        container.dataset['customClass'] = m.className ?? '';
      } else {
        this.addMarker(m);
      }
    }
  }

  private previousView?: { center: maplibregl.LngLat; zoom: number };

  private activateMarker(target: { lng: number; lat: number; zoom?: number; id?: string }): void {
    if (!this.previousView && this.map) {
      this.previousView = { center: this.map.getCenter(), zoom: this.map.getZoom() };
    }

    const key = target.id ?? `${target.lng},${target.lat}`;
    const popup = this.popupInstances.get(key);

    this.map?.flyTo({
      center: [target.lng, target.lat],
      zoom: target.zoom ?? 15,
      duration: 800,
    });

    if (popup) {
      this.map?.once('moveend', () => {
        this.closeOtherPopups(popup);
        popup.setLngLat([target.lng, target.lat]).addTo(this.map!);
      });
    }
  }

  // Direct marker clicks close other open popups for free (they trigger each
  // popup's own `closeOnClick` map-click listener via event bubbling), but
  // programmatic activation via `activeMarker` never fires a click, so it
  // needs to close any other open popup explicitly.
  private closeOtherPopups(except: Popup): void {
    for (const popup of this.popupInstances.values()) {
      if (popup !== except) popup.remove();
    }
  }

  private deactivateMarker(): void {
    if (!this.map || !this.previousView) return;
    this.map.flyTo({ center: this.previousView.center, zoom: this.previousView.zoom, duration: 800 });
    this.previousView = undefined;
  }

  private tripStopMarkers: Marker[] = [];

  private syncTripRoute(): void {
    if (!this.map) return;

    // Remove existing route layer/source
    if (this.map.getLayer('trip-route-line')) this.map.removeLayer('trip-route-line');
    if (this.map.getSource('trip-route')) this.map.removeSource('trip-route');

    // Remove trip stop markers
    this.tripStopMarkers.forEach(m => m.remove());
    this.tripStopMarkers = [];

    const coords = this.tripRoute;
    if (!coords || coords.length < 2) return;

    // Add GeoJSON source
    this.map.addSource('trip-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      },
    });

    const paint: any = {
      'line-color': this.tripType === 'road' ? '#1a2f4a' : '#1a6b3c',
      'line-width': 3,
    };

    this.map.addLayer({
      id: 'trip-route-line',
      type: 'line',
      source: 'trip-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint,
    });

    if (this.tripType === 'rail') {
      coords.forEach(coord => {
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-circle';
        icon.style.color = '#1a6b3c';
        icon.style.fontSize = '10px';
        icon.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))';
        const el = document.createElement('div');
        el.className = 'map-marker-container';
        el.appendChild(icon);
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(coord)
          .addTo(this.map!);
        this.tripStopMarkers.push(marker);
      });
      return;
    }

    // Road: every stop numbered by visit order (1..N), final destination
    // color-distinguished from departure/via stops so the scheme generalizes
    // to any number of stops instead of a fixed start/end icon pair.
    const stops: [number, number][] = this.tripStopPoints.length >= 2
      ? this.tripStopPoints
      : (coords.length >= 2 ? [coords[0], coords[coords.length - 1]] : []);

    stops.forEach((coord, i) => {
      const isEnd = i === stops.length - 1;
      const el = document.createElement('div');
      el.className = 'trip-stop-marker';
      el.innerHTML = `<span>${i + 1}</span>`;
      Object.assign(el.style, {
        background: isEnd ? '#e53e3e' : '#285278', color: '#fff', borderRadius: '50%',
        width: '22px', height: '22px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: '700',
        border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(coord)
        .addTo(this.map!);
      this.tripStopMarkers.push(marker);
    });
  }

  private syncTrailRoute(): void {
    if (!this.map) return;

    if (this.map.getLayer('trail-route-line')) this.map.removeLayer('trail-route-line');
    if (this.map.getSource('trail-route')) this.map.removeSource('trail-route');

    const lines = this.trailRoute?.filter(line => line.length >= 2);
    if (!lines || !lines.length) return;

    this.map.addSource('trail-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'MultiLineString' as const, coordinates: lines },
        properties: {},
      },
    });

    this.map.addLayer({
      id: 'trail-route-line',
      type: 'line',
      source: 'trail-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': this.trailColor,
        'line-width': 4,
      },
    });
  }

  private stageOverviewMarkers: Marker[] = [];

  // Mirrors syncTripRoute()'s numbered-marker + GeoJSON-line approach, on its
  // own source/layer ids so it doesn't collide with trip-route-line/trail-route-line.
  private syncStageOverview(): void {
    if (!this.map) return;

    if (this.map.getLayer('stage-overview-line')) this.map.removeLayer('stage-overview-line');
    if (this.map.getSource('stage-overview')) this.map.removeSource('stage-overview');

    this.stageOverviewMarkers.forEach(m => m.remove());
    this.stageOverviewMarkers = [];

    const lines = this.stageOverviewLines?.filter(line => line.length >= 2);
    if (!lines || !lines.length) return;

    this.map.addSource('stage-overview', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'MultiLineString' as const, coordinates: lines },
        properties: {},
      },
    });

    this.map.addLayer({
      id: 'stage-overview-line',
      type: 'line',
      source: 'stage-overview',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': this.stageOverviewColor,
        'line-width': 4,
      },
    });

    this.stageOverviewStages.forEach(stage => {
      const el = document.createElement('div');
      el.className = 'trip-stop-marker';
      el.innerHTML = `<span>${stage.stageNumber}</span>`;
      Object.assign(el.style, {
        background: this.stageOverviewColor, color: '#fff', borderRadius: '50%',
        width: '22px', height: '22px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: '700',
        border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([stage.lng, stage.lat])
        .addTo(this.map!);
      this.stageOverviewMarkers.push(marker);
    });
  }

  ngOnDestroy(): void {
    this.markerInstances.forEach(({ marker }) => marker.remove());
    this.stageOverviewMarkers.forEach(m => m.remove());
    this.map?.remove();
  }
}
