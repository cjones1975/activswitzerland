import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Login } from '../login/login';
import { Register } from '../register/register';
import { VerifyCode } from '../verify-code/verify-code';
import { Auth } from '../../../core/services/auth';
import { Drawer } from '../../../shared/services/drawer';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [TranslatePipe, Login, Register, VerifyCode],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout {
  auth = inject(Auth);
  private drawer = inject(Drawer);

  activeTab = signal<'login' | 'register'>('login');
  verifySubmitting = signal(false);

  verifying = computed(() => this.auth.pendingVerification());

  async onVerify(code: string): Promise<void> {
    const email = this.verifying()?.email;
    if (!email) return;
    this.verifySubmitting.set(true);
    try {
      await this.auth.verifyEmail(email, code);
      this.drawer.close('auth');
    } finally {
      this.verifySubmitting.set(false);
    }
  }
}
