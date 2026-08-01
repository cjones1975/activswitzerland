import { Routes } from '@angular/router';
import { MainLayout } from './shell/main-layout/main-layout';
import { Home } from './features/home/home';
import { DestinationVerticalList } from './features/destinations/destination-vertical-list/destination-vertical-list';
import { DestinationsLayout } from './shell/destinations-layout/destinations-layout';
import { TripPlannerLayout } from './shell/trip-planner-layout/trip-planner-layout';
import { Profile } from './features/auth/profile/profile';
import { ExploreTrips } from './features/explore-trips/explore-trips';
import { SearchPage } from './features/search/search-page/search-page';
import { authGuard } from './core/guards/auth';
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
          { path: 'destinations', component: DestinationVerticalList },
          { path: 'destinations/:id', component: DestinationsLayout },
          { path: 'trip-planner', component: TripPlannerLayout },
          { path: 'trip-planner/:id', component: TripPlannerLayout },
          { path: 'explore-trips', component: ExploreTrips },
          { path: 'search', component: SearchPage },
        ]
      },
      { path: 'auth', redirectTo: '', pathMatch: 'full' },
      { path: 'auth/forgot-password', redirectTo: '', pathMatch: 'full' },
      {
        path: 'auth/profile',
        component: Profile,
        canActivate: [authGuard],
      },
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
