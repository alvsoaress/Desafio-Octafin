import { z } from 'zod';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type ApiConfig = {
  port: number;
  webOrigin: string;
  alphaBaseUrl: string;
  betaBaseUrl: string;
  bankTimeoutMs: number;
  logLevel: LogLevel;
};

function integerField(min: number, max: number, defaultValue: number) {
  const message = `informe um inteiro entre ${min} e ${max}`;

  return z.coerce
    .number({ error: message })
    .int({ error: message })
    .min(min, { error: message })
    .max(max, { error: message })
    .default(defaultValue);
}

const requiredUrl = z.url({
  protocol: /^https?$/,
  error: (issue) =>
    issue.input === undefined || issue.input === ''
      ? 'variável obrigatória'
      : 'informe uma URL http ou https',
});

const envSchema = z.object({
  PORT: integerField(1, 65535, 3000),
  WEB_ORIGIN: requiredUrl.transform((url) => new URL(url).origin),
  ALPHA_BASE_URL: requiredUrl,
  BETA_BASE_URL: requiredUrl,
  BANK_TIMEOUT_MS: integerField(1, 60000, 3000),
  LOG_LEVEL: z
    .enum(LOG_LEVELS, { error: `use um destes valores: ${LOG_LEVELS.join(', ')}` })
    .default('info'),
});

export function loadEnv(env: Record<string, string | undefined>): ApiConfig {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Configuração inválida da API. ${problems.join('; ')}`);
  }

  return {
    port: result.data.PORT,
    webOrigin: result.data.WEB_ORIGIN,
    alphaBaseUrl: result.data.ALPHA_BASE_URL,
    betaBaseUrl: result.data.BETA_BASE_URL,
    bankTimeoutMs: result.data.BANK_TIMEOUT_MS,
    logLevel: result.data.LOG_LEVEL,
  };
}
