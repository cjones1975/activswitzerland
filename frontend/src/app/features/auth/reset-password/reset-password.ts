import { Component, inject, signal } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Auth } from '../../../core/services/auth';
import { Drawer } from '../../../shared/services/drawer';
import { LangService } from '../../../shared/services/lang';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const check = group.get('confirmPassword')?.value;
  return pw === check ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private drawer = inject(Drawer);
  private langSvc = inject(LangService);

  private token = this.route.snapshot.paramMap.get('token') ?? '';

  showPassword = signal(false);
  showConfirmPassword = signal(false);
  submitting = signal(false);
  failed = signal(false);

  form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  get passwordMismatch(): boolean {
    return this.form.hasError('passwordMismatch') && !!this.form.get('confirmPassword')?.touched;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.submitting.set(true);
    try {
      await this.auth.resetPassword(this.token, this.form.getRawValue().password);
      this.failed.set(false);
      this.langSvc.navigate([]);
    } catch {
      this.failed.set(true);
    } finally {
      this.submitting.set(false);
    }
  }

  openForgotPassword(): void {
    this.drawer.open('forgot-password');
  }
}
