import { Component, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { TripPlannerService } from '../../../shared/services/trip-planner';

// Keyed separately from the app's default toast (see trip-planner-wizard.html's own
// `<p-toast [key]="startOverKey">`) so this action toast never mixes with, or gets
// dismissed by, an unrelated success/error toast firing elsewhere in the wizard.
export const START_OVER_KEY = 'start-over-confirm';

@Component({
  selector: 'app-start-over-link',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './start-over-link.html',
  styleUrl: './start-over-link.css',
})
export class StartOverLink {
  plannerSvc = inject(TripPlannerService);
  private messageSvc = inject(MessageService);
  private translate = inject(TranslateService);

  confirmStartOver(): void {
    this.messageSvc.clear(START_OVER_KEY);
    this.messageSvc.add({
      key: START_OVER_KEY,
      severity: 'info',
      summary: this.translate.instant('trip.planner.startOver'),
      detail: this.translate.instant('trip.planner.startOverConfirm'),
      sticky: true,
      data: {
        onAccept: () => {
          this.plannerSvc.reset();
          this.messageSvc.clear(START_OVER_KEY);
        },
        onReject: () => this.messageSvc.clear(START_OVER_KEY),
      },
    });
  }
}
