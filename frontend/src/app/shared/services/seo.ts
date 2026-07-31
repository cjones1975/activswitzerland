import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
}

const SITE_NAME = 'ActivSwitzerland';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private titleSvc = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);

  set(data: SeoData): void {
    const fullTitle = `${data.title} | ${SITE_NAME}`;
    this.titleSvc.setTitle(fullTitle);

    this.meta.updateTag({ name: 'description', content: data.description });
    this.meta.updateTag({ name: 'robots', content: data.noindex ? 'noindex, nofollow' : 'index, follow' });

    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: data.description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: this.doc.location.href });

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

    this.setCanonical(this.doc.location.href.split('?')[0]);
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
