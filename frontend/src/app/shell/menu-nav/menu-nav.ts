import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { Drawer } from '../../shared/services/drawer';
import { Lang, LangService, stripLocalePrefix } from '../../shared/services/lang';
import { Auth } from '../../core/services/auth';

@Component({
  standalone: true,
  selector: 'app-menu-nav',
  imports: [TranslatePipe, FormsModule, Select, RouterLink],
  templateUrl: './menu-nav.html',
  styleUrl: './menu-nav.css',
})
export class MenuNav {
  protected langSvc = inject(LangService);
  private drawer = inject(Drawer);
  protected router = inject(Router);
  protected auth = inject(Auth);

  languages = [
    { label: 'English', value: 'en' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Français', value: 'fr' },
    { label: 'Italiano', value: 'it' },
  ];

  selectedLang = this.langSvc.current;

  closeMenu(): void {
    this.drawer.close('menu-nav');
  }

  /** Navigates to the locale-swapped equivalent of the current URL, rather than swapping the language in place. */
  changeLanguage(lang: Lang): void {
    const [path, query] = this.router.url.split('?');
    const rest = stripLocalePrefix(path);
    const newUrl = `/${lang}${rest === '/' ? '' : rest}${query ? '?' + query : ''}`;
    this.router.navigateByUrl(newUrl);
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
      this.langSvc.navigate([]);
    } else {
      this.openAuth();
    }
  }

  onProfileClick(): void {
    if (this.auth.isLoggedIn()) {
      this.closeMenu();
      this.langSvc.navigate(['auth', 'profile']);
    } else {
      this.openAuth();
    }
  }
}
