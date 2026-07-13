import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-hotels-stub',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './hotels-stub.html',
  styleUrl: './hotels-stub.css',
})
export class HotelsStub {
}
