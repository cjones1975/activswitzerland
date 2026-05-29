import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { GalleriaModule } from 'primeng/galleria';
import { Drawer } from '../../../shared/services/drawer';
import { Destination } from '../../../models/destination';

@Component({
  selector: 'app-destination-detail',
  standalone: true,
  imports: [TranslatePipe, GalleriaModule],
  templateUrl: './destination-detail.html',
  styleUrl: './destination-detail.css',
})
export class DestinationDetail {
  private drawerSvc = inject(Drawer);

  destination = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<Destination>('destination-detail') ?? null;
  });
}
