import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

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
}
