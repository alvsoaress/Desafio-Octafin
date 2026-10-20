import { fictitiousCnpjs, fictitiousCpfs } from '@consignado/shared/fixtures';
import { describe, expect, it } from 'vitest';
import { createLogger, REDACTED, redactSensitive } from './logger';

const [cpf] = fictitiousCpfs;
const [cnpj] = fictitiousCnpjs;

function memoryDestination() {
  const lines: string[] = [];

  return {
    lines,
    write(line: string) {
      lines.push(line);
    },
  };
}

describe('redactSensitive', () => {
  it('mascara só os campos sensíveis', () => {
    expect(redactSensitive({ cpf: cpf.digits, requestId: 'abc', bankId: 'alpha' })).toEqual({
      cpf: REDACTED,
      requestId: 'abc',
      bankId: 'alpha',
    });
  });

  it('mascara o corpo inteiro da requisição', () => {
    expect(
      redactSensitive({ request: { method: 'POST', body: { cpf: cpf.digits, termMonths: 24 } } }),
    ).toEqual({ request: { method: 'POST', body: REDACTED } });
  });

  it('mascara os cabeçalhos authorization e cookie sem diferenciar maiúsculas', () => {
    expect(
      redactSensitive({
        headers: { Authorization: 'Bearer x', cookie: 'sessao=1', 'content-type': 'json' },
      }),
    ).toEqual({ headers: { Authorization: REDACTED, cookie: REDACTED, 'content-type': 'json' } });
  });

  it('mascara dentro de arrays', () => {
    expect(redactSensitive({ results: [{ salaryCents: 500000, bankId: 'beta' }] })).toEqual({
      results: [{ salaryCents: REDACTED, bankId: 'beta' }],
    });
  });

  it('mascara em qualquer profundidade', () => {
    expect(
      redactSensitive({
        a: {
          b: {
            c: {
              employerCnpj: cnpj.digits,
              existingDeductionsCents: 50000,
              requestedAmountCents: 1000000,
            },
          },
        },
      }),
    ).toEqual({
      a: {
        b: {
          c: {
            employerCnpj: REDACTED,
            existingDeductionsCents: REDACTED,
            requestedAmountCents: REDACTED,
          },
        },
      },
    });
  });

  it.each([null, undefined, 42, 'texto', true])('devolve %s sem alterar', (value) => {
    expect(redactSensitive(value)).toBe(value);
  });

  it('não altera o objeto original', () => {
    const original = { nested: { cpf: cpf.digits }, list: [{ cookie: 'x' }] };

    redactSensitive(original);

    expect(original).toEqual({ nested: { cpf: cpf.digits }, list: [{ cookie: 'x' }] });
  });
});

describe('createLogger', () => {
  it('escreve JSON com os campos sensíveis mascarados', () => {
    const destination = memoryDestination();
    const logger = createLogger({ level: 'info' }, destination);

    logger.info({ cpf: cpf.digits, request: { salaryCents: 500000 }, bankId: 'alpha' }, 'teste');

    expect(destination.lines).toHaveLength(1);
    const [line = ''] = destination.lines;
    expect(JSON.parse(line)).toMatchObject({
      cpf: REDACTED,
      request: { salaryCents: REDACTED },
      bankId: 'alpha',
      msg: 'teste',
    });
    expect(line).not.toContain(cpf.digits);
    expect(line).not.toContain('500000');
  });

  it('não escreve abaixo do nível configurado', () => {
    const destination = memoryDestination();
    const logger = createLogger({ level: 'warn' }, destination);

    logger.info({ bankId: 'alpha' }, 'teste');

    expect(destination.lines).toHaveLength(0);
  });
});
