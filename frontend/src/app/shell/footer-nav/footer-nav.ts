import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { Auth } from '../../core/services/auth';
import { Drawer } from '../../shared/services/drawer';
import { LangService, stripLocalePrefix } from '../../shared/services/lang';

@Component({
  selector: 'app-footer-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './footer-nav.html',
  styleUrl: './footer-nav.css',
  host: { '[style.display]': "showNav() ? '' : 'none'" },
})
export class FooterNav {
  protected router = inject(Router);
  protected langSvc = inject(LangService);
  private auth = inject(Auth);
  private drawer = inject(Drawer);

  showNav = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => this.isFooterNavRoute((e as NavigationEnd).urlAfterRedirects)),
      startWith(this.isFooterNavRoute(this.router.url)),
    ),
    { initialValue: false },
  );

  private isFooterNavRoute(url: string): boolean {
    const path = stripLocalePrefix(url.split('?')[0]);
    return path === '/' || path === '/destinations' || path === '/search'
      || /^\/destinations\/.+/.test(path) || /^\/trip-planner(\/.*)?$/.test(path);
  }

  onProfileClick(): void {
    if (this.auth.isLoggedIn()) {
      this.langSvc.navigate(['auth', 'profile']);
    } else {
      this.drawer.open('auth');
    }
  }
}
