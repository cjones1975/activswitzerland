import { Component, inject, signal } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';

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
export class Register {
  private fb = inject(FormBuilder);

  showPassword = signal(false);
  showPasswordCheck = signal(false);

  countries = [
    { label: 'Switzerland', value: 'CH' },
    { label: 'Germany', value: 'DE' },
    { label: 'France', value: 'FR' },
    { label: 'Italy', value: 'IT' },
    { label: 'Austria', value: 'AT' },
    { label: 'United Kingdom', value: 'GB' },
    { label: 'United States', value: 'US' },
    { label: 'Netherlands', value: 'NL' },
    { label: 'Belgium', value: 'BE' },
    { label: 'Spain', value: 'ES' },
  ];

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

  get passwordMismatch(): boolean {
    return this.form.hasError('passwordMismatch') && !!this.form.get('passwordCheck')?.touched;
  }
}
