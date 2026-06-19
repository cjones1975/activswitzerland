import { Component, DestroyRef, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { GalleriaModule } from 'primeng/galleria';
import { SkeletonModule } from 'primeng/skeleton';
import { Message } from 'primeng/message';
import { Subject, switchMap, catchError, of } from 'rxjs';
import { Drawer } from '../../../shared/services/drawer';
import { AttractionsService } from '../../../shared/services/attractions';
import { AttractionMarkersService } from '../../../shared/services/attraction-markers';
import { LangService } from '../../../shared/services/lang';
import { Attraction } from '../../../models/attraction';
import { Destination } from '../../../models/destination';
import { TripStop } from '../../../models/trip';

export interface AttractionDetailPayload {
  attraction: Attraction;
  destination?: Destination;
  stop?: TripStop;
  source: 'destination-detail' | 'all-attractions' | 'things-to-do' | 'trip-planner';
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  it: 'Italian',
};

@Component({
  selector: 'app-attraction-detail',
  standalone: true,
  imports: [TranslatePipe, GalleriaModule, SkeletonModule, Message],
  templateUrl: './attraction-detail.html',
  styleUrl: './attraction-detail.css',
})
export class AttractionDetail implements OnDestroy {
  private drawerSvc = inject(Drawer);
  private attractionsService = inject(AttractionsService);
  private attractionMarkers = inject(AttractionMarkersService);
  private langSvc = inject(LangService);
  private destroyRef = inject(DestroyRef);

  payload = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<AttractionDetailPayload>('attraction-detail') ?? null;
  });

  fullAttraction = signal<Attraction | null>(null);
  loading = signal(false);
  loadError = signal(false);

  private fetchTrigger$ = new Subject<{ id: string; lang: string }>();

  neededTime = computed(() => {
    console.log(this.fullAttraction());
    const c = this.fullAttraction()?.classification?.find(cl => cl.name === 'neededtime');
    return c?.values?.[0]?.title ?? null;
  });

  wheelchairAccess = computed(() => {
    const c = this.fullAttraction()?.classification?.find(cl => cl.name === 'wheelchairaccessibleclassifications');
    return c?.values?.[0]?.title ?? null;
  });

  spokenLanguages = computed(() => {
    const langs = this.fullAttraction()?.availableLanguage;
    if (!langs?.length) return null;
    return langs.map(l => LANG_NAMES[l.alternateName] ?? l.alternateName);
  });

  groupSize = computed(() => {
    const ev = this.fullAttraction()?.event;
    if (ev?.audience?.audienceType !== 'Groups') return null;
    const min = ev?.minimumAttendeeCapacity;
    const max = ev?.maximumAttendeeCapacity;
    if (min == null || max == null) return null;
    return { min, max };
  });

  priceInfo = computed(() => {
    const p = this.fullAttraction()?.price;
    if (p?.minPrice == null) return null;
    return `${p.minPrice} ${p.priceCurrency ?? ''}`.trim();
  });

  hasAddress = computed(() => {
    const addr = this.fullAttraction()?.address;
    return Array.isArray(addr) && addr.length > 0;
  });

  constructor() {
    this.fetchTrigger$.pipe(
      switchMap(({ id, lang }) => {
        this.loading.set(true);
        this.loadError.set(false);
        return this.attractionsService.getAttraction(id, lang).pipe(
          catchError(() => of(null)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(attraction => {
      if (!attraction) {
        this.loading.set(false);
        this.loadError.set(true);
        return;
      }
      this.fullAttraction.set(attraction);
      this.loading.set(false);
    });

    effect(() => {
      const p = this.payload();
      if (!p) { this.fullAttraction.set(null); this.loadError.set(false); return; }
      const lang = this.langSvc.current;
      untracked(() => {
        this.fetchTrigger$.next({ id: p.attraction.identifier, lang });
        this.attractionMarkers.setSelected(p.attraction.identifier);
      });
    });
  }

  formatAddressLine(addr: { streetAddress?: string; postalCode?: string; addressLocality?: string }): string {
    return [addr.streetAddress, addr.postalCode, addr.addressLocality].filter(v => !!v).join(', ');
  }

  ngOnDestroy(): void {
    this.attractionMarkers.setSelected(null);
  }
}
