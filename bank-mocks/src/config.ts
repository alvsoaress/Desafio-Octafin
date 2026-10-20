import { z } from 'zod';

export const BETA_SCENARIOS = ['ok', 'slow', 'unavailable', 'invalid'] as const;

export type BetaScenario = (typeof BETA_SCENARIOS)[number];

export type MocksConfig = {
  alphaPort: number;
  betaPort: number;
  betaScenario: BetaScenario;
};

function portField(defaultPort: number) {
  return z.coerce
    .number({ error: 'informe um número de porta' })
    .int({ error: 'informe uma porta inteira entre 1 e 65535' })
    .min(1, { error: 'informe uma porta inteira entre 1 e 65535' })
    .max(65535, { error: 'informe uma porta inteira entre 1 e 65535' })
    .default(defaultPort);
}

const envSchema = z.object({
  ALPHA_PORT: portField(4001),
  BETA_PORT: portField(4002),
  BETA_SCENARIO: z
    .enum(BETA_SCENARIOS, { error: `use um destes valores: ${BETA_SCENARIOS.join(', ')}` })
    .default('slow'),
});

export function loadConfig(env: Record<string, string | undefined>): MocksConfig {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Configuração inválida dos mocks bancários. ${problems.join('; ')}`);
  }

  return {
    alphaPort: result.data.ALPHA_PORT,
    betaPort: result.data.BETA_PORT,
    betaScenario: result.data.BETA_SCENARIO,
  };
}
