import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { Drawer } from '../../shared/services/drawer';
import { LangService } from '../../shared/services/lang';
import { Auth } from '../../core/services/auth';

@Component({
  standalone: true,
  selector: 'app-menu-nav',
  imports: [TranslatePipe, FormsModule, Select, RouterLink],
  templateUrl: './menu-nav.html',
  styleUrl: './menu-nav.css',
})
export class MenuNav {
  private langSvc = inject(LangService);
  private drawer = inject(Drawer);
  private router = inject(Router);
  protected auth = inject(Auth);

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

  closeMenu(): void {
    this.drawer.close('menu-nav');
  }

  changeLanguage(lang: string): void {
    this.langSvc.set(lang);
    this.closeMenu();
  }

  openAuth(): void {
    this.drawer.close('menu-nav');
    this.drawer.open('auth');
  }

  onAuthAction(): void {
    if (this.auth.isLoggedIn()) {
      this.auth.logout();
      this.closeMenu();
      this.router.navigate(['/']);
    } else {
      this.openAuth();
    }
  }
}
