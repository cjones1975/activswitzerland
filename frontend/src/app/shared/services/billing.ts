import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface CheckoutResponse {
  data: { url: string };
}

@Injectable({ providedIn: 'root' })
export class Billing {
  private http = inject(HttpClient);

  /** Redirects the browser straight to Stripe Checkout — nothing to await on return, the
   * success/cancel redirect (see billing.js) lands back on /profile. */
  async startCheckout(plan: 'monthly' | 'yearly'): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<CheckoutResponse>(`${environment.apiUrl}/api/v1/billing/checkout`, { plan })
    );
    window.location.href = res.data.url;
  }

  /** Redirects the browser to the Stripe Customer Portal for managing/cancelling. */
  async openPortal(): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<CheckoutResponse>(`${environment.apiUrl}/api/v1/billing/portal`, {})
    );
    window.location.href = res.data.url;
  }
}
