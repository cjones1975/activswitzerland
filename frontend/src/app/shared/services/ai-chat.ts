import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { Drawer } from './drawer';
import { Auth } from '../../core/services/auth';
import { TrailRoute } from '../../models/trail-route';
import { GeoLocation } from '../../models/geo-point';
import { Destination } from '../../models/destination';
import { TripConnection } from '../../models/trip';
import { ConnectionResult, mapConnectionResult } from '../utils/trip-sections';
import type { HikeDetailPayload } from '../../features/hikes/hike-detail/hike-detail';
import type { BikeDetailPayload } from '../../features/bikes/bike-detail/bike-detail';
import type { AttractionDetailPayload } from '../../features/attractions/attraction-detail/attraction-detail';

export type ChatCard =
  | { type: 'hike' | 'bike'; route: TrailRoute }
  | { type: 'weather'; data: unknown; lat: number; lon: number }
  | { type: 'destination'; destination: Destination }
  | { type: 'attractions'; destination: Destination; count: number }
  | { type: 'connections'; connections: TripConnection[]; from: string; to: string };

/** The wire shape — a connections card's `connections` arrive as raw `ConnectionResult`s (same
 * shape `ojp.js` produces, before TripConnection/TripSection mapping); every other card variant
 * matches `ChatCard` already. */
type RawChatCard =
  | Exclude<ChatCard, { type: 'connections' }>
  | { type: 'connections'; connections: ConnectionResult[]; from: string; to: string };

function toChatCard(raw: RawChatCard): ChatCard {
  if (raw.type === 'connections') {
    return { ...raw, connections: raw.connections.map(mapConnectionResult) };
  }
  return raw;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  cards?: ChatCard[];
}

/** A tool call the assistant is currently running — see aiChat.status.* i18n keys, keyed by
 * `tool`, for how this becomes a human-readable line in the UI. */
export interface ChatStatus {
  tool: string;
  input: Record<string, unknown>;
}

type ChatStreamEvent =
  | ({ type: 'status' } & ChatStatus)
  | { type: 'done'; conversationId: string; reply: { text: string; cards: RawChatCard[] } }
  | { type: 'error' };

@Injectable({ providedIn: 'root' })
export class AiChat {
  private drawerSvc = inject(Drawer);
  private translate = inject(TranslateService);
  auth = inject(Auth);

  readonly conversationId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly sending = signal(false);

  /** Free-trial message usage — one lifetime trial conversation capped at freeLimit user
   * messages, refreshed on drawer open and after every sent message. hasUnlimitedAccess folds in
   * both a real Stripe subscription and the app-side isExempt bypass (see
   * ai-chat-assistant-spec.md's Confirmed decisions), so this service never needs to know which
   * of the two applies. */
  readonly messagesUsed = signal(0);
  readonly freeLimit = signal(5);
  readonly hasUnlimitedAccess = signal(false);
  readonly usageChecked = signal(false);

  /** True once the free message limit is hit — including mid-conversation, since the cap is a
   * lifetime message count, not a per-conversation grace. */
  readonly paywalled = computed(() =>
    this.usageChecked() && !this.hasUnlimitedAccess() && this.messagesUsed() >= this.freeLimit()
  );
  /** The tool call currently in flight, if any — null while the model is composing its final
   * reply (or hasn't started a tool call yet), driving the "Checking the forecast…" status row. */
  readonly currentStatus = signal<ChatStatus | null>(null);

  /** A short note on whatever's currently open behind/alongside the chat drawer, folded into the
   * next message so the assistant doesn't have to ask for a location it can already see. `null`
   * when nothing relevant is open (e.g. the homepage). */
  contextLabel(): string | null {
    const hike = this.drawerSvc.getPayload<HikeDetailPayload>('hike-detail');
    if (this.drawerSvc.isOpen('hike-detail') && hike) {
      return `Viewing the hiking trail "${hike.route.name}"`;
    }
    const bike = this.drawerSvc.getPayload<BikeDetailPayload>('bike-detail');
    if (this.drawerSvc.isOpen('bike-detail') && bike) {
      return `Viewing the biking route "${bike.route.name}"`;
    }
    const attraction = this.drawerSvc.getPayload<AttractionDetailPayload>('attraction-detail');
    if (this.drawerSvc.isOpen('attraction-detail') && attraction) {
      return `Viewing the attraction "${attraction.attraction.name}"`;
    }
    const destination = this.drawerSvc.getPayload<GeoLocation>('destination-detail');
    if (this.drawerSvc.isOpen('destination-detail') && destination) {
      return `Viewing the destination "${destination.name}"`;
    }
    return null;
  }

