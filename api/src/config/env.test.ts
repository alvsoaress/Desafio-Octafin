import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const requiredEnv = {
  WEB_ORIGIN: 'http://localhost:5173',
  ALPHA_BASE_URL: 'http://localhost:4001',
  BETA_BASE_URL: 'http://localhost:4002',
};

describe('loadEnv', () => {
  it('usa os valores padrão quando só as obrigatórias são informadas', () => {
    expect(loadEnv(requiredEnv)).toEqual({
      port: 3000,
      webOrigin: 'http://localhost:5173',
      alphaBaseUrl: 'http://localhost:4001',
      betaBaseUrl: 'http://localhost:4002',
      bankTimeoutMs: 3000,
      logLevel: 'info',
    });
  });

  it('lê e converte as variáveis informadas', () => {
    expect(
      loadEnv({
        ...requiredEnv,
        PORT: '8080',
        ALPHA_BASE_URL: 'https://alpha.example',
        BANK_TIMEOUT_MS: '1500',
        LOG_LEVEL: 'debug',
      }),
    ).toMatchObject({
      port: 8080,
      alphaBaseUrl: 'https://alpha.example',
      bankTimeoutMs: 1500,
      logLevel: 'debug',
    });
  });

  it('reduz WEB_ORIGIN à origem, para comparar com o cabeçalho Origin', () => {
    expect(loadEnv({ ...requiredEnv, WEB_ORIGIN: 'http://localhost:5173/' }).webOrigin).toBe(
      'http://localhost:5173',
    );
  });

  it.each(['WEB_ORIGIN', 'ALPHA_BASE_URL', 'BETA_BASE_URL'])(
    'recusa %s ausente ou vazia nomeando a variável',
    (name) => {
      const missing: Record<string, string | undefined> = { ...requiredEnv, [name]: undefined };

      expect(() => loadEnv(missing)).toThrow(new RegExp(`${name}: variável obrigatória`));
      expect(() => loadEnv({ ...requiredEnv, [name]: '' })).toThrow(
        new RegExp(`${name}: variável obrigatória`),
      );
    },
  );

  it.each([
    ['ALPHA_BASE_URL', 'localhost:4001'],
    ['BETA_BASE_URL', 'ftp://localhost:4002'],
    ['PORT', '0'],
    ['BANK_TIMEOUT_MS', '0'],
    ['BANK_TIMEOUT_MS', 'abc'],
    ['BANK_TIMEOUT_MS', '1500.5'],
    ['LOG_LEVEL', 'verbose'],
  ])('recusa %s=%s nomeando a variável', (name, value) => {
    expect(() => loadEnv({ ...requiredEnv, [name]: value })).toThrow(
      new RegExp(`Configuração inválida da API\\..*${name}: `),
    );
  });
});
