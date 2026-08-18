import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Desktop split-view breakpoint (Phase 0 of the desktop responsive redesign,
 * context/features/desktop-redesign-phase0-foundations-spec.md) — matches Tailwind v4's built-in
 * `xl` breakpoint so future Tailwind-utility layout work lines up with this same cutover.
 */
export const SPLIT_VIEW_MIN_WIDTH = 1280;

/**
 * Below this width the app renders as normal. At/above it, real users get the "use mobile for
 * now" notice instead of the app (context/features/desktop-mobile-notice-spec.md) — deliberately
 * lower than SPLIT_VIEW_MIN_WIDTH, since the tablet-tier (768-1023px) redesign work already
 * shipped is good enough to show, but the 1024px+ desktop layout isn't yet.
 */
export const DESKTOP_NOTICE_MIN_WIDTH = 1024;

const DESKTOP_PREVIEW_STORAGE_KEY = 'as-desktop-preview';

/** Must match the class name the inline no-flash script in index.html adds. */
const DESKTOP_GATE_CLASS = 'as-desktop-gate';

@Injectable({ providedIn: 'root' })
export class Breakpoint {
  private platformId = inject(PLATFORM_ID);

  /**
   * True at/above the desktop split-view breakpoint. Always false during SSR/prerender (no
   * `window` under Node) — corrected to the real viewport on the client once `matchMedia` runs.
   */
  readonly isDesktopSplitView = signal(false);

  /**
   * True at/above DESKTOP_NOTICE_MIN_WIDTH, unless the `?preview=desktop` dev bypass has been
   * set. Always false during SSR/prerender, same reasoning as `isDesktopSplitView` — this also
   * means bots (including Googlebot, which crawls mobile-first by default) always see the real
   * app, never the notice.
   */
  readonly isDesktopNotice = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const splitViewMql = window.matchMedia(`(min-width: ${SPLIT_VIEW_MIN_WIDTH}px)`);
    this.isDesktopSplitView.set(splitViewMql.matches);
    splitViewMql.addEventListener('change', e => this.isDesktopSplitView.set(e.matches));

    if (new URLSearchParams(window.location.search).get('preview') === 'desktop') {
      localStorage.setItem(DESKTOP_PREVIEW_STORAGE_KEY, '1');
    }
    const previewBypass = localStorage.getItem(DESKTOP_PREVIEW_STORAGE_KEY) === '1';

    const noticeMql = window.matchMedia(`(min-width: ${DESKTOP_NOTICE_MIN_WIDTH}px)`);
    this.isDesktopNotice.set(!previewBypass && noticeMql.matches);
    noticeMql.addEventListener('change', e => this.isDesktopNotice.set(!previewBypass && e.matches));

    // Angular now has the same answer the inline script guessed at — safe to reveal app-root,
    // since the correct branch (real app vs. notice) renders synchronously from here before the
    // browser gets a chance to paint.
    document.documentElement.classList.remove(DESKTOP_GATE_CLASS);
  }
}
