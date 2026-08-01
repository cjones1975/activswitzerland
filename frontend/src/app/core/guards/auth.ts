import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { LangService } from '../../shared/services/lang';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const langSvc = inject(LangService);

  return auth.isLoggedIn() ? true : router.parseUrl(`/${langSvc.current}`);
};