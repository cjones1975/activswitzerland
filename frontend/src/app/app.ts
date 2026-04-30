import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { PrimeTemplate } from 'primeng/api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, PrimeTemplate],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
}
