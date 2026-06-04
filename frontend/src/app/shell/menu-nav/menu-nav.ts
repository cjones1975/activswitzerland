import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { Drawer } from '../../shared/services/drawer';
import { LangService } from '../../shared/services/lang';

@Component({
  standalone: true,
  selector: 'app-menu-nav',
  imports: [TranslatePipe, FormsModule, Select],
  templateUrl: './menu-nav.html',
  styleUrl: './menu-nav.css',
})
export class MenuNav {
  private langSvc = inject(LangService);
  private drawer = inject(Drawer);

  languages = [
    { label: 'English', value: 'en' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Français', value: 'fr' },
    { label: 'Italiano', value: 'it' },
  ];

  selectedLang = this.langSvc.current;

  constructor() {
    this.langSvc.set(this.selectedLang);
  }

  changeLanguage(lang: string): void {
    this.langSvc.set(lang);
  }

  openAuth(): void {
    this.drawer.close('menu-nav');
    this.drawer.open('auth');
  }
}
