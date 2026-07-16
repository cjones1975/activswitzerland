import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Auth } from '../../../core/services/auth';
import { TripsService } from '../../../shared/services/trips';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { SavedTrip } from '../../../models/trip';
import { HeaderNav } from '../../../shell/header-nav/header-nav';
import { FooterNav } from '../../../shell/footer-nav/footer-nav';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, InputText, Select, ToggleSwitch, Button, Tag, ConfirmDialog, Toast, HeaderNav, FooterNav],
  providers: [ConfirmationService, MessageService],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  private auth = inject(Auth);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private tripsSvc = inject(TripsService);
  private tripPlannerSvc = inject(TripPlannerService);
  private confirmSvc = inject(ConfirmationService);
  private destroyRef = inject(DestroyRef);

  isEditing = signal(false);
  savedTrips = signal<SavedTrip[]>([]);

  // Hardcoded — replaced when getMe API is wired
  user = {
    firstName: 'Sophie',
    lastName: 'Müller',
    email: 'sophie.muller@email.com',
    country: 'Switzerland',
    emailUpdates: true,
  };

  stats = signal({ savedTrips: 0, reviewsWritten: 7, reviewsLiked: 34 });

  countries = [
    { label: 'Switzerland', value: 'Switzerland' },
    { label: 'Germany', value: 'Germany' },
    { label: 'France', value: 'France' },
    { label: 'Italy', value: 'Italy' },
    { label: 'Austria', value: 'Austria' },
  ];

  editForm = this.fb.nonNullable.group({
    firstName:    ['', Validators.required],
    lastName:     ['', Validators.required],
    country:      ['', Validators.required],
    email:        ['', [Validators.required, Validators.email]],
    emailUpdates: [false],
  });

  get initials(): string {
    return ((this.user.firstName[0] ?? '') + (this.user.lastName[0] ?? '')).toUpperCase();
  }

  ngOnInit(): void {
    this.tripsSvc.getTrips()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(trips => {
        this.savedTrips.set(trips);
        this.stats.set({ ...this.stats(), savedTrips: trips.length });
      });
  }

  toggleEdit(): void {
    this.editForm.patchValue({ ...this.user });
    this.isEditing.set(true);
  }

  saveEdit(): void {
    if (this.editForm.invalid) return;
    this.user = { ...this.user, ...this.editForm.getRawValue() };
    this.isEditing.set(false);
  }

  signOut(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  // ── Saved trips ────────────────────────────────────────────────────────────
  openTripPlanner(): void {
    this.router.navigate(['/trip-planner']);
  }

  viewTrip(trip: SavedTrip): void {
    this.tripPlannerSvc.loadSavedTrip(trip);
    this.tripPlannerSvc.step.set(4);
    this.router.navigate(['/trip-planner']);
  }

  confirmDeleteTrip(trip: SavedTrip): void {
    this.confirmSvc.confirm({
      message: 'Are you sure you want to delete this trip?',
      header: 'Delete Trip',
      icon: 'fa-light fa-triangle-exclamation',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        if (!trip._id) return;
        this.tripsSvc.deleteTrip(trip._id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => {
            const updated = this.savedTrips().filter(t => t._id !== trip._id);
            this.savedTrips.set(updated);
            this.stats.set({ ...this.stats(), savedTrips: updated.length });
          });
      },
    });
  }

  tripStopSummary(trip: SavedTrip): string {
    if (!trip.stops.length) return '';
    return `${trip.stops[0].name} → ${trip.stops[trip.stops.length - 1].name}`;
  }

  formatDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
