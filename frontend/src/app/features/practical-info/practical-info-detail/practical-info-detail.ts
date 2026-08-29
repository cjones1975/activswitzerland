import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, combineLatest, startWith, switchMap, tap } from 'rxjs';
import { LangService } from '../../../shared/services/lang';
import { SeoService } from '../../../shared/services/seo';
import { Markdown } from '../../../shared/markdown/markdown';
import { PRACTICAL_INFO_CATEGORIES, PracticalInfoKey } from '../../../models/practical-info-category';

const HEADING_RE = /^#\s+(.+)\r?\n?/;

@Component({
  selector: 'app-practical-info-detail',
  standalone: true,
  imports: [TranslatePipe, RouterLink, Markdown],
  templateUrl: './practical-info-detail.html',
  styleUrl: './practical-info-detail.css',
})
export class PracticalInfoDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private translate = inject(TranslateService);
  private seo = inject(SeoService);
  private destroyRef = inject(DestroyRef);
  protected langSvc = inject(LangService);

  loading = signal(true);
  title = signal('');
  body = signal('');

  ngOnInit(): void {
    combineLatest([
      this.route.paramMap,
      this.translate.onLangChange.pipe(startWith({ lang: this.langSvc.current })),
    ]).pipe(
      tap(() => this.loading.set(true)),
      switchMap(([params, event]) => {
        const slug = params.get('slug') as PracticalInfoKey;
        const lang = event.lang;
        return this.http.get(`/content/practical-info/${slug}/${lang}.md`, { responseType: 'text' }).pipe(
          catchError(() => this.http.get(`/content/practical-info/${slug}/en.md`, { responseType: 'text' })),
          tap(md => this.applyContent(slug, md)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.loading.set(false));
  }

  private applyContent(slug: PracticalInfoKey, md: string): void {
    const match = HEADING_RE.exec(md);
    const labelKey = PRACTICAL_INFO_CATEGORIES[slug]?.label;
    const categoryLabel = labelKey ? this.translate.instant(labelKey) : '';
    const title = match ? match[1] : categoryLabel;

    this.title.set(title);
    this.body.set(match ? md.slice(match[0].length) : md);
    this.seo.set({ title, description: categoryLabel });
  }
}
