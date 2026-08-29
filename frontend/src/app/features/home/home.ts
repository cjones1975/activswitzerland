import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';
import { DestinationHorizontalList } from '../destinations/destination-horizontal-list/destination-horizontal-list';
import { SearchBox, SearchTab } from '../search/search-box/search-box';
import { LangService } from '../../shared/services/lang';
import { SeoService } from '../../shared/services/seo';
import { Drawer } from '../../shared/services/drawer';
import { PRACTICAL_INFO_CATEGORIES, PracticalInfoKey } from '../../models/practical-info-category';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TranslatePipe, DestinationHorizontalList, SearchBox, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private router = inject(Router);
  private translate = inject(TranslateService);
  protected langSvc = inject(LangService);
  private seo = inject(SeoService);
  private destroyRef = inject(DestroyRef);
  private drawer = inject(Drawer);

  protected practicalInfoCategories = (Object.keys(PRACTICAL_INFO_CATEGORIES) as PracticalInfoKey[])
    .map(key => ({ key, config: PRACTICAL_INFO_CATEGORIES[key] }));

  ngOnInit(): void {
    this.translate.onLangChange.pipe(
      startWith({ lang: this.langSvc.current }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.seo.set({
        title: this.translate.instant('seo.home.title'),
        description: this.translate.instant('seo.home.description'),
      });
    });
  }

  openTripPlanner(): void {
    this.langSvc.navigate(['trip-planner'], { queryParams: { from: this.router.url } });
  }

  openAiChat(): void {
    this.drawer.open('ai-chat');
  }

  onSearch(event: { query: string; tab: SearchTab }): void {
    this.langSvc.navigate(['search'], { queryParams: { q: event.query, tab: event.tab } });
  }
}
