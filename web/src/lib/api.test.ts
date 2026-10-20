import type { SimulationRequest } from '@consignado/shared';
import { fictitiousCnpjs, fictitiousCpfs } from '@consignado/shared/fixtures';
import { describe, expect, it, vi } from 'vitest';
import { referenceResponse as simulationResponse } from '../test/responses';
import { simulate } from './api';

const [cpf] = fictitiousCpfs;
const [cnpj] = fictitiousCnpjs;
const baseUrl = 'http://api.test';
const { requestId } = simulationResponse;

const simulationRequest: SimulationRequest = {
  cpf: cpf.digits,
  employerCnpj: cnpj.digits,
  salaryCents: 500000,
  existingDeductionsCents: 50000,
  requestedAmountCents: 1000000,
  termMonths: 24,
};

function fakeFetch(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);

  return vi.fn<typeof fetch>().mockResolvedValue(new Response(text, { status }));
}

describe('simulate', () => {
  it('envia a requisição em JSON para POST /api/simulations', async () => {
    const fetch = fakeFetch(200, simulationResponse);

    await simulate(simulationRequest, { baseUrl, fetch });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simulationRequest),
    });
  });

  it('devolve a resposta válida pelo contrato', async () => {
    const outcome = await simulate(simulationRequest, {
      baseUrl,
      fetch: fakeFetch(200, simulationResponse),
    });

    expect(outcome).toEqual({ kind: 'success', response: simulationResponse });
  });

  it.each([
    ['fora do contrato', { ...simulationResponse, partial: false }],
    ['que não é JSON', '<html>'],
  ])('trata como erro um 200 %s', async (_case, body) => {
    const outcome = await simulate(simulationRequest, { baseUrl, fetch: fakeFetch(200, body) });

    expect(outcome).toEqual({ kind: 'error' });
  });

  it('devolve os erros por campo de um 400 de validação', async () => {
    const fields = { cpf: 'Informe um CPF válido.' };
    const outcome = await simulate(simulationRequest, {
      baseUrl,
      fetch: fakeFetch(400, { error: 'validation_error', fields, requestId }),
    });

    expect(outcome).toEqual({ kind: 'validation', fields, requestId });
  });

  it.each([
    [400, 'invalid_json'],
    [413, 'payload_too_large'],
    [500, 'internal_error'],
  ])('trata o %i %s como erro com o requestId', async (status, error) => {
    const outcome = await simulate(simulationRequest, {
      baseUrl,
      fetch: fakeFetch(status, { error, requestId }),
    });

    expect(outcome).toEqual({ kind: 'error', requestId });
  });

  it('trata como erro sem requestId um erro sem corpo JSON', async () => {
    const outcome = await simulate(simulationRequest, {
      baseUrl,
      fetch: fakeFetch(502, 'Bad Gateway'),
    });

    expect(outcome).toEqual({ kind: 'error', requestId: undefined });
  });

  it('trata a falha de rede como erro sem requestId', async () => {
    const failingFetch = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

    const outcome = await simulate(simulationRequest, { baseUrl, fetch: failingFetch });

    expect(outcome).toEqual({ kind: 'error' });
  });
});
