import { Routes } from '@angular/router';
import { MainLayout } from './shell/main-layout/main-layout';
import { Home } from './features/home/home';
import { AuthLayout } from './features/auth/auth-layout/auth-layout';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', component: Home },
    ]
  },
  {
    path: 'auth',
    component: AuthLayout,
  },
  {
    path: 'auth/forgot-password',
    component: ForgotPassword,
  },
];
