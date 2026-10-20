import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitWhileOpen } from './delay';

describe('waitWhileOpen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolve na hora com espera zero', async () => {
    await expect(waitWhileOpen(new EventEmitter(), 0)).resolves.toBe(true);
  });

  it('resolve com true depois da espera e solta o ouvinte de close', async () => {
    const response = new EventEmitter();
    const waiting = waitWhileOpen(response, 1000);

    await vi.advanceTimersByTimeAsync(1000);

    await expect(waiting).resolves.toBe(true);
    expect(response.listenerCount('close')).toBe(0);
  });

  it('resolve com false e cancela o temporizador quando a conexão fecha antes', async () => {
    const response = new EventEmitter();
    const waiting = waitWhileOpen(response, 10_000);

    response.emit('close');

    await expect(waiting).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
