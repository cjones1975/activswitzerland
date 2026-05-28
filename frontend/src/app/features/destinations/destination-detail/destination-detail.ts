import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Destination } from '../../../models/destination';

@Component({
  selector: 'app-destination-detail',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './destination-detail.html',
  styleUrl: './destination-detail.css',
})
export class DestinationDetail {
  @Input() destination: Destination | null = null;
  @Output() close = new EventEmitter<void>();
}
