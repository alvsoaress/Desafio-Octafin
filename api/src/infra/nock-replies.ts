export function connectionRefused(): Error {
  return Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
}

export function replyAfter(delayMs: number, status: number, body: unknown) {
  return async (): Promise<[number, unknown]> => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return [status, body];
  };
}
