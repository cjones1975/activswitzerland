import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Drawer, DrawerKey } from '../services/drawer';
import { DrawerModule } from 'primeng/drawer';
import { TranslatePipe } from '@ngx-translate/core';

// Drawers
import { MenuNav } from '../../shell/menu-nav/menu-nav';
import { AuthLayout } from '../../features/auth/auth-layout/auth-layout';
import { ForgotPassword } from '../../features/auth/forgot-password/forgot-password';
import { DestinationDetail } from '../../features/destinations/destination-detail/destination-detail';

@Component({
  selector: 'app-drawer-host',
  standalone: true,
  imports: [CommonModule, DrawerModule, TranslatePipe, MenuNav, AuthLayout, ForgotPassword, DestinationDetail],
  templateUrl: './drawer-host.html',
  styleUrl: './drawer-host.css',
})
export class DrawerHost {
  svc = inject(Drawer);
  private router = inject(Router);

  onVisibleChange(key: DrawerKey, visible: boolean) {
    visible ? this.svc.open(key) : this.svc.close(key);
  }

  onDrawerClose(key: DrawerKey) {
    this.svc.close(key);
  }

  onDestinationBack() {
    this.svc.close('destination-detail');
    this.router.navigate(['/destinations']);
  }
}
