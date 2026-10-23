import { fictitiousCpfs } from '@consignado/shared/fixtures';
import { describe, expect, it } from 'vitest';
import { scoreFromCpf } from './score';

describe('scoreFromCpf', () => {
  it.each([
    [fictitiousCpfs[0].digits, 927],
    [fictitiousCpfs[1].digits, 158],
    [fictitiousCpfs[2].digits, 302],
    [fictitiousCpfs[3].digits, 641],
  ])('o CPF %s tem score %i', (cpf, score) => {
    expect(scoreFromCpf(cpf)).toBe(score);
  });

  it('vai de 0 a 999', () => {
    expect(scoreFromCpf('12300045600')).toBe(0);
    expect(scoreFromCpf('12399945600')).toBe(999);
  });

  it('dá sempre o mesmo score para o mesmo CPF', () => {
    const cpf = fictitiousCpfs[0].digits;

    expect(scoreFromCpf(cpf)).toBe(scoreFromCpf(cpf));
  });
});
