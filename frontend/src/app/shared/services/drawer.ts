import { Injectable, signal, computed } from '@angular/core';

export type DrawerKey =
  | 'menu-nav'
  | 'auth'
  | 'forgot-password'
  | 'weather'
  | 'language'
  | 'profile'


const DRAWER_BASE_Z = 4000;
const DRAWER_STEP = 10;

@Injectable({ providedIn: 'root' })
export class Drawer {

  // stack of open drawers
  private stack = signal<DrawerKey[]>([]);

  // payload store for each drawer
  private payloads = new Map<DrawerKey, any>();

  // convenient computed signals
  readonly top = computed(() => this.stack().at(-1));
  readonly list = computed(() => this.stack());

  /**
   * Open a drawer and optionally provide a payload.
   */
  open(key: DrawerKey, payload?: any) {
    // update payload if provided
    if (payload !== undefined) {
      this.payloads.set(key, payload);
    }

    const s = this.stack().filter(k => k !== key); // ensure unique
    s.push(key);
    this.stack.set(s);
  }

  /**
   * Close a drawer and remove its payload.
   */
  close(key: DrawerKey) {
    this.stack.set(this.stack().filter(k => k !== key));
    this.payloads.delete(key);
  }

  /**
   * Toggle open/close state.
   */
  toggle(key: DrawerKey, payload?: any) {
    this.isOpen(key) ? this.close(key) : this.open(key, payload);
  }

  /**
   * Close all drawers & clear all payloads.
   */
  closeAll() {
    this.stack.set([]);
    this.payloads.clear();
  }

  /**
   * Returns true if drawer is open.
   */
  isOpen(key: DrawerKey): boolean {
    return this.stack().includes(key);
  }

  /**
   * Deterministic z-index per drawer.
   */
  zIndexFor(key: DrawerKey): number {
    const i = this.stack().indexOf(key);
    return i >= 0 ? DRAWER_BASE_Z + i * DRAWER_STEP : DRAWER_BASE_Z;
  }

  /**
   * Retrieve payload for a drawer.
   */
  getPayload<T = any>(key: DrawerKey): T | undefined {
    return this.payloads.get(key) as T | undefined;
  }

  /**
   * Update payload for an already-open drawer.
   */
  setPayload(key: DrawerKey, payload: any) {
    this.payloads.set(key, payload);
  }
}