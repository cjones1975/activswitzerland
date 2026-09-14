import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.isLoggedIn()) return router.parseUrl('/');

  try {
    const me = await auth.getMe();
    return me.isAdmin ? true : router.parseUrl('/');
  } catch {
    return router.parseUrl('/');
  }
};
