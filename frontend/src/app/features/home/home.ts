import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
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
  private router = inject(Router);

  openTripPlanner(): void {
    this.router.navigate(['/destinations']);
    this.drawer.open('trip-planner');
  }
}
