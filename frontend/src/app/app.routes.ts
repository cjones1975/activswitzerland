import { Routes } from '@angular/router';
import { MainLayout } from './shell/main-layout/main-layout';
import { Home } from './features/home/home';
import { Profile } from './features/auth/profile/profile';
import { SearchPage } from './features/search/search-page/search-page';
import { authGuard } from './core/guards/auth';
import { adminGuard } from './core/guards/admin';
import { bareLangMatcher, localeLangResolver, localeMatchGuard } from './core/guards/locale';
import { DEFAULT_LANG } from './shared/services/lang';

export const routes: Routes = [
  {
    path: ':lang',
    canMatch: [localeMatchGuard],
    resolve: { lang: localeLangResolver },
    children: [
      {
        path: '',
        component: MainLayout,
        children: [
          { path: '', component: Home },
          {
            path: 'destinations',
            loadComponent: () => import('./features/destinations/destination-vertical-list/destination-vertical-list').then(m => m.DestinationVerticalList),
          },
          {
            path: 'destinations/:id',
            loadComponent: () => import('./shell/destinations-layout/destinations-layout').then(m => m.DestinationsLayout),
          },
          {
            path: 'trip-planner',
            loadComponent: () => import('./shell/trip-planner-layout/trip-planner-layout').then(m => m.TripPlannerLayout),
          },
          {
            path: 'trip-planner/:id',
            loadComponent: () => import('./shell/trip-planner-layout/trip-planner-layout').then(m => m.TripPlannerLayout),
          },
          {
            path: 'explore-trips',
            loadComponent: () => import('./features/explore-trips/explore-trips').then(m => m.ExploreTrips),
          },
          {
            path: 'trips/:slug',
            loadComponent: () => import('./features/trip-detail/trip-detail').then(m => m.TripDetail),
          },
          { path: 'search', component: SearchPage },
          {
            path: 'auth/profile',
            component: Profile,
            canActivate: [authGuard],
          },
          {
            path: 'terms-and-conditions',
            loadComponent: () => import('./features/legal/terms-and-conditions/terms-and-conditions').then(m => m.TermsAndConditions),
          },
          {
            path: 'privacy-policy',
            loadComponent: () => import('./features/legal/privacy-policy/privacy-policy').then(m => m.PrivacyPolicy),
          },
          {
            path: 'reset-password/:token',
            loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPassword),
          },
          {
            path: 'practical-info/:slug',
            loadComponent: () => import('./features/practical-info/practical-info-detail/practical-info-detail').then(m => m.PracticalInfoDetail),
          },
        ]
      },
      { path: 'auth', redirectTo: '', pathMatch: 'full' },
      { path: 'auth/forgot-password', redirectTo: '', pathMatch: 'full' },
      // Real locale, unknown path beneath it (e.g. /en/xx) — resolves to
      // that locale's home *within* this route's own children, rather than
      // falling out to the top-level `**` below. Found live: letting an
      // unmatched deep path fall out of a matched `:lang` and re-enter the
      // top-level route array (to be redirected back in with a locale
      // prefix again) sent the Router's recognizer into a spin that hung
      // every request the Node process was serving, not just this one.
      { path: '**', redirectTo: '' },
    ],
  },
  // Single-admin-only section, deliberately outside the :lang/MainLayout tree - not a
  // localized public page. :lang's canMatch already rejects 'admin' as an unrecognized locale,
  // so this only needs to come before bareLangMatcher below (which would otherwise sweep it
  // into the unprefixed -> /en redirect).
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-shell/admin-shell').then(m => m.AdminShell),
    children: [
      { path: '', redirectTo: 'hikes', pathMatch: 'full' },
      {
        path: 'hikes',
        loadComponent: () => import('./features/admin/admin-hikes/admin-hikes').then(m => m.AdminHikes),
      },
    ],
  },
  // Anything whose first segment isn't a recognized locale — including bare
  // `/` — is treated as unprefixed and redirected to its English equivalent.
  {
    matcher: bareLangMatcher,
    redirectTo: data => {
      const rest = data.url.map(s => s.path).join('/');
      return rest ? `/${DEFAULT_LANG}/${rest}` : `/${DEFAULT_LANG}`;
    },
  },
];
