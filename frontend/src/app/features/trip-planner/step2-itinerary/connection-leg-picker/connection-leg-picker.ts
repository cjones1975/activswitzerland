import { Component, DestroyRef, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { TripPlannerService } from '../../../../shared/services/trip-planner';
import { TransportService } from '../../../../shared/services/transport';
import { TripConnection, TripStop } from '../../../../models/trip';

@Component({
  selector: 'app-connection-leg-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, Button],
  templateUrl: './connection-leg-picker.html',
  styleUrl: './connection-leg-picker.css',
})
export class ConnectionLegPicker {
  private plannerSvc = inject(TripPlannerService);
  private transportSvc = inject(TransportService);
  private destroyRef = inject(DestroyRef);

  @Input({ required: true }) fromStop!: TripStop;
  @Input({ required: true }) toStop!: TripStop;
  @Output() resolved = new EventEmitter<void>();

  private readonly trip = toSignal(this.plannerSvc.trip$, { initialValue: this.plannerSvc.snapshot });

  readonly leg = computed(() =>
    this.trip().connections?.find(l => l.fromStopId === this.fromStop.id && l.toStopId === this.toStop.id)
  );

  readonly expanded = signal(false);
  readonly date = signal('');
  readonly time = signal('09:00');
  readonly connections = signal<TripConnection[]>([]);
  readonly loading = signal(false);
  readonly searched = signal(false);
  readonly error = signal(false);

  toggle(): void {
    this.expanded.update(v => !v);
  }

  search(): void {
    if (!this.date() || !this.time()) return;
    this.loading.set(true);
    this.error.set(false);
    forkJoin({
      connections: this.transportSvc.getConnections([this.fromStop, this.toStop], this.date(), this.time()),
      journeys: this.transportSvc.getConnectionJourneys([this.fromStop, this.toStop], this.date(), this.time()),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ connections, journeys }) => {
        this.connections.set(connections.map((c, i) => ({
          ...c,
          routeCoordinates: journeys[i]?.length >= 2 ? journeys[i] : c.routeCoordinates,
        })));
        this.loading.set(false);
        this.searched.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.searched.set(true);
        this.error.set(true);
      },
    });
  }

  pick(conn: TripConnection): void {
    this.plannerSvc.setConnectionLeg(this.fromStop.id, this.toStop.id, conn);
    this.expanded.set(false);
    this.resolved.emit();
  }

  skip(): void {
    this.plannerSvc.skipConnectionLeg(this.fromStop.id, this.toStop.id);
    this.expanded.set(false);
    this.resolved.emit();
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso.slice(11, 16) : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  formatDuration(raw: string): string {
    if (!raw) return '';
    const match = raw.match(/(\d+)d(\d+):(\d+)/);
    if (!match) return raw;
    const days = parseInt(match[1]), hrs = parseInt(match[2]), mins = parseInt(match[3]);
    const totalHrs = days * 24 + hrs;
    return totalHrs > 0 ? `${totalHrs}h ${mins}m` : `${mins}m`;
  }
}
