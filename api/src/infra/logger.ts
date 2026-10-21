import { pino, type DestinationStream, type Logger as PinoLogger } from 'pino';
import type { LogLevel } from '../config/env';

export const SENSITIVE_KEYS = [
  'name',
  'email',
  'cpf',
  'employerCnpj',
  'salaryCents',
  'existingDeductionsCents',
  'requestedAmountCents',
  'body',
  'authorization',
  'cookie',
] as const;

export const REDACTED = '[REDACTED]';

const sensitiveKeys = new Set<string>(SENSITIVE_KEYS.map((key) => key.toLowerCase()));

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;

  return prototype === Object.prototype || prototype === null;
}

export function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => redactSensitive(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeys.has(key.toLowerCase()) ? REDACTED : redactSensitive(item),
    ]),
  ) as T;
}

export type LoggerOptions = {
  level: LogLevel;
};

export function createLogger(
  { level }: LoggerOptions,
  destination?: DestinationStream,
): PinoLogger {
  const options = { level, formatters: { log: redactSensitive } };

  return destination ? pino(options, destination) : pino(options);
}
