import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
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

interface RegisterResponse {
  data: { email: string; verificationRequired: boolean };
}

export interface CurrentUser {
  _id: string;
  firstName: string;
  lastName: string;
  country: string;
  email: string;
  emailUpdates: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  country?: string;
  emailUpdates?: boolean;
  email?: string;
}

interface UpdateUserResponse {
  data: CurrentUser;
  emailVerificationPending: boolean;
  pendingEmail?: string;
  emailUpdateError?: string;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private toast = inject(Toast);
  private translate = inject(TranslateService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly token = signal<string | null>(this.isBrowser ? localStorage.getItem('auth-token') : null);
  readonly isLoggedIn = computed(() => !!this.token());

  /** Set whenever register/login requires a 5-digit email code before a session is granted. */
  readonly pendingVerification = signal<{ email: string } | null>(null);

  private t(key: string): string {
    return this.translate.instant(key);
  }

  private storeToken(token: string): void {
    this.token.set(token);
    if (this.isBrowser) localStorage.setItem('auth-token', token);
  }

  async register(payload: RegisterPayload): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<RegisterResponse>(`${environment.apiUrl}/api/v1/auth/register`, payload)
      );
      this.pendingVerification.set({ email: res.data.email });
      this.toast.success(this.t('auth.toast.register_success'), this.t('auth.toast.verify_sent'), 4000, 'toast-success');
    } catch (err: any) {
      const detail = err?.error?.err ?? this.t('auth.toast.register_failed_detail');
      this.toast.error(this.t('auth.toast.register_failed'), detail, 3000, 'toast-error');
      throw err;
    }
  }

  async login(email: string, password: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<AuthResponse>(`${environment.apiUrl}/api/v1/auth/login`, { email, password })
      );
      this.storeToken(res.token);
      this.toast.success(this.t('auth.toast.login_success'), this.t('auth.toast.login_welcome'), 3000, 'toast-success');
    } catch (err: any) {
      if (err?.status === 403 && err?.error?.verificationRequired) {
        // Backend already sent a fresh code — show the verify step instead of an error toast.
        this.pendingVerification.set({ email: err.error.email ?? email });
        this.toast.info(this.t('auth.toast.verify_required'), this.t('auth.toast.verify_sent'), 4000, 'toast-info');
        return;
      }
      let detail: string;
      if (err?.status === 403) {
        detail = err?.error?.err;
      } else if (!err?.status) {
        detail = this.t('auth.toast.login_check_credentials');
      } else {
        detail = err?.error?.err ?? this.t('auth.toast.generic_error');
      }
      this.toast.error(this.t('auth.toast.login_failed'), detail, 3000, 'toast-error');
      throw err;
    }
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<AuthResponse>(`${environment.apiUrl}/api/v1/auth/verifyEmail`, { email, code })
      );
      this.storeToken(res.token);
      this.pendingVerification.set(null);
      this.toast.success(this.t('auth.toast.verify_success'), this.t('auth.toast.login_welcome'), 3000, 'toast-success');
    } catch (err: any) {
      const detail = err?.error?.err ?? this.t('auth.toast.generic_error');
      this.toast.error(this.t('auth.toast.verify_failed'), detail, 3000, 'toast-error');
      throw err;
    }
  }

  async resendVerification(email: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/api/v1/auth/resendVerification`, { email })
      );
      this.toast.success(this.t('auth.toast.resend_success'), this.t('auth.toast.verify_sent'), 3000, 'toast-success');
    } catch (err: any) {
      const detail = err?.error?.err ?? this.t('auth.toast.generic_error');
      this.toast.error(this.t('auth.toast.resend_failed'), detail, 3000, 'toast-error');
      throw err;
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/api/v1/auth/forgotPassword`, { email })
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

  async getMe(): Promise<CurrentUser> {
    const res = await firstValueFrom(
      this.http.get<{ data: CurrentUser }>(`${environment.apiUrl}/api/v1/auth/me`)
    );
    return res.data;
  }

  async updateUser(payload: UpdateUserPayload): Promise<UpdateUserResponse> {
    try {
      return await firstValueFrom(
        this.http.put<UpdateUserResponse>(`${environment.apiUrl}/api/v1/auth/updateUser`, payload)
      );
    } catch (err: any) {
      const detail = err?.error?.err ?? this.t('auth.toast.generic_error');
      this.toast.error(this.t('auth.toast.update_failed'), detail, 3000, 'toast-error');
      throw err;
    }
  }

  async verifyEmailChange(code: string): Promise<CurrentUser> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ data: CurrentUser }>(`${environment.apiUrl}/api/v1/auth/verifyEmailChange`, { code })
      );
      this.toast.success(this.t('auth.toast.verify_success'), undefined, 3000, 'toast-success');
      return res.data;
    } catch (err: any) {
      const detail = err?.error?.err ?? this.t('auth.toast.generic_error');
      this.toast.error(this.t('auth.toast.verify_failed'), detail, 3000, 'toast-error');
      throw err;
    }
  }

  logout(): void {
    this.token.set(null);
    if (this.isBrowser) localStorage.removeItem('auth-token');
  }
}
