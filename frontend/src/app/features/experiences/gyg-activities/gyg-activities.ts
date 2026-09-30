import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { Observable, startWith, switchMap } from 'rxjs';
import { GygService } from '../../../shared/services/gyg';
import { Lang, LangService } from '../../../shared/services/lang';

// Hide the skeleton even if the iframe never reports loaded (blocked by an ad blocker, GYG down),
// so the section doesn't shimmer forever.
const SKELETON_TIMEOUT_MS = 10000;

// Start building slightly before the widget scrolls into view, so it's usually ready on arrival.
const LAZY_ROOT_MARGIN = '300px';

/**
 * GetYourGuide activities widget (context/features/gyg-experiences-poc-spec.md). GYG renders the
 * cards inside its own iframe, so nothing here can style them — this component only builds the
 * `[data-gyg-widget]` container GYG's script looks for, and rebuilds it on language change.
 */
@Component({
  selector: 'app-gyg-activities',
  standalone: true,
  templateUrl: './gyg-activities.html',
  styleUrl: './gyg-activities.css',
})
export class GygActivities {
  private gyg = inject(GygService);
  private langSvc = inject(LangService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  locationId = input.required<number>();
  numberOfItems = input.required<number>();

  private slot = viewChild.required<ElementRef<HTMLDivElement>>('slot');

  loading = signal(true);

  attributionUrl = computed(() =>
    `https://www.getyourguide.com/-l${this.locationId()}/?partner_id=${this.gyg.partnerId}`);

  private observer: MutationObserver | null = null;
  private skeletonTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Browser only — afterNextRender never runs during SSR, so the server renders just the skeleton.
    // Nothing GYG-related (script or iframe) loads until the widget nears the viewport: in
    // destination-detail it sits below the attractions list, and most users never scroll that far.
    afterNextRender(() => {
      this.nearViewport().pipe(
        switchMap(() => {
          this.gyg.ensureScript();
          return this.translate.onLangChange.pipe(startWith({ lang: this.langSvc.current }));
        }),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(e => this.build(e.lang as Lang));
    });

    this.destroyRef.onDestroy(() => this.stopWatching());
  }

  /**
   * Swaps in a fresh container rather than editing attributes on the old one: GYG marks each
   * container it has processed and skips it afterwards, so a new element is the reliable way to get
   * a re-render in the new locale. GYG's own MutationObserver picks up the insertion.
   */
  private build(lang: Lang): void {
    const slot = this.slot().nativeElement;
    this.stopWatching();
    slot.replaceChildren();
    this.loading.set(true);

    const el = document.createElement('div');
    el.setAttribute('data-gyg-widget', 'activities');
    el.setAttribute('data-gyg-href', 'https://widget.getyourguide.com/default/activities.frame');
    el.setAttribute('data-gyg-partner-id', this.gyg.partnerId);
    el.setAttribute('data-gyg-location-id', String(this.locationId()));
    el.setAttribute('data-gyg-locale-code', this.gyg.localeFor(lang));
    el.setAttribute('data-gyg-currency', 'CHF');
    el.setAttribute('data-gyg-number-of-items', String(this.numberOfItems()));

    // GYG inserts its iframe into the container asynchronously; drop the skeleton once that iframe
    // has actually loaded, so the section doesn't flash an empty white box first.
    this.observer = new MutationObserver(() => {
      const iframe = el.querySelector('iframe');
      if (!iframe) return;
      this.observer?.disconnect();
      this.observer = null;
      iframe.addEventListener('load', () => this.loading.set(false), { once: true });
    });
    this.observer.observe(el, { childList: true });
    this.skeletonTimer = setTimeout(() => this.loading.set(false), SKELETON_TIMEOUT_MS);

    slot.appendChild(el);
  }

  /**
   * Emits once, the first time the host comes within LAZY_ROOT_MARGIN of its scroll container.
   * Observed against the nearest scrolling ancestor (the drawer body), not the viewport: rootMargin
   * only grows the root itself, so with the viewport as root the drawer's own clipping would cancel
   * the margin out and the build would start only once the widget was already on screen.
   */
  private nearViewport(): Observable<void> {
    return new Observable<void>(subscriber => {
      const io = new IntersectionObserver(entries => {
        if (!entries.some(e => e.isIntersecting)) return;
        io.disconnect();
        subscriber.next();
      }, { root: this.scrollParent(), rootMargin: LAZY_ROOT_MARGIN });
      io.observe(this.host.nativeElement);
      return () => io.disconnect();
    });
  }

  private scrollParent(): Element | null {
    let el = this.host.nativeElement.parentElement;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === 'auto' || overflowY === 'scroll') return el;
      el = el.parentElement;
    }
    return null;
  }

  private stopWatching(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.skeletonTimer) clearTimeout(this.skeletonTimer);
    this.skeletonTimer = null;
  }
}
