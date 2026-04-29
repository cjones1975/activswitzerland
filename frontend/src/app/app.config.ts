import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';


import { routes } from './app.routes';

const MyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '#f3f6f8',
      100: '#dce6ee',
      200: '#b8cddd',
      300: '#94b4cc',
      400: '#709bbb',
      500: '#4f83aa',
      600: '#3f6d90',
      700: '#315775',
      800: '#25425b',
      900: '#1a2f4a',
      950: '#1a2f4a'
    }
  }
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/i18n/',
        suffix: '.json'
      }),
      fallbackLang: 'en',
      lang: 'en'
    }),
    provideRouter(routes),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: MyPreset,
        options: {
          darkModeSelector: '.dark'
        }
      }
    })
  ]
};
