import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Menubar } from 'primeng/menubar';
import { Drawer } from '../../shared/services/drawer';
import { LangService } from '../../shared/services/lang';

@Component({
  selector: 'app-header-nav',
  imports: [Menubar, RouterLink],
  templateUrl: './header-nav.html',
  styleUrl: './header-nav.css',
})
export class HeaderNav {

  protected langSvc = inject(LangService);
  private drawer = inject(Drawer);

  toggleMenu() {
    this.drawer.toggle('menu-nav');
  }
}
