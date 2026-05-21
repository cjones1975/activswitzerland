import { Component } from '@angular/core';
import { DestinationHorizontalList } from '../../features/destinations/destination-horizontal-list/destination-horizontal-list';

@Component({
  selector: 'app-destinations-layout',
  standalone: true,
  imports: [DestinationHorizontalList],
  templateUrl: './destinations-layout.html',
  styleUrl: './destinations-layout.css',
})
export class DestinationsLayout {}
