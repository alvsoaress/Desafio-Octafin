import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('usa os valores padrão quando nenhuma variável é informada', () => {
    expect(loadConfig({})).toEqual({ alphaPort: 4001, betaPort: 4002, betaScenario: 'ok' });
  });

  it('lê as variáveis informadas', () => {
    expect(loadConfig({ ALPHA_PORT: '5001', BETA_PORT: '5002', BETA_SCENARIO: 'ok' })).toEqual({
      alphaPort: 5001,
      betaPort: 5002,
      betaScenario: 'ok',
    });
  });

  it.each(['ok', 'slow', 'unavailable', 'invalid'])('aceita o cenário %s', (scenario) => {
    expect(loadConfig({ BETA_SCENARIO: scenario }).betaScenario).toBe(scenario);
  });

  it('recusa cenário desconhecido nomeando a variável e os valores aceitos', () => {
    expect(() => loadConfig({ BETA_SCENARIO: 'lento' })).toThrow(
      /BETA_SCENARIO: use um destes valores: ok, slow, unavailable, invalid/,
    );
  });

  it.each([
    ['ALPHA_PORT', 'abc'],
    ['ALPHA_PORT', '0'],
    ['BETA_PORT', '65536'],
    ['BETA_PORT', '4002.5'],
  ])('recusa %s=%s nomeando a variável', (name, value) => {
    expect(() => loadConfig({ [name]: value })).toThrow(new RegExp(`${name}: `));
  });
});
