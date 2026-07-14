import { Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ElevationProfile } from '../../models/elevation-profile';

interface ChartPoint {
  x: number;
  y: number;
  distanceKm: number;
  elevation: number;
}

interface ChartTick {
  pos: number;
  label: number;
}

@Component({
  selector: 'app-elevation-chart',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './elevation-chart.html',
  styleUrl: './elevation-chart.css',
})
export class ElevationChart implements OnChanges {
  @Input({ required: true }) profile!: ElevationProfile;
  @Input() ariaLabel = '';

  @ViewChild('svgEl') private svgRef?: ElementRef<SVGSVGElement>;

  readonly viewW = 320;
  readonly viewH = 140;
  private readonly padLeft = 34;
  private readonly padRight = 6;
  private readonly padTop = 10;
  private readonly padBottom = 20;

  points: ChartPoint[] = [];
  areaPath = '';
  linePath = '';
  baselineY = 0;
  yTicks: ChartTick[] = [];
  xTicks: ChartTick[] = [];

  hoverIndex: number | null = null;

  ngOnChanges(): void {
    this.hoverIndex = null;
    this.build();
  }

  get hoverPoint(): ChartPoint | null {
    return this.hoverIndex != null ? this.points[this.hoverIndex] ?? null : null;
  }

  get hoverLeftPct(): number {
    const p = this.hoverPoint;
    return p ? (p.x / this.viewW) * 100 : 0;
  }

  get hoverTopPct(): number {
    const p = this.hoverPoint;
    return p ? (p.y / this.viewH) * 100 : 0;
  }

  private build(): void {
    const pts = this.profile?.points ?? [];
    if (pts.length < 2) {
      this.points = [];
      this.areaPath = '';
      this.linePath = '';
      this.yTicks = [];
      this.xTicks = [];
      return;
    }

    const maxDist = pts[pts.length - 1].distanceKm || 1;

    // Round the elevation domain out to the nearest 50m so gridlines land on clean numbers.
    const minEle = Math.floor(this.profile.minElevation / 50) * 50;
    const maxEle = Math.max(minEle + 50, Math.ceil(this.profile.maxElevation / 50) * 50);

    const drawW = this.viewW - this.padLeft - this.padRight;
    const drawH = this.viewH - this.padTop - this.padBottom;

    const xScale = (d: number) => this.padLeft + (d / maxDist) * drawW;
    const yScale = (e: number) => this.padTop + drawH - ((e - minEle) / (maxEle - minEle)) * drawH;

    this.points = pts.map(p => ({
      x: xScale(p.distanceKm),
      y: yScale(p.elevation),
      distanceKm: p.distanceKm,
      elevation: p.elevation,
    }));

    this.baselineY = this.padTop + drawH;

    const linePts = this.points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ');
    const first = this.points[0];
    const last = this.points[this.points.length - 1];
    this.linePath = `M ${linePts}`;
    this.areaPath =
      `M ${first.x.toFixed(1)},${this.baselineY.toFixed(1)} ` +
      `L ${linePts} ` +
      `L ${last.x.toFixed(1)},${this.baselineY.toFixed(1)} Z`;

    this.yTicks = [minEle, (minEle + maxEle) / 2, maxEle].map(e => ({
      pos: yScale(e),
      label: Math.round(e),
    }));

    this.xTicks = [0, maxDist / 2, maxDist].map(d => ({
      pos: xScale(d),
      label: Math.round(d * 10) / 10,
    }));
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.points.length || !this.svgRef) return;
    const rect = this.svgRef.nativeElement.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / rect.width) * this.viewW;
    this.hoverIndex = this.nearestIndex(localX);
  }

  onPointerLeave(): void {
    this.hoverIndex = null;
  }

  onFocus(): void {
    if (this.hoverIndex == null && this.points.length) this.hoverIndex = 0;
  }

  onBlur(): void {
    this.hoverIndex = null;
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.points.length) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.hoverIndex = Math.min((this.hoverIndex ?? -1) + 1, this.points.length - 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.hoverIndex = Math.max((this.hoverIndex ?? this.points.length) - 1, 0);
    }
  }

  private nearestIndex(x: number): number {
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < this.points.length; i++) {
      const d = Math.abs(this.points[i].x - x);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    }
    return closest;
  }
}
