import { Injectable, inject } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';

export const SUPPORTED_LANGS = ['en', 'de', 'fr', 'it'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

const LOCALE_PREFIX_RE = new RegExp(`^/(${SUPPORTED_LANGS.join('|')})(?=/|$)`);

/** Strips a leading `/en`/`/de`/`/fr`/`/it` segment from a path, e.g. `/de/destinations` -> `/destinations`, `/en` -> `/`. */
export function stripLocalePrefix(path: string): string {
  return path.replace(LOCALE_PREFIX_RE, '') || '/';
}

@Injectable({ providedIn: 'root' })
export class LangService {
  private router = inject(Router);

  get current(): Lang {
    const first = this.router.url.split('?')[0].split('/').filter(Boolean)[0];
    return (SUPPORTED_LANGS as readonly string[]).includes(first) ? (first as Lang) : DEFAULT_LANG;
  }

  /**
   * Prepends the current locale segment onto a route-commands array. Callers
   * pass commands as they would to `Router.navigate` minus the leading `/`
   * and locale, e.g. `localize(['destinations', id])` -> `/de/destinations/id`.
   * Centralized here rather than relying on relative-routerLink resolution
   * because several call sites (shell chrome, services) aren't themselves
   * routed components with a reliable ActivatedRoute context.
   */
  localize(commands: any[]): any[] {
    return ['/', this.current, ...commands];
  }

  navigate(commands: any[], extras?: NavigationExtras): Promise<boolean> {
    return this.router.navigate(this.localize(commands), extras);
  }
}
