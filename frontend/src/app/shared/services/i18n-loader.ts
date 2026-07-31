import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import de from '../../../../public/i18n/de.json';
import fr from '../../../../public/i18n/fr.json';
import it from '../../../../public/i18n/it.json';

// SSR/prerendering has no live HTTP server to fetch /i18n/{lang}.json from —
// there's no incoming request to resolve a relative URL against during
// build-time prerendering, and no static server yet either (the build is
// what produces it). Bundling the JSON directly sidesteps that entirely: the
// browser keeps fetching over HTTP (so a rebuild-only i18n edit doesn't need
// touching this file), the server uses what got bundled at build time —
// same source files, same build, so the two can't drift within one deploy.
const SERVER_TRANSLATIONS: Record<string, TranslationObject> = { en, de, fr, it };

@Injectable({ providedIn: 'root' })
export class I18nLoader implements TranslateLoader {
  private http = inject(HttpClient);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  getTranslation(lang: string): Observable<TranslationObject> {
    if (this.isBrowser) {
      return this.http.get<TranslationObject>(`/i18n/${lang}.json`);
    }
    return of(SERVER_TRANSLATIONS[lang] ?? SERVER_TRANSLATIONS['en']);
  }
}
