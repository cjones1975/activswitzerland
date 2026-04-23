import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Drawer, DrawerKey } from '../services/drawer';
import { DrawerModule } from 'primeng/drawer';
import { TranslatePipe } from '@ngx-translate/core';

// Drawers
import { MenuNav } from '../../shell/menu-nav/menu-nav';

@Component({
  selector: 'app-drawer-host',
  standalone: true,
  imports: [CommonModule, DrawerModule, TranslatePipe, MenuNav],
  templateUrl: './drawer-host.html',
  styleUrl: './drawer-host.css',
})
export class DrawerHost {
  svc = inject(Drawer);

  onVisibleChange(key: DrawerKey, visible: boolean) {
    visible ? this.svc.open(key) : this.svc.close(key);
  }

  onDrawerClose(key: DrawerKey) {
    this.svc.close(key);
  }
}
