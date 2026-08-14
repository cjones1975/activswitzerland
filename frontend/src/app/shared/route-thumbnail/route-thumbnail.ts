import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-route-thumbnail',
  standalone: true,
  imports: [],
  templateUrl: './route-thumbnail.html',
  styleUrl: './route-thumbnail.css',
})
export class RouteThumbnail implements OnChanges {
  @Input() routeCoordinates: [number, number][] = [];
  @Input() tripType: 'road' | 'rail' = 'road';
  @Input() markers: { lng: number; lat: number; image?: string }[] = [];

  // One SVG filter id per instance — many cards render at once, and duplicate ids across
  // sibling <svg>s would be invalid markup (even though most browsers tolerate it).
  private static nextFilterId = 0;
  readonly filterId = `rt-line-shadow-${RouteThumbnail.nextFilterId++}`;

  // Matches MapComponent's road/rail line-color convention exactly (map.ts:334).
  color = '#1a2f4a';
  line = '';
  markerPoints: { x: number; y: number; image?: string }[] = [];

  private readonly viewW = 100;
  private readonly viewH = 60;
  private readonly padding = 8;

  ngOnChanges(): void {
    this.color = this.tripType === 'rail' ? '#1a6b3c' : '#1a2f4a';
    this.project();
  }

  private project(): void {
    const markerCoords: [number, number][] = this.markers.map(m => [m.lng, m.lat]);
    const allPoints = [...this.routeCoordinates, ...markerCoords];
    if (allPoints.length < 2) {
      this.line = '';
      this.markerPoints = [];
      return;
    }

    const xs = allPoints.map(c => c[0]);
    const ys = allPoints.map(c => c[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const drawW = this.viewW - this.padding * 2;
    const drawH = this.viewH - this.padding * 2;
    const scale = Math.min(drawW / spanX, drawH / spanY);
    const offsetX = this.padding + (drawW - spanX * scale) / 2;
    const offsetY = this.padding + (drawH - spanY * scale) / 2;

    // Flip Y: northing increases upward, SVG y increases downward.
    const project = ([x, y]: [number, number]) => ({
      x: offsetX + (x - minX) * scale,
      y: this.viewH - (offsetY + (y - minY) * scale),
    });

    this.line = this.routeCoordinates.length >= 2
      ? this.routeCoordinates.map(c => { const p = project(c); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ')
      : '';
    this.markerPoints = this.markers.map(m => ({ ...project([m.lng, m.lat]), image: m.image }));
  }
}
