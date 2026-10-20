import {
  simulationResponseSchema,
  type SimulationRequest,
  type SimulationResponse,
} from '@consignado/shared';

export type SimulateOutcome =
  | { kind: 'success'; response: SimulationResponse }
  | { kind: 'validation'; fields: Record<string, string>; requestId?: string | undefined }
  | { kind: 'error'; requestId?: string | undefined };

export type SimulateOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
};

export type Simulate = (request: SimulationRequest) => Promise<SimulateOutcome>;

export const DEFAULT_API_URL = 'http://localhost:3000';

type ErrorBody = {
  error?: unknown;
  requestId?: unknown;
  fields?: unknown;
};

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((item) => typeof item === 'string')
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function simulate(
  request: SimulationRequest,
  {
    baseUrl = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL,
    fetch = globalThis.fetch,
  }: SimulateOptions = {},
): Promise<SimulateOutcome> {
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    return { kind: 'error' };
  }

  const body = await readJson(response);

  if (response.ok) {
    const parsed = simulationResponseSchema.safeParse(body);

    return parsed.success ? { kind: 'success', response: parsed.data } : { kind: 'error' };
  }

  const { error, fields, requestId } =
    typeof body === 'object' && body !== null ? (body as ErrorBody) : {};
  const id = typeof requestId === 'string' ? requestId : undefined;

  if (response.status === 400 && error === 'validation_error' && isStringRecord(fields)) {
    return { kind: 'validation', fields, requestId: id };
  }

  return { kind: 'error', requestId: id };
}
