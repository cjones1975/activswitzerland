import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DestinationsLayout } from '../../shell/destinations-layout/destinations-layout';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TranslatePipe, DestinationsLayout],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {}
