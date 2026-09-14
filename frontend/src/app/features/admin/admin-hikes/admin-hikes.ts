import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MapComponent } from '../../../shared/map/map';
import { Toast } from '../../../core/services/toast';
import { AdminHikesService, AdminHike, HikePreview } from '../services/admin-hikes';

@Component({
  selector: 'app-admin-hikes',
  imports: [FormsModule, DecimalPipe, ConfirmDialog, MapComponent],
  providers: [ConfirmationService],
  templateUrl: './admin-hikes.html',
  styleUrl: './admin-hikes.css',
})
export class AdminHikes {
  private svc = inject(AdminHikesService);
  private toast = inject(Toast);
  private confirmSvc = inject(ConfirmationService);

  protected readonly hikes = signal<AdminHike[]>([]);
  protected readonly loading = signal(true);

  protected readonly drawerOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly nameModel = signal('');
  protected readonly gpxContent = signal<string | null>(null);
  protected readonly gpxFilename = signal<string | null>(null);
  protected readonly preview = signal<HikePreview | null>(null);
  protected readonly previewLoading = signal(false);
  protected readonly saving = signal(false);

  protected readonly previewLines = computed(() => this.preview()?.stage.geometryWgs84.coordinates ?? null);
  protected readonly previewBoundsPoints = computed(() => this.previewLines()?.flat() ?? null);
  protected readonly previewDistanceLabel = computed(() => {
    const p = this.preview();
    return p ? `${p.distanceKm.toFixed(2)} km` : null;
  });
  protected readonly canSave = computed(() => !!this.nameModel().trim() && (!!this.editingId() || !!this.preview()));

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.hikes.set(await this.svc.list());
    } finally {
      this.loading.set(false);
    }
  }

  openAdd(): void {
    this.editingId.set(null);
    this.nameModel.set('');
    this.gpxContent.set(null);
    this.gpxFilename.set(null);
    this.preview.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(hike: AdminHike): void {
    this.editingId.set(hike._id);
    this.nameModel.set(hike.name);
    this.gpxContent.set(null);
    this.gpxFilename.set(null);
    this.preview.set(null);
    this.drawerOpen.set(true);
  }

  close(): void {
    this.drawerOpen.set(false);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const text = await file.text();
    this.gpxFilename.set(file.name);
    this.gpxContent.set(null);
    this.preview.set(null);
    this.previewLoading.set(true);
    try {
      const result = await this.svc.preview(text);
      this.gpxContent.set(text);
      this.preview.set(result);
    } catch (err: any) {
      this.gpxFilename.set(null);
      this.toast.error('Could not read GPX file', err?.error?.err ?? 'Check the file and try again', 4000, 'toast-error');
    } finally {
      this.previewLoading.set(false);
    }
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    try {
      if (this.editingId()) {
        await this.svc.update(this.editingId()!, this.nameModel().trim());
      } else {
        await this.svc.create(this.nameModel().trim(), this.gpxContent()!);
      }
      this.drawerOpen.set(false);
      await this.load();
    } catch (err: any) {
      this.toast.error('Save failed', err?.error?.err ?? 'Something went wrong', 4000, 'toast-error');
    } finally {
      this.saving.set(false);
    }
  }

  confirmRemove(hike: AdminHike): void {
    this.confirmSvc.confirm({
      message: `Delete "${hike.name}"? This also removes it from any saved trips.`,
      header: 'Delete Hike',
      icon: 'fa-light fa-triangle-exclamation',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        await this.svc.remove(hike._id);
        await this.load();
      },
    });
  }
}
