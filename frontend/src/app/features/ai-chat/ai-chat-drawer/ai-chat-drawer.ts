import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AiChat, ChatCard, ChatStatus } from '../../../shared/services/ai-chat';
import { Billing } from '../../../shared/services/billing';
import { Drawer } from '../../../shared/services/drawer';
import { Toast } from '../../../core/services/toast';
import { TrailThumbnail } from '../../../shared/trail-thumbnail/trail-thumbnail';
import { formatDistanceKmMi } from '../../../shared/utils/distance';
import { formatChatText } from '../../../shared/utils/chat-markdown';
import { buildForecastViewModel, DailyForecast } from '../../../models/weather';
import { TripConnection } from '../../../models/trip';
import type { HikeDetailPayload } from '../../hikes/hike-detail/hike-detail';
import type { BikeDetailPayload } from '../../bikes/bike-detail/bike-detail';

interface Suggestion {
  icon: string;
  labelKey: string;
}

const CONTEXT_SUGGESTIONS: Suggestion[] = [
  { icon: 'fa-light fa-cloud-sun', labelKey: 'aiChat.suggestion.weatherHere' },
  { icon: 'fa-light fa-person-hiking', labelKey: 'aiChat.suggestion.nearbyHikes' },
  { icon: 'fa-light fa-train', labelKey: 'aiChat.suggestion.gettingHere' },
];

const GENERIC_SUGGESTIONS: Suggestion[] = [
  { icon: 'fa-light fa-map-location-dot', labelKey: 'aiChat.suggestion.whatToDoBern' },
  { icon: 'fa-light fa-cloud-sun', labelKey: 'aiChat.suggestion.weatherZermatt' },
  { icon: 'fa-light fa-person-hiking', labelKey: 'aiChat.suggestion.recommendHike' },
  { icon: 'fa-light fa-train', labelKey: 'aiChat.suggestion.trainToSpiez' },
];

@Component({
  selector: 'app-ai-chat-drawer',
  standalone: true,
  imports: [FormsModule, TranslatePipe, DecimalPipe, TrailThumbnail],
  templateUrl: './ai-chat-drawer.html',
  styleUrl: './ai-chat-drawer.css',
})
export class AiChatDrawer {
  chat = inject(AiChat);
  private billing = inject(Billing);
  private drawerSvc = inject(Drawer);
  private translate = inject(TranslateService);
  private toast = inject(Toast);

  draft = signal('');
  subscribingPlan = signal<'monthly' | 'yearly' | null>(null);

  contextName = computed(() => this.chat.contextEntityName());

  suggestions = computed<Suggestion[]>(() => this.contextName() ? CONTEXT_SUGGESTIONS : GENERIC_SUGGESTIONS);

  constructor() {
    if (this.chat.auth.isLoggedIn()) this.chat.refreshUsage();
  }

  async subscribe(plan: 'monthly' | 'yearly'): Promise<void> {
    this.subscribingPlan.set(plan);
    try {
      await this.billing.startCheckout(plan);
    } catch {
      this.toast.error(
        this.translate.instant('billing.checkoutFailed'),
        this.translate.instant('billing.checkoutFailedDetail'),
        4000,
        'toast-error',
      );
    } finally {
      this.subscribingPlan.set(null);
    }
  }

  send(text?: string): void {
    const value = text ?? this.draft();
    this.draft.set('');
    this.chat.sendMessage(value);
  }

  onSuggestionClick(suggestion: Suggestion): void {
    this.send(this.translate.instant(suggestion.labelKey));
  }

  /** aiChat.status.<tool> keys carry the {{query}}/{{from}}/{{to}} placeholders each tool can
   * fill in; a tool with none just renders a plain label. */
  statusLabel(status: ChatStatus): string {
    return this.translate.instant(`aiChat.status.${status.tool}`, {
      query: status.input?.['query'] ?? '',
      from: status.input?.['from'] ?? '',
      to: status.input?.['to'] ?? '',
    });
  }

  onCardClick(card: ChatCard): void {
    if (card.type === 'weather') {
      this.drawerSvc.open('weather', { lat: card.lat, lon: card.lon });
      return;
    }
    if (card.type === 'destination') {
      this.drawerSvc.open('destination-detail', card.destination);
      return;
    }
    if (card.type === 'attractions') {
      this.drawerSvc.open('all-attractions', { destination: card.destination, origin: 'ai-chat' });
      return;
    }
    if (card.type === 'connections') {
      // Not tappable — no connections drawer to open (see the ai-chat-conn-card template branch).
      return;
    }
    const payload: HikeDetailPayload | BikeDetailPayload = { route: card.route, source: 'ai-chat' };
    this.drawerSvc.open(card.type === 'bike' ? 'bike-detail' : 'hike-detail', payload);
  }

  formatDistance(km: number): string {
    return formatDistanceKmMi(km);
  }

  formatText(text: string): string {
    return formatChatText(text);
  }

  /** Same formatting as trip-planner's connection-leg-picker, so a departure shown here reads
   * identically to one shown there. */
  formatConnTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso.slice(11, 16) : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  formatConnDuration(raw: string): string {
    if (!raw) return '';
    const match = raw.match(/(\d+)d(\d+):(\d+)/);
    if (!match) return raw;
    const days = parseInt(match[1]), hrs = parseInt(match[2]), mins = parseInt(match[3]);
    const totalHrs = days * 24 + hrs;
    return totalHrs > 0 ? `${totalHrs}h ${mins}m` : `${mins}m`;
  }

  formatConnPlatform(platform?: string): string {
    return platform ? `Pl. ${platform}` : '';
  }

  connTrainColor(category: string): string {
    const longDistance = ['IC', 'ICN', 'IR', 'EC', 'EN', 'TGV', 'RJX'];
    return longDistance.includes(category?.toUpperCase()) ? '#dc2626' : '#0079c3';
  }

  /** Tracks which connection rows have their leg-by-leg detail expanded — answers a "show me the
   * legs of the 12:08" follow-up by revealing data already on the card, rather than asking the
   * model to narrate stop-by-stop timing it was never given (see aiAgent.js's system prompt). */
  private expandedConnections = signal<ReadonlySet<TripConnection>>(new Set());

  isConnExpanded(conn: TripConnection): boolean {
    return this.expandedConnections().has(conn);
  }

  toggleConn(conn: TripConnection): void {
    const next = new Set(this.expandedConnections());
    next.has(conn) ? next.delete(conn) : next.add(conn);
    this.expandedConnections.set(next);
  }

  /** get_weather's raw Open-Meteo payload, reduced to today's forecast for the compact card —
   * reuses the same buildForecastViewModel() the full weather drawer is built from. */
  todayForecast(data: unknown): DailyForecast | null {
    try {
      return buildForecastViewModel(data).days[0] ?? null;
    } catch {
      return null;
    }
  }
}
