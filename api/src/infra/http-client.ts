export type PostJsonResult =
  | { kind: 'response'; status: number; body: unknown }
  | { kind: 'not-json'; status: number }
  | { kind: 'timeout' }
  | { kind: 'network-error' };

export async function postJson(
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<PostJsonResult> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    return signal.aborted ? { kind: 'timeout' } : { kind: 'network-error' };
  }

  try {
    return { kind: 'response', status: response.status, body: await response.json() };
  } catch {
    return signal.aborted ? { kind: 'timeout' } : { kind: 'not-json', status: response.status };
  }
}
