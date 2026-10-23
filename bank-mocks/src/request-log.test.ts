import { fictitiousCnpjs, fictitiousCpfs } from '@consignado/shared/fixtures';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAlphaApp } from './alpha';
import { createBetaApp } from './beta';
import type { LogLine } from './request-log';

const cpf = fictitiousCpfs[0];
const cnpj = fictitiousCnpjs[0];

async function loggedLines(
  createApp: (log: LogLine) => Express,
  path: string,
  body: object,
): Promise<string[]> {
  const lines: string[] = [];

  await request(createApp((line) => lines.push(line)))
    .post(path)
    .send(body);
  await new Promise((resolve) => setImmediate(resolve));

  return lines;
}

describe('requestLog', () => {
  it('escreve uma linha com banco, método, caminho, status e duração', async () => {
    const lines = await loggedLines(
      (log) => createAlphaApp({ delayMs: 0, log }),
      '/v1/loan-quotes',
      { document: cpf.digits, employerDocument: cnpj.digits, amountCents: 1000000, termMonths: 24 },
    );

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      bank: 'alpha',
      method: 'POST',
      path: '/v1/loan-quotes',
      status: 200,
      durationMs: expect.any(Number) as number,
    });
  });

  it.each([
    [
      'Alpha com sucesso',
      (log: LogLine) => createAlphaApp({ delayMs: 0, log }),
      '/v1/loan-quotes',
      { document: cpf.digits, employerDocument: cnpj.digits, amountCents: 1234567, termMonths: 24 },
    ],
    [
      'Alpha com CPF mascarado recusado',
      (log: LogLine) => createAlphaApp({ delayMs: 0, log }),
      '/v1/loan-quotes',
      { document: cpf.masked, employerDocument: cnpj.masked, amountCents: 1234567, termMonths: 24 },
    ],
    [
      'Beta com sucesso',
      (log: LogLine) => createBetaApp({ scenario: 'ok', delayMs: 0, log }),
      '/api/simulacao',
      { cpf: cpf.digits, valor: '12345.67', prazoMeses: 24 },
    ],
    [
      'Beta indisponível',
      (log: LogLine) => createBetaApp({ scenario: 'unavailable', log }),
      '/api/simulacao',
      { cpf: cpf.masked, valor: '12345.67', prazoMeses: 24 },
    ],
  ])('não registra CPF, CNPJ nem valor: %s', async (_case, createApp, path, body) => {
    const lines = await loggedLines(createApp, path, body);
    const output = lines.join('\n');

    expect(lines).toHaveLength(1);
    expect(output).not.toContain(cpf.digits);
    expect(output).not.toContain(cpf.masked);
    expect(output).not.toContain(cnpj.digits);
    expect(output).not.toContain(cnpj.masked);
    expect(output).not.toContain('1234567');
    expect(output).not.toContain('12345.67');
  });
});
