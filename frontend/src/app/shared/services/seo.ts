import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { DEFAULT_LANG, SUPPORTED_LANGS, stripLocalePrefix } from './lang';

export interface SeoData {
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
}

const SITE_NAME = 'ActivSwitzerland';

// Fixed rather than derived from the request: @angular/ssr reconstructs the
// request's absolute URL from X-Forwarded-Host/-Proto headers (gated behind
// a trustProxyHeaders setting that's off by default), falling back to
// whatever the Node process itself sees. Behind more than one reverse-proxy
// hop (nginx behind the NAS's own reverse proxy), that fallback can resolve
// to the Node process's local address instead of the real public host —
// found live: canonical/og:url were shipping as http://localhost:<port>/.
// A known constant sidesteps the whole header-forwarding chain rather than
// depending on every hop being configured correctly.
const SITE_URL = 'https://www.activswitzerland.com';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private titleSvc = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);
  private router = inject(Router);

  set(data: SeoData): void {
    const fullTitle = `${data.title} | ${SITE_NAME}`;
    this.titleSvc.setTitle(fullTitle);

    const canonicalUrl = `${SITE_URL}${this.router.url.split('?')[0]}`;

    this.meta.updateTag({ name: 'description', content: data.description });
    this.meta.updateTag({ name: 'robots', content: data.noindex ? 'noindex, nofollow' : 'index, follow' });

    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: data.description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });

    this.meta.updateTag({ name: 'twitter:card', content: data.image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: data.description });

    if (data.image) {
      this.meta.updateTag({ property: 'og:image', content: data.image });
      this.meta.updateTag({ name: 'twitter:image', content: data.image });
    } else {
      this.meta.removeTag('property="og:image"');
      this.meta.removeTag('name="twitter:image"');
    }

    this.setCanonical(canonicalUrl);
    this.setHreflang(stripLocalePrefix(this.router.url.split('?')[0]));
  }

  /** The current page's canonical absolute URL — same computation `set()` uses for `canonical`/`og:url`. */
  currentUrl(): string {
    return `${SITE_URL}${this.router.url.split('?')[0]}`;
  }

  private setCanonical(url: string): void {
    let link: HTMLLinkElement | null = this.doc.querySelector('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  // strippedPath is the current path with its locale segment removed (e.g.
  // `/destinations/abc`, or `/` for the home page) — the same page exists
  // under every locale at `/{lang}${strippedPath}`.
  private setHreflang(strippedPath: string): void {
    const suffix = strippedPath === '/' ? '' : strippedPath;
    this.doc.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());
    for (const lang of SUPPORTED_LANGS) {
      this.appendAlternateLink(lang, `${SITE_URL}/${lang}${suffix}`);
    }
    this.appendAlternateLink('x-default', `${SITE_URL}/${DEFAULT_LANG}${suffix}`);
  }

  private appendAlternateLink(hreflang: string, href: string): void {
    const link = this.doc.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', hreflang);
    link.setAttribute('href', href);
    this.doc.head.appendChild(link);
  }

  /** Sitewide `WebSite` JSON-LD (unlocks Google's sitelinks searchbox). Called once from the app root, not per route. */
  setWebsite(): void {
    this.writeJsonLd('ld-website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/${DEFAULT_LANG}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    });
  }

  /**
   * Per-page structured data (e.g. `TouristDestination`/`Place`). Pass `null` to clear it —
   * needed on routes that load then fail (destination-detail's error path), so a stale previous
   * page's structured data doesn't linger in the DOM.
   */
  setStructuredData(data: Record<string, unknown> | null): void {
    if (!data) {
      this.doc.getElementById('ld-page')?.remove();
      return;
    }
    this.writeJsonLd('ld-page', data);
  }

  private writeJsonLd(id: string, data: Record<string, unknown>): void {
    let script = this.doc.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = this.doc.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      this.doc.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }
}
