'use client';

import { NativeCartClient, NativeCartClientError, type NativeCartMutationOptions } from './native-cart-client';
import type { NativeCart } from '@kablet/domain';

export type NativeCartViewState = {
  cart: NativeCart | null;
  loading: boolean;
  pending: boolean;
  error: NativeCartClientError | null;
};

type Listener = (state: NativeCartViewState) => void;
type ClientFactory = (storeSlug: string) => NativeCartClient;
export type NativeCartAddOptions = NativeCartMutationOptions & { creationIdempotencyKey?: string };

export class NativeCartController {
  private client: NativeCartClient;
  private epoch = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<Listener>();
  private state: NativeCartViewState = { cart: null, loading: false, pending: false, error: null };

  constructor(private storeSlug: string, private readonly clientFactory: ClientFactory = slug => new NativeCartClient(slug)) {
    this.client = clientFactory(storeSlug);
  }

  getState(): NativeCartViewState { return this.state; }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  setStore(storeSlug: string): void {
    if (storeSlug === this.storeSlug) return;
    this.storeSlug = storeSlug;
    this.client = this.clientFactory(storeSlug);
    this.epoch += 1;
    this.queue = Promise.resolve();
    this.update({ cart: null, loading: false, pending: false, error: null });
  }

  async load(): Promise<NativeCart | null> {
    const epoch = this.epoch;
    const client = this.client;
    this.update({ loading: true, error: null });
    try {
      const cart = await client.getCart();
      if (this.isCurrent(epoch, client)) this.update({ cart, loading: false });
      return cart;
    } catch (error) {
      const normalized = this.normalize(error);
      if (this.isCurrent(epoch, client)) this.update({ loading: false, error: normalized });
      throw normalized;
    }
  }

  refresh(): Promise<NativeCart | null> { return this.enqueue(() => this.load()); }

  addLine(productId: string, quantity: number, options?: NativeCartAddOptions): Promise<NativeCart> {
    return this.mutate(async (client, expectedCartVersion, isCurrent) => {
      const { creationIdempotencyKey, ...mutationOptions } = options ?? {};
      if (!this.state.cart) {
        const bootstrapped = await client.createCart(creationIdempotencyKey);
        if (isCurrent()) this.update({ cart: bootstrapped });
      }
      return client.addLine(productId, quantity, { ...mutationOptions, expectedCartVersion: options?.expectedCartVersion ?? this.state.cart?.version ?? expectedCartVersion });
    });
  }

  updateLine(lineId: string, quantity: number, options?: NativeCartMutationOptions): Promise<NativeCart> {
    return this.mutate((client, expectedCartVersion) => client.updateLine(lineId, quantity, { ...options, expectedCartVersion: options?.expectedCartVersion ?? this.state.cart?.version ?? expectedCartVersion }));
  }

  removeLine(lineId: string, options?: NativeCartMutationOptions): Promise<NativeCart> {
    return this.mutate((client, expectedCartVersion) => client.removeLine(lineId, { ...options, expectedCartVersion: options?.expectedCartVersion ?? this.state.cart?.version ?? expectedCartVersion }));
  }

  acceptPrice(lineId: string, options?: NativeCartMutationOptions): Promise<NativeCart> {
    return this.mutate((client, expectedCartVersion) => client.acceptPrice(lineId, { ...options, expectedCartVersion: options?.expectedCartVersion ?? this.state.cart?.version ?? expectedCartVersion }));
  }

  private mutate(work: (client: NativeCartClient, expectedCartVersion: number | undefined, isCurrent: () => boolean) => Promise<NativeCart>): Promise<NativeCart> {
    this.update({ pending: true, error: null });
    return this.enqueue(async () => {
      const epoch = this.epoch;
      const client = this.client;
      const expectedCartVersion = this.state.cart?.version;
      try {
        const cart = await work(client, expectedCartVersion, () => this.isCurrent(epoch, client));
        if (this.isCurrent(epoch, client)) this.update({ cart, pending: false });
        return cart;
      } catch (error) {
        const normalized = this.normalize(error);
        if (this.isCurrent(epoch, client)) {
          if (normalized.code === 'cart_expired' || normalized.code === 'cart_not_found') this.update({ cart: null });
          if (normalized.code === 'cart_version_conflict') {
            try { await this.load(); } catch { /* preserve the original conflict */ }
          }
          this.update({ pending: false, error: normalized });
        }
        throw normalized;
      }
    });
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }

  private isCurrent(epoch: number, client: NativeCartClient): boolean { return epoch === this.epoch && client === this.client; }
  private normalize(error: unknown): NativeCartClientError { return error instanceof NativeCartClientError ? error : new NativeCartClientError({ code: 'network_error', message: 'The cart could not be reached.' }); }
  private update(patch: Partial<NativeCartViewState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
}
