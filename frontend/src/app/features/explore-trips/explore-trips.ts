import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-explore-trips',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './explore-trips.html',
  styleUrl: './explore-trips.css',
})
export class ExploreTrips {}
