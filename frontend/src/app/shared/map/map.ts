import {
  Component,
  Input,
  OnChanges,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  SimpleChanges,
} from '@angular/core';
import maplibregl, { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl';

export interface MapMarker {
  lng: number;
  lat: number;
  label?: string;
  icon?: string;
  color?: string;
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

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

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
      if (this.center) {
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
    if (changes['activeMarker'] && this.mapLoaded && this.activeMarker) {
      this.activateMarker(this.activeMarker);
    }
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
      el.className = `${marker.icon ?? 'fa-solid fa-bullseye'} map-marker-icon`;
      if (marker.color) el.style.color = marker.color;

      const instance = new maplibregl.Marker({ element: el })
        .setLngLat([marker.lng, marker.lat]);

      if (marker.label) {
        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: true,
          offset: 20,
        }).setText(marker.label);

        const key = `${marker.lng},${marker.lat}`;
        this.popupInstances.set(key, popup);
        instance.setPopup(popup);
      }

      instance.addTo(this.map!);
      this.markerInstances.push(instance);
    }
  }

  private activateMarker(target: { lng: number; lat: number }): void {
    const key = `${target.lng},${target.lat}`;
    const popup = this.popupInstances.get(key);

    this.map?.flyTo({
      center: [target.lng, target.lat],
      zoom: Math.max(this.map.getZoom(), 9),
      duration: 800,
    });

    if (popup) {
      this.map?.once('moveend', () => {
        popup.setLngLat([target.lng, target.lat]).addTo(this.map!);
      });
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
