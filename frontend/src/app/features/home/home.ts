import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { DestinationHorizontalList } from '../destinations/destination-horizontal-list/destination-horizontal-list';
import { SearchBox } from '../search/search-box/search-box';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TranslatePipe, DestinationHorizontalList, SearchBox],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private router = inject(Router);

  openTripPlanner(): void {
    this.router.navigate(['/trip-planner']);
  }

  onSearch(event: { query: string; tab: 'places' | 'things' }): void {
    this.router.navigate(['/search'], { queryParams: { q: event.query, tab: event.tab } });
  }
}
