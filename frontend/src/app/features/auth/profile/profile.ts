import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Auth } from '../../../core/services/auth';
import { HeaderNav } from '../../../shell/header-nav/header-nav';
import { FooterNav } from '../../../shell/footer-nav/footer-nav';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputText, Select, ToggleSwitch, HeaderNav, FooterNav],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private auth = inject(Auth);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  isEditing = signal(false);

  // Hardcoded — replaced when getMe API is wired
  user = {
    firstName: 'Sophie',
    lastName: 'Müller',
    email: 'sophie.muller@email.com',
    country: 'Switzerland',
    emailUpdates: true,
  };

  stats = { savedTrips: 12, reviewsWritten: 7, reviewsLiked: 34 };

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
}
