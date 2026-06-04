import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class LangService {
  private translate = inject(TranslateService);
  private readonly KEY = 'app-lang';
  private readonly DEFAULT = 'en';

  get current(): string {
    return localStorage.getItem(this.KEY) ?? this.DEFAULT;
  }

  set(lang: string): void {
    localStorage.setItem(this.KEY, lang);
    this.translate.use(lang);
  }
}
