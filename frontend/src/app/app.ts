import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { PrimeTemplate } from 'primeng/api';
import { SeoService } from './shared/services/seo';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, PrimeTemplate],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');

  constructor() {
    inject(SeoService).setWebsite();
  }
}
