import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { Toast } from './toast';

interface AuthResponse {
  token: string;
}

interface RegisterPayload {
  firstName: string;
  lastName: string;
  country: string;
  email: string;
  password: string;
  emailUpdates: boolean;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private toast = inject(Toast);
  private router = inject(Router);
  private translate = inject(TranslateService);

  readonly token = signal<string | null>(localStorage.getItem('auth-token'));
  readonly isLoggedIn = computed(() => !!this.token());

  private t(key: string): string {
    return this.translate.instant(key);
  }

  private storeToken(token: string): void {
    this.token.set(token);
    localStorage.setItem('auth-token', token);
  }

  async login(email: string, password: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<AuthResponse>('http://localhost:3000/api/v1/auth/login', { email, password })
      );
      this.storeToken(res.token);
      this.toast.success(this.t('auth.toast.login_success'), this.t('auth.toast.login_welcome'), 3000, 'toast-success');
    } catch (err: any) {
      let detail: string;
      if (err?.status === 403) {
        detail = err?.error?.err;
      } else if (!err?.status) {
        detail = this.t('auth.toast.login_check_credentials');
      } else {
        detail = err?.error?.message ?? this.t('auth.toast.generic_error');
      }
      this.toast.error(this.t('auth.toast.login_failed'), detail, 3000, 'toast-error');
      throw err;
    }
  }

  async register(payload: RegisterPayload): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<AuthResponse>('http://localhost:3000/api/v1/auth/register', payload)
      );
      this.storeToken(res.token);
      this.toast.success(this.t('auth.toast.register_success'), this.t('auth.toast.register_welcome'), 3000, 'toast-success');
      this.router.navigate(['/']);
    } catch (err: any) {
      const detail = err?.error?.message ?? this.t('auth.toast.register_failed_detail');
      this.toast.error(this.t('auth.toast.register_failed'), detail, 3000, 'toast-error');
      throw err;
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post('http://localhost:3000/api/v1/auth/forgotPassword', { email })
      );
      this.toast.success(this.t('auth.toast.forgot_success'), this.t('auth.toast.forgot_success_detail'), 4000, 'toast-success');
    } catch (err: any) {
      const detail = err?.status === 500
        ? this.t('auth.toast.forgot_no_user')
        : this.t('auth.toast.generic_error');
      this.toast.error(this.t('auth.toast.forgot_failed'), detail, 4000, 'toast-error');
      throw err;
    }
  }

  logout(): void {
    this.token.set(null);
    localStorage.removeItem('auth-token');
  }
}
