import { Component, Input, OnChanges } from '@angular/core';
import { TrailCategory, TrailStage, trailCategoryColor } from '../../models/trail-route';

@Component({
  selector: 'app-trail-thumbnail',
  standalone: true,
  imports: [],
  templateUrl: './trail-thumbnail.html',
  styleUrl: './trail-thumbnail.css',
})
export class TrailThumbnail implements OnChanges {
  @Input() stages: TrailStage[] = [];
  @Input() category: TrailCategory = 'local';

  // One polyline points-string per line segment — a route can have gaps, so
  // segments must never be joined into a single continuous polyline.
  lines: string[] = [];
  color = '#d97706';

  private readonly viewW = 100;
  private readonly viewH = 60;
  private readonly padding = 8;

  ngOnChanges(): void {
    this.color = trailCategoryColor(this.category);
    this.lines = this.buildLines();
  }

  private buildLines(): string[] {
    const rawLines = this.stages.flatMap(s => s.geometry?.coordinates ?? []).filter(line => line.length >= 2);
    const allPoints = rawLines.flat();
    if (allPoints.length < 2) return [];

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

    return rawLines.map(line =>
      line
        .map(([x, y]) => {
          const px = offsetX + (x - minX) * scale;
          // Flip Y: northing increases upward, SVG y increases downward.
          const py = this.viewH - (offsetY + (y - minY) * scale);
          return `${px.toFixed(1)},${py.toFixed(1)}`;
        })
        .join(' ')
    );
  }
}
