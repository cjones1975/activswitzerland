import { Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HeaderNav } from '../../../shell/header-nav/header-nav';
import { FooterNav } from '../../../shell/footer-nav/footer-nav';
import { Login } from '../login/login';
import { Register } from '../register/register';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [TranslatePipe, HeaderNav, FooterNav, Login, Register],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout {
  activeTab = signal<'login' | 'register'>('login');
}
