import type { EventEmitter } from 'node:events';

export function waitWhileOpen(response: EventEmitter, ms: number): Promise<boolean> {
  if (ms <= 0) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const onClose = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      response.off('close', onClose);
      resolve(true);
    }, ms);

    response.once('close', onClose);
  });
}
