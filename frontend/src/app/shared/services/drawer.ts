import { Injectable, signal, computed } from '@angular/core';

export type DrawerKey =
  | 'menu-nav'
  | 'auth'
  | 'forgot-password'
  | 'destination-detail'
  | 'all-attractions'
  | 'attraction-detail'
  | 'weather'
  | 'language'
  | 'profile'
  | 'connections'
  | 'hikes'
  | 'hike-detail'
  | 'bikes'
  | 'bike-detail'
  | 'hotels'
  | 'explore-trips-filter'


const DRAWER_BASE_Z = 4000;
const DRAWER_STEP = 10;

@Injectable({ providedIn: 'root' })
export class Drawer {

  // stack of open drawers
  private stack = signal<DrawerKey[]>([]);

  // keys that have been collapsed (removed from stack but payload kept)
  private collapsedKeys = signal<DrawerKey[]>([]);

  // payload store for each drawer
  private payloads = new Map<DrawerKey, any>();

  // convenient computed signals
  readonly top = computed(() => this.stack().at(-1));
  readonly list = computed(() => this.stack());

  open(key: DrawerKey, payload?: any) {
    if (payload !== undefined) {
      this.payloads.set(key, payload);
    }
    const s = this.stack().filter(k => k !== key);
    s.push(key);
    this.stack.set(s);
    this.collapsedKeys.set(this.collapsedKeys().filter(k => k !== key));
  }

  close(key: DrawerKey) {
    this.stack.set(this.stack().filter(k => k !== key));
    this.payloads.delete(key);
    this.collapsedKeys.set(this.collapsedKeys().filter(k => k !== key));
  }

  /**
   * Close a drawer without discarding its payload — for drawers (like the Explore Trips filter
   * sheet) where the payload IS the applied state and must outlive the drawer's own open/closed
   * lifecycle, not just exist while it happens to be open. Plain close() always deletes the
   * payload, which silently reverts state set via setPayload() immediately before closing —
   * found this the hard way: `setPayload(key, x); close(key);` leaves getPayload(key) undefined,
   * not x.
   */
  closePreservingPayload(key: DrawerKey) {
    const payload = this.payloads.get(key);
    this.close(key);
    if (payload !== undefined) this.payloads.set(key, payload);
  }

  /** Remove from stack but keep payload so it can be reopened. */
  collapse(key: DrawerKey) {
    this.stack.set(this.stack().filter(k => k !== key));
    if (!this.collapsedKeys().includes(key)) {
      this.collapsedKeys.set([...this.collapsedKeys(), key]);
    }
  }

  isCollapsed(key: DrawerKey): boolean {
    return this.collapsedKeys().includes(key);
  }

  toggle(key: DrawerKey, payload?: any) {
    this.isOpen(key) ? this.close(key) : this.open(key, payload);
  }

  closeAll() {
    this.stack.set([]);
    this.payloads.clear();
    this.collapsedKeys.set([]);
  }

  isOpen(key: DrawerKey): boolean {
    return this.stack().includes(key);
  }

  zIndexFor(key: DrawerKey): number {
    const i = this.stack().indexOf(key);
    return i >= 0 ? DRAWER_BASE_Z + i * DRAWER_STEP : DRAWER_BASE_Z;
  }

  getPayload<T = any>(key: DrawerKey): T | undefined {
    return this.payloads.get(key) as T | undefined;
  }

  setPayload(key: DrawerKey, payload: any) {
    this.payloads.set(key, payload);
  }

}