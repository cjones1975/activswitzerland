import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DestinationHorizontalList } from '../destinations/destination-horizontal-list/destination-horizontal-list';
import { Drawer } from '../../shared/services/drawer';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TranslatePipe, DestinationHorizontalList],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private drawer = inject(Drawer);

  openTripPlanner(): void {
    this.drawer.open('trip-planner');
  }
}
