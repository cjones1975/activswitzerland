import { Routes } from '@angular/router';
import { MainLayout } from './shell/main-layout/main-layout';
import { Home } from './features/home/home';
import { AuthLayout } from './features/auth/auth-layout/auth-layout';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { Profile } from './features/auth/profile/profile';
import { authGuard } from './core/guards/auth';

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
  {
    path: 'auth/profile',
    component: Profile,
    canActivate: [authGuard],
  },
];
