import { Component, computed, inject } from '@angular/core';
import { Drawer } from '../../../shared/services/drawer';
import { Attraction } from '../../../models/attraction';
import { Destination } from '../../../models/destination';

export interface AttractionDetailPayload {
  attraction: Attraction;
  destination: Destination;
  source: 'destination-detail' | 'all-attractions';
}

@Component({
  selector: 'app-attraction-detail',
  standalone: true,
  imports: [],
  templateUrl: './attraction-detail.html',
  styleUrl: './attraction-detail.css',
})
export class AttractionDetail {
  private drawerSvc = inject(Drawer);

  payload = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<AttractionDetailPayload>('attraction-detail') ?? null;
  });
}
