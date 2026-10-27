type Listener = (...args: any[]) => void;

/**
 * Minimal typed-enough event emitter with no framework dependency, so classes
 * that use it (e.g. TurnManager) stay importable in plain Node/Vitest.
 */
export class EventEmitter {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off(event: string, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) listener(...args);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
