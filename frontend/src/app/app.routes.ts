import { Routes } from '@angular/router';
import { MainLayout } from './shell/main-layout/main-layout';
import { Home } from './features/home/home';
import { DestinationVerticalList } from './features/destinations/destination-vertical-list/destination-vertical-list';
import { DestinationsLayout } from './shell/destinations-layout/destinations-layout';
import { Profile } from './features/auth/profile/profile';
import { authGuard } from './core/guards/auth';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', component: Home },
      { path: 'destinations', component: DestinationVerticalList },
      { path: 'destinations/:id', component: DestinationsLayout },
    ]
  },
  { path: 'auth', redirectTo: '', pathMatch: 'full' },
  { path: 'auth/forgot-password', redirectTo: '', pathMatch: 'full' },
  {
    path: 'auth/profile',
    component: Profile,
    canActivate: [authGuard],
  },
];
