import { Component, EventEmitter, Input, OnDestroy, Output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputOtp } from 'primeng/inputotp';

@Component({
  selector: 'app-verify-code',
  standalone: true,
  imports: [ReactiveFormsModule, InputOtp],
  templateUrl: './verify-code.html',
  styleUrl: './verify-code.css',
})
export class VerifyCode implements OnDestroy {
  @Input({ required: true }) email!: string;
  @Input() submitting = false;
  @Output() submitCode = new EventEmitter<string>();
  @Output() resend = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  codeControl = new FormControl<string>('', { nonNullable: true });
  resendCooldown = signal(0);

  private cooldownTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.codeControl.valueChanges.subscribe(value => {
      if (value.length === 5) this.onSubmit();
    });
  }

  onSubmit(): void {
    if (this.codeControl.value.length !== 5 || this.submitting) return;
    this.submitCode.emit(this.codeControl.value);
  }

  onResend(): void {
    if (this.resendCooldown() > 0) return;
    this.resend.emit();
    this.codeControl.reset('');
    this.startCooldown();
  }

  private startCooldown(): void {
    this.resendCooldown.set(30);
    clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      const next = this.resendCooldown() - 1;
      this.resendCooldown.set(next);
      if (next <= 0) clearInterval(this.cooldownTimer);
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.cooldownTimer);
  }
}
