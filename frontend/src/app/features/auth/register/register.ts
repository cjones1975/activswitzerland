import { Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Auth } from '../../../core/services/auth';
import { ReferenceData } from '../../../core/services/referenceData';
import { Country } from '../../../models/country';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const check = group.get('passwordCheck')?.value;
  return pw === check ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, InputText, Select, ToggleSwitch],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private refData = inject(ReferenceData);

  showPassword = signal(false);
  showPasswordCheck = signal(false);
  submitting = signal(false);
  countries: Country[] = [];

  form = this.fb.nonNullable.group(
    {
      firstName:     ['', Validators.required],
      lastName:      ['', Validators.required],
      country:       ['', Validators.required],
      email:         ['', [Validators.required, Validators.email]],
      password:      ['', [Validators.required, Validators.minLength(8)]],
      passwordCheck: ['', Validators.required],
      emailUpdates:  [false],
    },
    { validators: passwordMatchValidator }
  );

  async ngOnInit(): Promise<void> {
    try {
      this.countries = await this.refData.getCountries();
      console.log(this.countries);
    } catch {
      this.countries = [];
    }
  }

  get passwordMismatch(): boolean {
    return this.form.hasError('passwordMismatch') && !!this.form.get('passwordCheck')?.touched;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.submitting.set(true);
    try {
      const { firstName, lastName, country, email, password, emailUpdates } = this.form.getRawValue();
      await this.auth.register({ firstName, lastName, country, email, password, emailUpdates });
    } finally {
      this.submitting.set(false);
    }
  }
}
