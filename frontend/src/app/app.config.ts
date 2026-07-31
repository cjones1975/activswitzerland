import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { I18nLoader } from './shared/services/i18n-loader';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { tokenInterceptor } from './core/interceptors/token.interceptor';
import { ssrBaseUrlInterceptor } from './core/interceptors/ssr-base-url.interceptor';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

const MyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f3f6f8',
      100: '#dce6ee',
      200: '#b8cddd',
      300: '#94b4cc',
      400: '#709bbb',
      500: '#4f83aa',
      600: '#3f6d90',
      700: '#315775',
      800: '#25425b',
      900: '#1a2f4a',
      950: '#1a2f4a',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideTranslateService({
      loader: { provide: TranslateLoader, useClass: I18nLoader },
      fallbackLang: 'en',
      lang: 'en',
    }),
    provideHttpClient(withFetch(), withInterceptors([ssrBaseUrlInterceptor, tokenInterceptor])),
    provideRouter(routes),
    provideAnimationsAsync(),
    MessageService,
    providePrimeNG({
      theme: {
        preset: MyPreset,
        options: {
          darkModeSelector: '.dark',
        },
      },
    }),
    provideClientHydration(withEventReplay()),
  ],
};
