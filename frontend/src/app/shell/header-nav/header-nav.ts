import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Menubar } from 'primeng/menubar';
import { Popover } from 'primeng/popover';
import { Select } from 'primeng/select';
import { TranslatePipe } from '@ngx-translate/core';
import { Drawer } from '../../shared/services/drawer';
import { Lang, LangService, stripLocalePrefix } from '../../shared/services/lang';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-header-nav',
  imports: [Menubar, Popover, Select, FormsModule, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './header-nav.html',
  styleUrl: './header-nav.css',
})
export class HeaderNav {

  protected langSvc = inject(LangService);
  protected router = inject(Router);
  protected auth = inject(Auth);
  private drawer = inject(Drawer);

  languages = [
    { label: 'English', value: 'en' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Français', value: 'fr' },
    { label: 'Italiano', value: 'it' },
    { label: 'Español', value: 'es' },
  ];

  selectedLang = this.langSvc.current;

  toggleMenu() {
    this.drawer.toggle('menu-nav');
  }

  openAiChat() {
    this.drawer.open('ai-chat');
  }

  /** Navigates to the locale-swapped equivalent of the current URL, rather than swapping the language in place. */
  changeLanguage(lang: Lang): void {
    const [path, query] = this.router.url.split('?');
    const rest = stripLocalePrefix(path);
    const newUrl = `/${lang}${rest === '/' ? '' : rest}${query ? '?' + query : ''}`;
    this.router.navigateByUrl(newUrl);
  }

  onAuthAction(): void {
    if (this.auth.isLoggedIn()) {
      this.auth.logout();
      this.langSvc.navigate([]);
    } else {
      this.drawer.open('auth');
    }
  }

  onProfileClick(): void {
    if (this.auth.isLoggedIn()) {
      this.langSvc.navigate(['auth', 'profile']);
    } else {
      this.drawer.open('auth');
    }
  }
}
