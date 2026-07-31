import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';
import { LangService } from '../../shared/services/lang';
import { SeoService } from '../../shared/services/seo';

@Component({
  selector: 'app-explore-trips',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './explore-trips.html',
  styleUrl: './explore-trips.css',
})
export class ExploreTrips implements OnInit {
  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  private seo = inject(SeoService);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.translate.onLangChange.pipe(
      startWith({ lang: this.langSvc.current }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.seo.set({
        title: this.translate.instant('seo.exploreTrips.title'),
        description: this.translate.instant('seo.exploreTrips.description'),
      });
    });
  }
}
