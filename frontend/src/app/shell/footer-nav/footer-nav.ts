import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

@Component({
  selector: 'app-footer-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './footer-nav.html',
  styleUrl: './footer-nav.css',
  host: { '[style.display]': "showNav() ? '' : 'none'" },
})
export class FooterNav {
  private router = inject(Router);

  showNav = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => this.isFooterNavRoute((e as NavigationEnd).urlAfterRedirects)),
      startWith(this.isFooterNavRoute(this.router.url)),
    ),
    { initialValue: false },
  );

  private isFooterNavRoute(url: string): boolean {
    const path = url.split('?')[0];
    return path === '/' || path === '/destinations'
      || /^\/destinations\/.+/.test(path) || /^\/trip-planner(\/.*)?$/.test(path);
  }
}
