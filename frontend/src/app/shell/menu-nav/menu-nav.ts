import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';

@Component({
  standalone: true,
  selector: 'app-menu-nav',
  imports: [TranslatePipe, FormsModule, Select, RouterLink],
  templateUrl: './menu-nav.html',
  styleUrl: './menu-nav.css',
})
export class MenuNav {
  private translate = inject(TranslateService);

  languages = [
    { label: 'English', value: 'en' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Français', value: 'fr' },
    { label: 'Italiano', value: 'it' },
  ];

  selectedLang = localStorage.getItem('app-lang') || 'en';

  constructor() {
    this.translate.use(this.selectedLang);
  }

  changeLanguage(lang: string): void {
    this.translate.use(lang);
    localStorage.setItem('app-lang', lang);
  }
}
