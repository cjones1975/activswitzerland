import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Auth } from '../services/auth';

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('http://localhost:3000')) return next(req);

  const token = inject(Auth).token();

  if (!token) return next(req);

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  }));
};
