import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

// Footer strip crediting Switzerland Tourism on cards built from MySwitzerland data, with a back
// link to the original myswitzerland.com page. Same look as the hike/bike cards' SwitzerlandMobility
// strip (.trail-attribution). Must not sit inside another <a> — cards that are themselves links
// render it as a sibling of their link instead.
@Component({
  selector: 'app-mys-attribution',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './mys-attribution.html',
  styleUrl: './mys-attribution.css',
})
export class MysAttribution {
  url = input<string | undefined>();
}
