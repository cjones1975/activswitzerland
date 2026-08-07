import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Desktop split-view breakpoint (Phase 0 of the desktop responsive redesign,
 * context/features/desktop-redesign-phase0-foundations-spec.md) — matches Tailwind v4's built-in
 * `xl` breakpoint so future Tailwind-utility layout work lines up with this same cutover.
 */
export const SPLIT_VIEW_MIN_WIDTH = 1280;

@Injectable({ providedIn: 'root' })
export class Breakpoint {
  private platformId = inject(PLATFORM_ID);

  /**
   * True at/above the desktop split-view breakpoint. Always false during SSR/prerender (no
   * `window` under Node) — corrected to the real viewport on the client once `matchMedia` runs.
   */
  readonly isDesktopSplitView = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    const mql = window.matchMedia(`(min-width: ${SPLIT_VIEW_MIN_WIDTH}px)`);
    this.isDesktopSplitView.set(mql.matches);
    mql.addEventListener('change', e => this.isDesktopSplitView.set(e.matches));
  }
}
