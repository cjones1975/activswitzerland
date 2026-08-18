import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { Lang, LangService, stripLocalePrefix } from '../../shared/services/lang';

interface DesktopNoticeSlide {
  src: string;
  captionKey: string;
}

const SLIDES: DesktopNoticeSlide[] = [
  { src: '/assets/mobile1.png', captionKey: 'desktopNotice.slides.explore' },
  { src: '/assets/mobile2.png', captionKey: 'desktopNotice.slides.cityBreak' },
  { src: '/assets/mobile3.png', captionKey: 'desktopNotice.slides.attractions' },
  { src: '/assets/mobile4.png', captionKey: 'desktopNotice.slides.search' },
  { src: '/assets/mobile5.png', captionKey: 'desktopNotice.slides.planTrip' },
  { src: '/assets/mobile6.png', captionKey: 'desktopNotice.slides.sharedTrips' },
];

@Component({
  selector: 'app-desktop-notice',
  imports: [TranslatePipe, FormsModule, Select],
  templateUrl: './desktop-notice.html',
  styleUrl: './desktop-notice.css',
})
export class DesktopNotice {
  protected langSvc = inject(LangService);
  private router = inject(Router);

  protected readonly slides = SLIDES;
  protected readonly activeIndex = signal(0);

  protected readonly languages = [
    { label: 'English', value: 'en' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Français', value: 'fr' },
    { label: 'Italiano', value: 'it' },
  ];

  protected selectedLang = this.langSvc.current;

  next() {
    this.activeIndex.update(i => (i + 1) % this.slides.length);
  }

  prev() {
    this.activeIndex.update(i => (i - 1 + this.slides.length) % this.slides.length);
  }

  goTo(index: number) {
    this.activeIndex.set(index);
  }

  /** Same locale-swap logic as MenuNav.changeLanguage — navigates to the current URL's
   *  locale-swapped equivalent rather than swapping the language in place. */
  changeLanguage(lang: Lang): void {
    const [path, query] = this.router.url.split('?');
    const rest = stripLocalePrefix(path);
    const newUrl = `/${lang}${rest === '/' ? '' : rest}${query ? '?' + query : ''}`;
    this.router.navigateByUrl(newUrl);
  }
}
