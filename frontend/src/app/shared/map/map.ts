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
  @Input() activeMarker?: { lng: number; lat: number };
  @Input() tripRoute: [number, number][] | null = null;
  @Input() tripType: 'road' | 'rail' | null = null;
  @Input() fitBounds: [number, number][] | null = null;

  @Output() markerClick = new EventEmitter<MapMarker>();

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private ngZone = inject(NgZone);
  private map?: MapLibreMap;
  private markerInstances: Marker[] = [];
  private popupInstances = new Map<string, Popup>();
  private mapLoaded = false;

  ngAfterViewInit(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: this.style,
      center: this.center ?? this.calcCenter(),
      zoom: this.zoom,
      attributionControl: false,
    });

    this.map.on('load', () => {
      this.map?.resize();
      this.mapLoaded = true;
      this.syncMarkers();
      this.syncTripRoute();
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
    if ((changes['tripRoute'] || changes['tripType']) && this.mapLoaded) {
      this.syncTripRoute();
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

  private syncMarkers(): void {
    this.markerInstances.forEach(m => m.remove());
    this.markerInstances = [];
    this.popupInstances.forEach(p => p.remove());
    this.popupInstances.clear();

    for (const marker of this.markers) {
      const el = document.createElement('i');
      el.className = `${marker.icon ?? 'fa-solid fa-bullseye'} map-marker-icon${marker.highlight ? ' marker-selected' : ''}${marker.className ? ' ' + marker.className : ''}`;
      if (marker.color) el.style.color = marker.color;
      if (marker.highlight) el.style.color = '#e53e3e';

      const instance = new maplibregl.Marker({ element: el })
        .setLngLat([marker.lng, marker.lat]);

      if (marker.label) {
        const popupHtml = marker.clickable
          ? `<button class="popup-btn" type="button"><span class="popup-name">${marker.label}</span><i class="fa-solid fa-circle-arrow-right popup-arrow"></i></button>`
          : `<span class="popup-name">${marker.label}</span>`;

        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: true,
          offset: 20,
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

        const key = `${marker.lng},${marker.lat}`;
        this.popupInstances.set(key, popup);
        instance.setPopup(popup);
      }

      instance.addTo(this.map!);
      this.markerInstances.push(instance);
    }
  }

  private previousView?: { center: maplibregl.LngLat; zoom: number };

  private activateMarker(target: { lng: number; lat: number }): void {
    if (!this.previousView && this.map) {
      this.previousView = { center: this.map.getCenter(), zoom: this.map.getZoom() };
    }

    const key = `${target.lng},${target.lat}`;
    const popup = this.popupInstances.get(key);

    this.map?.flyTo({
      center: [target.lng, target.lat],
      zoom: 15,
      duration: 800,
    });

    if (popup) {
      this.map?.once('moveend', () => {
        popup.setLngLat([target.lng, target.lat]).addTo(this.map!);
      });
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
      'line-color': '#1a6b3c',
      'line-width': 3,
    };
    if (this.tripType === 'road') {
      paint['line-dasharray'] = [2, 1.5];
    }

    this.map.addLayer({
      id: 'trip-route-line',
      type: 'line',
      source: 'trip-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint,
    });

    if (this.tripType === 'rail') {
      coords.forEach(coord => {
        const el = document.createElement('i');
        el.className = 'fa-solid fa-circle';
        el.style.color = '#1a6b3c';
        el.style.fontSize = '10px';
        el.style.fontWeight = 'bold';
        el.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))';
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(coord)
          .addTo(this.map!);
        this.tripStopMarkers.push(marker);
      });
      return;
    }

    // Road: numbered start/end markers
    const uniqueStops: [number, number][] = [];
    if (coords.length >= 2) {
      uniqueStops.push(coords[0], coords[coords.length - 1]);
    }
    uniqueStops.forEach((coord, i) => {
      const el = document.createElement('div');
      el.className = 'trip-stop-marker';
      el.innerHTML = `<span>${i + 1}</span>`;
      el.style.background = '#1a6b3c';
      el.style.color = '#fff';
      el.style.borderRadius = '50%';
      el.style.width = '22px';
      el.style.height = '22px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '12px';
      el.style.fontWeight = '700';
      el.style.border = '2px solid #fff';
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coord)
        .addTo(this.map!);
      this.tripStopMarkers.push(marker);
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
