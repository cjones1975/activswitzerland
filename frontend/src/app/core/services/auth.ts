import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Toast } from './toast';

interface LoginResponse {
  token: string;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private toast = inject(Toast);

  readonly token = signal<string | null>(localStorage.getItem('auth-token'));
  readonly isLoggedIn = computed(() => !!this.token());

  async login(email: string, password: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<LoginResponse>('http://localhost:3000/api/v1/auth/login', { email, password })
      );
      this.token.set(res.token);
      localStorage.setItem('auth-token', res.token);
      this.toast.success('Logged in', 'Welcome back!', 3000, 'toast-success');
    } catch (err: any) {
        let detail: string;

    if (err?.status === 403) {
      detail = err?.error?.err;
    } else if (!err?.status) {
      detail = 'Please check your credentials and try again.';
    } else {
      detail = err?.error?.message ?? 'Something went wrong. Please try again.';
    }

    this.toast.error('Login failed', detail, 3000, 'toast-error');
    throw err;
    }
  }

  logout(): void {
    this.token.set(null);
    localStorage.removeItem('auth-token');
  }
}
