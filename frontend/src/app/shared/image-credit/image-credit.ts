import { Component, computed, input } from '@angular/core';
import { creditLabel } from './credit-label';

// Small "© holder" chip pinned to the bottom-right of a MySwitzerland photo, as their terms ask
// that image copyright be observed. The parent must be the photo's positioning context
// (position: relative/absolute). Renders nothing when there is no name to credit — see
// credit-label.ts for how usage terms are left out.
@Component({
  selector: 'app-image-credit',
  standalone: true,
  template: `@if (label(); as text) {<span [title]="text">{{ text }}</span>}`,
  styleUrl: './image-credit.css',
})
export class ImageCredit {
  holder = input<string | undefined>();

  label = computed(() => creditLabel(this.holder()));
}
