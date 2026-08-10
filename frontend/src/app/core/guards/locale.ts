import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { CanMatchFn, ResolveFn, UrlMatcher, UrlSegment } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { DEFAULT_LANG, SUPPORTED_LANGS } from '../../shared/services/lang';

function hasLocalePrefix(segments: UrlSegment[]): boolean {
  return segments.length > 0 && (SUPPORTED_LANGS as readonly string[]).includes(segments[0].path);
}

/** Restricts the `:lang` route to real locale segments, so a garbage value falls through to the bare-path redirect instead of matching and 404ing deep in the child tree. */
export const localeMatchGuard: CanMatchFn = (_route, segments) => hasLocalePrefix(segments);

/**
 * Matches any URL that doesn't already start with a real locale segment —
 * used (instead of a `canMatch` guard) to gate the bare-path redirect route.
 * Angular rejects combining `redirectTo` with `canMatch`/`canActivate` on
 * the same route ("redirects happen before guards are executed" —
 * NG04014), so a custom matcher is the only way to make this redirect
 * conditional at all.
 */
export const bareLangMatcher: UrlMatcher = segments =>
  hasLocalePrefix(segments) ? null : { consumed: segments };

/** Activates the matched `:lang` segment's translations before any child route renders. */
export const localeLangResolver: ResolveFn<string> = route => {
  const translate = inject(TranslateService);
  const document = inject(DOCUMENT);
  const lang = route.paramMap.get('lang') ?? DEFAULT_LANG;
  translate.use(lang);
  document.documentElement.lang = lang;
  return lang;
};
