import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Drawer } from '../../../shared/services/drawer';
import { HotelsService } from '../../../shared/services/hotels';
import { LangService } from '../../../shared/services/lang';
import { Destination } from '../../../models/destination';
import { formatIsoDate } from '../../../shared/utils/date-range';

@Component({
  selector: 'app-hotel-search',
  standalone: true,
  imports: [FormsModule, TranslatePipe, DatePicker, InputNumber, Select, Button, Message],
  templateUrl: './hotel-search.html',
  styleUrl: './hotel-search.css',
})
export class HotelSearch {
  private drawerSvc = inject(Drawer);
  private hotelsSvc = inject(HotelsService);
  private langSvc = inject(LangService);

  readonly currencies = ['CHF', 'EUR', 'GBP', 'USD'];

  destination = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<{ destination: Destination }>('hotels')?.destination ?? null;
  });

  readonly minDate = new Date();

  private readonly tomorrow = new Date(this.minDate.getFullYear(), this.minDate.getMonth(), this.minDate.getDate() + 1);
  private readonly dayAfter = new Date(this.minDate.getFullYear(), this.minDate.getMonth(), this.minDate.getDate() + 2);

  dateRange = signal<(Date | null)[] | null>([this.tomorrow, this.dayAfter]);
  adults = signal(2);
  children = signal(0);
  rooms = signal(1);
  currency = signal('CHF');

  loading = signal(false);
  loadError = signal(false);

  // A range picker allows picking the same day twice (a 0-night "stay"), which Booking.com's own
  // search doesn't accept either — checkout must be strictly after checkin, not just non-null.
  hasMinStay = computed(() => {
    const [start, end] = this.dateRange() ?? [null, null];
    return !!(start && end && end.getTime() > start.getTime());
  });

  canSearch = computed(() => {
    return this.hasMinStay() && this.adults() >= 1 && this.rooms() >= 1 && this.children() >= 0 && !this.loading();
  });

  // Distinct from !hasMinStay(): only true once both dates are actually picked and invalid, not
  // while the user is still mid-selection (end still null after only the first click).
  showMinStayError = computed(() => {
    const [start, end] = this.dateRange() ?? [null, null];
    return !!(start && end && end.getTime() <= start.getTime());
  });

  onDateRangeChange(value: (Date | null)[] | null): void {
    this.dateRange.set(value);
  }

  onAdultsChange(value: number | null): void {
    if (value != null && value >= 1) this.adults.set(value);
  }

  onChildrenChange(value: number | null): void {
    if (value != null && value >= 0) this.children.set(value);
  }

  onRoomsChange(value: number | null): void {
    if (value != null && value >= 1) this.rooms.set(value);
  }

  search(): void {
    const dest = this.destination();
    const [start, end] = this.dateRange() ?? [null, null];
    if (!dest || !this.hasMinStay() || !start || !end) return;

    this.loading.set(true);
    this.loadError.set(false);

    this.hotelsSvc.getDeeplink({
      identifier: dest.identifier,
      checkin: formatIsoDate(start) ?? '',
      checkout: formatIsoDate(end) ?? '',
      groupAdults: this.adults(),
      groupChildren: this.children(),
      noRooms: this.rooms(),
      currency: this.currency(),
      lang: this.langSvc.current,
    }).subscribe({
      next: (url) => {
        this.loading.set(false);
        window.open(url, '_blank', 'noopener');
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }
}
