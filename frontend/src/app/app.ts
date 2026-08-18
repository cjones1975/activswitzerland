import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { PrimeTemplate } from 'primeng/api';
import { SeoService } from './shared/services/seo';
import { Breakpoint } from './shared/services/breakpoint';
import { DesktopNotice } from './shell/desktop-notice/desktop-notice';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, PrimeTemplate, DesktopNotice],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
  protected readonly breakpoint = inject(Breakpoint);

  constructor() {
    inject(SeoService).setWebsite();
  }
}
