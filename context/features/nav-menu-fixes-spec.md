# Nav Menu Fixes

## Overview

Six small fixes to the header brand link and the `menu-nav` side drawer: dead/missing routes, a stale label, a missing Profile link, an auth-aware Log In / Log Out button, and closing the drawer on language change.

---

## 1. Brand logo → `/`

`@frontend/src/app/shell/header-nav/header-nav.html`:

- Change `<span class="brand">ActivSwitzerland</span>` to `<a class="brand" routerLink="/">ActivSwitzerland</a>`.
- Add `RouterLink` to `HeaderNav`'s `imports`.
- `@frontend/src/app/shell/header-nav/header-nav.css`: add `text-decoration: none;` and `cursor: pointer;` to `.brand` so the anchor doesn't pick up default link styling.

---

## 2. 'Home' nav item → `/`

`@frontend/src/app/shell/menu-nav/menu-nav.html`:

- Add `routerLink="/"` and `(click)="closeMenu()"` to the first `<li class="nav-item">` (the one labelled `nav.home`).
- Add `RouterLink` to `MenuNav`'s `imports`.

`@frontend/src/app/shell/menu-nav/menu-nav.ts`:

- Add a `closeMenu()` method: `this.drawer.close('menu-nav')`. Used by every nav item that navigates away, so the drawer doesn't stay open over the new page (mirrors the existing `drawer.close('menu-nav')` call in `openAuth()`).

---

## 3. 'Map Planner' → 'Trip Planner', routes to `/trip-planner`

`@frontend/src/app/shell/menu-nav/menu-nav.html`:

- Third `<li class="nav-item">`: change label key from `nav.mapplanner` to `nav.tripplanner`, add `routerLink="/trip-planner"` and `(click)="closeMenu()"`. Icon (`pi-map`) unchanged.

i18n — rename `nav.mapplanner` → `nav.tripplanner` in all four locale files, with translated values:

| Locale | Value |
| --- | --- |
| en | Trip Planner |
| de | Reiseplaner |
| fr | Planificateur de voyage |
| it | Pianificatore di viaggio |

---

## 4. Profile link (logged-in only), placed under 'Trip Planner'

`@frontend/src/app/shell/menu-nav/menu-nav.html`:

- New `<li class="nav-item">` after the Trip Planner item, wrapped in `@if (auth.isLoggedIn())`:
  - Icon `pi-user` in `.nav-icon-box`
  - Label `{{ 'nav.profile' | translate }}`
  - `routerLink="/auth/profile"`, `(click)="closeMenu()"`
  - Trailing `pi-chevron-right` to match the other items

`@frontend/src/app/shell/menu-nav/menu-nav.ts`:

- Inject `Auth` from `@frontend/src/app/core/services/auth.ts` as `protected auth = inject(Auth)` so the template can read `auth.isLoggedIn()`.

i18n — add `nav.profile` to all four locale files:

| Locale | Value |
| --- | --- |
| en | Profile |
| de | Profil |
| fr | Profil |
| it | Profilo |

---

## 5. Log In / Log Out button

`@frontend/src/app/shell/menu-nav/menu-nav.html`, `.nav-actions` button:

```html
<button class="login-btn" type="button" (click)="onAuthAction()">
    <i [class]="auth.isLoggedIn() ? 'pi pi-sign-out' : 'pi pi-sign-in'"></i>
    <span>{{ (auth.isLoggedIn() ? 'nav.logout' : 'nav.login') | translate }}</span>
    <i class="pi pi-chevron-right"></i>
</button>
```

`@frontend/src/app/shell/menu-nav/menu-nav.ts`:

- `onAuthAction()`:
  ```typescript
  onAuthAction(): void {
    if (this.auth.isLoggedIn()) {
      this.auth.logout();
      this.closeMenu();
      this.router.navigate(['/']);
    } else {
      this.openAuth();
    }
  }
  ```
- Inject `Router`. `openAuth()` is unchanged (still closes `menu-nav` and opens the `auth` drawer for the logged-out case).
- Logout-then-navigate-to-`/` mirrors `Profile.signOut()`.

i18n — add `nav.login` and `nav.logout` to all four locale files (the current `<span>Log In</span>` is hardcoded English; this makes it translated too):

| Locale | login | logout |
| --- | --- | --- |
| en | Log In | Log out |
| de | Anmelden | Abmelden |
| fr | Connexion | Se déconnecter |
| it | Accedi | Esci |

(de/fr/it values match the existing `auth.tabs.login` / `profile.signout` translations for consistency.)

---

## 6. Close menu drawer on language change

`@frontend/src/app/shell/menu-nav/menu-nav.ts`, `changeLanguage()`:

```typescript
changeLanguage(lang: string): void {
  this.langSvc.set(lang);
  this.closeMenu();
}
```

---

## Out of Scope

- 'Explore' nav item remains unrouted (no target page yet).
- No changes to `DrawerHost`, `Drawer` service, or drawer stacking/z-index behavior.
- No changes to `FooterNav` (already correctly routes to `/auth/profile`).

---

## References

- @frontend/src/app/shell/header-nav/header-nav.html
- @frontend/src/app/shell/header-nav/header-nav.ts
- @frontend/src/app/shell/header-nav/header-nav.css
- @frontend/src/app/shell/menu-nav/menu-nav.html
- @frontend/src/app/shell/menu-nav/menu-nav.ts
- @frontend/src/app/core/services/auth.ts
- @frontend/src/app/features/auth/profile/profile.ts
- @frontend/public/i18n/en.json (and de/fr/it)
