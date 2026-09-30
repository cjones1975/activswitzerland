import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { HotelsService } from './hotels';
import { Lang } from './lang';

// Swiss variants first; fall back to de-DE/fr-FR/it-IT here if GYG doesn't honour them.
const GYG_LOCALES: Record<Lang, string> = {
  en: 'en-GB',
  de: 'de-CH',
  fr: 'fr-CH',
  it: 'it-CH',
  es: 'es-ES',
};

const LOADER_SRC = 'https://widget.getyourguide.com/dist/pa.umd.production.min.js';

@Injectable({ providedIn: 'root' })
export class GygService {
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private hotels = inject(HotelsService);

  readonly partnerId = environment.gygPartnerId;

  /**
   * GYG location IDs live on the hotelDestinations table (context/features/gyg-experiences-rollout-spec.md),
   * already loaded by HotelsService. mappingFor() reads a signal, so computed()s built on this react
   * once that load resolves.
   */
  locationIdFor(identifier: string): number | undefined {
    return this.hotels.mappingFor(identifier)?.gygLocationId;
  }

  localeFor(lang: Lang): string {
    return GYG_LOCALES[lang];
  }

  /**
   * Injects GYG's loader once, on first widget use, rather than from index.html — pages without a
   * widget never load GYG code. The loader pulls in GYG's widget.js, which watches document.body
   * with a MutationObserver and renders any `[data-gyg-widget]` element added later, so widgets
   * inserted by drawers opening after this has loaded still render without any re-scan call.
   */
  ensureScript(): void {
    if (!this.isBrowser) return;
    if (this.document.querySelector(`script[src="${LOADER_SRC}"]`)) return;
    const script = this.document.createElement('script');
    script.src = LOADER_SRC;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-gyg-partner-id', this.partnerId);
    this.document.head.appendChild(script);
  }
}