  /** Just the entity name, for the empty-state context chip — no "Viewing the …" framing. */
  contextEntityName(): string | null {
    const hike = this.drawerSvc.getPayload<HikeDetailPayload>('hike-detail');
    if (this.drawerSvc.isOpen('hike-detail') && hike) return hike.route.name;
    const bike = this.drawerSvc.getPayload<BikeDetailPayload>('bike-detail');
    if (this.drawerSvc.isOpen('bike-detail') && bike) return bike.route.name;
    const attraction = this.drawerSvc.getPayload<AttractionDetailPayload>('attraction-detail');
    if (this.drawerSvc.isOpen('attraction-detail') && attraction) return attraction.attraction.name;
    const destination = this.drawerSvc.getPayload<GeoLocation>('destination-detail');
    if (this.drawerSvc.isOpen('destination-detail') && destination) return destination.name;
    return null;
  }

  /** Fetches current free-conversation usage — call on drawer open and after a new conversation
   * successfully starts. Leaves prior values in place on failure (non-critical, best-effort). */
  async refreshUsage(): Promise<void> {
    if (!this.auth.isLoggedIn()) return;
    try {
      const headers: Record<string, string> = {};
      const token = this.auth.token();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${environment.apiUrl}/api/v1/ai/usage`, { headers });
      if (!response.ok) return;
      const { data } = await response.json();
      this.messagesUsed.set(data.messagesUsed);
      this.freeLimit.set(data.freeLimit);
      this.hasUnlimitedAccess.set(data.hasUnlimitedAccess);
      this.usageChecked.set(true);
    } catch {
      // stale values are fine — a failed check just means the paywall computed lags reality
    }
  }

  async sendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.sending() || this.paywalled()) return;

    if (!this.auth.isLoggedIn()) {
      this.drawerSvc.open('auth');
      return;
    }

    this.messages.set([...this.messages(), { role: 'user', text: trimmed }]);
    this.sending.set(true);
    this.currentStatus.set(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = this.auth.token();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${environment.apiUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversationId: this.conversationId(),
          message: trimmed,
          context: this.contextLabel(),
        }),
      });
      if (response.status === 402) {
        // Stale frontend state raced a just-exhausted limit — resync instead of showing an error.
        await this.refreshUsage();
        this.messages.set(this.messages().slice(0, -1));
        return;
      }
      if (!response.ok || !response.body) throw new Error('Request failed');

      await this.consumeStream(response.body);
      await this.refreshUsage();
    } catch {
      this.messages.set([
        ...this.messages(),
        { role: 'assistant', text: this.translate.instant('aiChat.error') },
      ]);
    } finally {
      this.sending.set(false);
      this.currentStatus.set(null);
    }
  }

  /** Reads the chat endpoint's SSE stream — a run of {type:'status'} progress events (see
   * ChatStatus) followed by exactly one {type:'done'} (success) or {type:'error'} event. Events
   * are newline-delimited `data: {...}\n\n` blocks; a chunk from the reader can split a block
   * anywhere, so incomplete trailing text is held in `buffer` until the next read completes it. */
  private async consumeStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { value, done } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const line = block.trim();
          if (!line.startsWith('data:')) continue;
          this.handleStreamEvent(JSON.parse(line.slice(5).trim()));
        }
      }
      if (done) return;
    }
  }

  private handleStreamEvent(event: ChatStreamEvent): void {
    if (event.type === 'status') {
      this.currentStatus.set({ tool: event.tool, input: event.input });
      return;
    }
    if (event.type === 'error') {
      throw new Error('Server error');
    }
    this.conversationId.set(event.conversationId);
    const cards = event.reply.cards.map(toChatCard);
    this.messages.set([...this.messages(), { role: 'assistant', text: event.reply.text, cards }]);
  }

  /** Starts a brand-new conversation on the next message — the drawer itself can stay open. */
  reset(): void {
    this.conversationId.set(null);
    this.messages.set([]);
  }
}
