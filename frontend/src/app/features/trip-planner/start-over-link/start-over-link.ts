import { Component, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { TripPlannerService } from '../../../shared/services/trip-planner';

@Component({
  selector: 'app-start-over-link',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './start-over-link.html',
  styleUrl: './start-over-link.css',
})
export class StartOverLink {
  plannerSvc = inject(TripPlannerService);
  private confirmSvc = inject(ConfirmationService);
  private translate = inject(TranslateService);

  confirmStartOver(): void {
    this.confirmSvc.confirm({
      message: this.translate.instant('trip.planner.startOverConfirm'),
      header: this.translate.instant('trip.planner.startOver'),
      icon: 'fa-light fa-triangle-exclamation',
      acceptLabel: this.translate.instant('trip.planner.startOver'),
      rejectLabel: this.translate.instant('trip.planner.cancel'),
      acceptButtonStyleClass: 'start-over-accept-btn',
      accept: () => this.plannerSvc.reset(),
    });
  }
}
