import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
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

  readonly token = signal<string | null>(localStorage.getItem('auth-token'));
  readonly isLoggedIn = computed(() => !!this.token());

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

  async register(payload: RegisterPayload): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<AuthResponse>('http://localhost:3000/api/v1/auth/register', payload)
      );
      this.storeToken(res.token);
      this.toast.success('Account created', 'Welcome to ActivSwitzerland!', 3000, 'toast-success');
      this.router.navigate(['/']);
    } catch (err: any) {
      const detail = err?.error?.message ?? 'Registration failed. Please try again.';
      this.toast.error('Registration failed', detail, 3000, 'toast-error');
      throw err;
    }
  }

  logout(): void {
    this.token.set(null);
    localStorage.removeItem('auth-token');
  }
}
