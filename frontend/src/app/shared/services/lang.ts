import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class LangService {
  private translate = inject(TranslateService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly KEY = 'app-lang';
  private readonly DEFAULT = 'en';

  get current(): string {
    if (!this.isBrowser) return this.DEFAULT;
    return localStorage.getItem(this.KEY) ?? this.DEFAULT;
  }

  set(lang: string): void {
    if (this.isBrowser) localStorage.setItem(this.KEY, lang);
    this.translate.use(lang);
  }
}
