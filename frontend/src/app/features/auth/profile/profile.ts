import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Auth, CurrentUser } from '../../../core/services/auth';
import { Toast as ToastService } from '../../../core/services/toast';
import { TripsService } from '../../../shared/services/trips';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { SavedTrip } from '../../../models/trip';
import { SeoService } from '../../../shared/services/seo';
import { Lang, LangService, SUPPORTED_LANGS } from '../../../shared/services/lang';
import { formatDistance } from '../../../shared/utils/distance';
import { localizedName, localizedReview } from '../../../shared/utils/localized-text';
import { VerifyCode } from '../verify-code/verify-code';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TranslatePipe, InputText, Select, ToggleSwitch, Button, Tag, ConfirmDialog, Toast, VerifyCode],
  providers: [ConfirmationService, MessageService],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  readonly formatDistance = formatDistance;

  auth = inject(Auth);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private langSvc = inject(LangService);
  private fb = inject(FormBuilder);
  private tripsSvc = inject(TripsService);
  private tripPlannerSvc = inject(TripPlannerService);
  private confirmSvc = inject(ConfirmationService);
  private destroyRef = inject(DestroyRef);
  private seo = inject(SeoService);

  isEditing = signal(false);
  savedTrips = signal<SavedTrip[]>([]);

  user = signal<CurrentUser | null>(null);
  pendingEmailVerification = signal<string | null>(null);
  verifySubmitting = signal(false);

  stats = signal({ savedTrips: 0, reviewsWritten: 0, likesReceived: 0 });

  // ── Trip reviews (Explore Trips Phase A) ────────────────────────────────
  openReviewIds = signal<Set<string>>(new Set());
  editingReviewId = signal<string | null>(null);
  reviewDraft = signal('');
  // ── Translation review/edit (trip-content-translation-spec.md Phase C) ─────
  readonly localeTabs: readonly Lang[] = SUPPORTED_LANGS;
  reviewEditLocale = signal<Lang>('en');
  editingNameId = signal<string | null>(null);
  nameDraft = signal('');
  nameEditLocale = signal<Lang>('en');

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
    const u = this.user();
    if (!u) return '';
    return ((u.firstName[0] ?? '') + (u.lastName[0] ?? '')).toUpperCase();
  }

  ngOnInit(): void {
    // Authenticated, personal content — not canonical, see
    // context/features/seo-ssr-foundation-spec.md's Confirmed decisions.
    this.seo.set({ title: 'Profile', description: 'Your ActivSwitzerland profile.', noindex: true });
    this.auth.getMe()
      .then(u => this.user.set(u))
      .catch(() => {});
    this.tripsSvc.getTrips()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(trips => {
        this.savedTrips.set(trips);
        this.recomputeStats(trips);
      });
  }

  private recomputeStats(trips: SavedTrip[]): void {
    this.stats.set({
      savedTrips: trips.length,
      reviewsWritten: trips.filter(t => t.review?.trim()).length,
      likesReceived: trips.reduce((sum, t) => sum + (t.likes?.length ?? 0), 0),
    });
  }

  toggleEdit(): void {
    this.editForm.patchValue({ ...this.user() });
    this.isEditing.set(true);
  }

  async saveEdit(): Promise<void> {
    if (this.editForm.invalid) return;
    const res = await this.auth.updateUser(this.editForm.getRawValue());
    this.user.set(res.data);
    this.isEditing.set(false);
    if (res.emailVerificationPending && res.pendingEmail) {
      this.pendingEmailVerification.set(res.pendingEmail);
    }
    if (res.emailUpdateError) {
      this.toast.error(this.translate.instant('auth.toast.verify_failed'), res.emailUpdateError, 4000, 'toast-error');
    }
  }

  async onVerifyEmailChange(code: string): Promise<void> {
    this.verifySubmitting.set(true);
    try {
      const updated = await this.auth.verifyEmailChange(code);
      this.user.set(updated);
      this.pendingEmailVerification.set(null);
    } finally {
      this.verifySubmitting.set(false);
    }
  }

  async onResendEmailChange(): Promise<void> {
    const pendingEmail = this.pendingEmailVerification();
    if (!pendingEmail) return;
    // Re-running updateUser with the same pending email regenerates+resends the code —
    // no separate resend-email-change endpoint needed, this path is already idempotent.
    const res = await this.auth.updateUser({ email: pendingEmail });
    if (res.emailVerificationPending && res.pendingEmail) {
      this.pendingEmailVerification.set(res.pendingEmail);
    }
    if (res.emailUpdateError) {
      this.toast.error(this.translate.instant('auth.toast.verify_failed'), res.emailUpdateError, 4000, 'toast-error');
    }
  }

  signOut(): void {
    this.auth.logout();
    this.langSvc.navigate([]);
  }

  // ── Saved trips ────────────────────────────────────────────────────────────
  openTripPlanner(): void {
    this.langSvc.navigate(['trip-planner'], { queryParams: { from: this.router.url } });
  }

  viewTrip(trip: SavedTrip): void {
    this.tripPlannerSvc.loadSavedTrip(trip);
    this.tripPlannerSvc.step.set(4);
    this.langSvc.navigate(['trip-planner'], { queryParams: { from: this.router.url } });
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
            this.recomputeStats(updated);
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

  // ── Trip reviews ──────────────────────────────────────────────────────────
  isReviewOpen(trip: SavedTrip): boolean {
    return !!trip._id && this.openReviewIds().has(trip._id);
  }

  toggleReview(trip: SavedTrip): void {
    if (!trip._id) return;
    const open = new Set(this.openReviewIds());
    if (open.has(trip._id)) {
      open.delete(trip._id);
    } else {
      open.add(trip._id);
    }
    this.openReviewIds.set(open);
  }

  startEditReview(trip: SavedTrip): void {
    if (!trip._id) return;
    this.reviewEditLocale.set('en');
    this.reviewDraft.set(localizedReview(trip, 'en'));
    this.editingReviewId.set(trip._id);
  }

  // Switching locale discards any in-progress unsaved edit for the previous locale, in favour
  // of that locale's currently-stored (translated or English-fallback) text — see Phase C's
  // verification plan, "simpler acceptable behavior" option.
  selectReviewLocale(trip: SavedTrip, locale: Lang): void {
    this.reviewEditLocale.set(locale);
    this.reviewDraft.set(localizedReview(trip, locale));
  }

  saveReview(trip: SavedTrip): void {
    if (!trip._id) return;
    const locale = this.reviewEditLocale();
    const draft = this.reviewDraft().trim();
    // A direct field patch, not a re-translation — editing a locale's stored text overrides
    // that locale's translation without re-triggering the backend's regeneration logic, since
    // the English source (`review`) didn't change when `locale !== 'en'`.
    const updates = locale === 'en'
      ? { review: draft }
      : { reviewTranslations: { ...trip.reviewTranslations, [locale]: draft } };
    this.tripsSvc.updateTrip(trip._id, updates)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(saved => {
        const updated = this.savedTrips().map(t => t._id === trip._id ? { ...t, ...saved } : t);
        this.savedTrips.set(updated);
        this.recomputeStats(updated);
        this.editingReviewId.set(null);
      });
  }

  // ── Trip name translations ──────────────────────────────────────────────
  startEditName(trip: SavedTrip): void {
    if (!trip._id) return;
    this.nameEditLocale.set('en');
    this.nameDraft.set(localizedName(trip, 'en'));
    this.editingNameId.set(trip._id);
  }

  selectNameLocale(trip: SavedTrip, locale: Lang): void {
    this.nameEditLocale.set(locale);
    this.nameDraft.set(localizedName(trip, locale));
  }

  saveName(trip: SavedTrip): void {
    if (!trip._id) return;
    const locale = this.nameEditLocale();
    const draft = this.nameDraft().trim();
    const updates = locale === 'en'
      ? { name: draft }
      : { nameTranslations: { ...trip.nameTranslations, [locale]: draft } };
    this.tripsSvc.updateTrip(trip._id, updates)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(saved => {
        const updated = this.savedTrips().map(t => t._id === trip._id ? { ...t, ...saved } : t);
        this.savedTrips.set(updated);
        this.recomputeStats(updated);
        this.editingNameId.set(null);
      });
  }

  cancelEditName(): void {
    this.editingNameId.set(null);
  }
}
